import express from 'express';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken, authorizeRole(['coach']));

export async function ensureCycleSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS cycle_protocols (
      id                INT PRIMARY KEY AUTO_INCREMENT,
      nutrition_plan_id INT NOT NULL,
      client_id         INT NOT NULL,
      coach_id          INT NOT NULL,
      is_active         BOOLEAN DEFAULT FALSE,
      total_weeks       INT DEFAULT 12,
      current_week      INT DEFAULT 1,
      pct_protocol      VARCHAR(100),
      pct_start_week    INT,
      estrogen_control  VARCHAR(200),
      organ_support     VARCHAR(300),
      coach_notes       TEXT,
      client_notes      TEXT,
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_plan (nutrition_plan_id),
      FOREIGN KEY (nutrition_plan_id) REFERENCES nutrition_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES users(id),
      FOREIGN KEY (coach_id)  REFERENCES users(id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS cycle_compounds (
      id          INT PRIMARY KEY AUTO_INCREMENT,
      protocol_id INT NOT NULL,
      name        VARCHAR(150) NOT NULL,
      dose        DECIMAL(8,2) NOT NULL,
      unit        ENUM('mg','ml','IU','mcg') DEFAULT 'mg',
      frequency   VARCHAR(30),
      start_week  INT DEFAULT 1,
      end_week    INT,
      sort_order  INT DEFAULT 0,
      FOREIGN KEY (protocol_id) REFERENCES cycle_protocols(id) ON DELETE CASCADE
    )
  `);
}

async function getActiveNutritionPlan(connection, clientId) {
  const [rows] = await connection.query(
    `SELECT id, title FROM nutrition_plans WHERE client_id = ? AND status = 'active'
     ORDER BY updated_at DESC, created_at DESC LIMIT 1`,
    [clientId]
  );
  return rows[0] || null;
}

async function getProtocolWithCompounds(connection, nutritionPlanId) {
  const [protocolRows] = await connection.query('SELECT * FROM cycle_protocols WHERE nutrition_plan_id = ?', [nutritionPlanId]);
  if (!protocolRows.length) return null;
  const protocol = protocolRows[0];
  const [compounds] = await connection.query(
    'SELECT * FROM cycle_compounds WHERE protocol_id = ? ORDER BY sort_order, id',
    [protocol.id]
  );
  return { ...protocol, compounds };
}

async function coachHasClient(connection, coachId, clientId) {
  const [rows] = await connection.query(
    'SELECT id FROM coach_clients WHERE coach_id = ? AND client_id = ?',
    [coachId, clientId]
  );
  return rows.length > 0;
}

router.get('/:clientId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureCycleSchema(connection);
    const clientId = Number(req.params.clientId);
    if (req.user.role === 'coach' && !(await coachHasClient(connection, req.user.id, clientId))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const plan = await getActiveNutritionPlan(connection, clientId);
    if (!plan) return res.json({ nutritionPlanId: null, nutritionPlanTitle: null, protocol: null });

    const protocol = await getProtocolWithCompounds(connection, plan.id);
    res.json({ nutritionPlanId: plan.id, nutritionPlanTitle: plan.title, protocol });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.put('/:clientId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureCycleSchema(connection);
    const clientId = Number(req.params.clientId);
    if (req.user.role === 'coach' && !(await coachHasClient(connection, req.user.id, clientId))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const plan = await getActiveNutritionPlan(connection, clientId);
    if (!plan) {
      return res.status(400).json({ message: 'Ο πελάτης δεν έχει ενεργό πλάνο διατροφής. Δημιούργησε πρώτα ένα πλάνο διατροφής.' });
    }

    const {
      isActive,
      totalWeeks,
      currentWeek,
      pctProtocol,
      pctStartWeek,
      estrogenControl,
      organSupport,
      coachNotes,
      clientNotes,
      compounds = [],
    } = req.body;

    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT id FROM cycle_protocols WHERE nutrition_plan_id = ?', [plan.id]);
    let protocolId;
    if (existing.length) {
      protocolId = existing[0].id;
      await connection.query(
        `UPDATE cycle_protocols
         SET is_active = ?, total_weeks = ?, current_week = ?, pct_protocol = ?, pct_start_week = ?,
             estrogen_control = ?, organ_support = ?, coach_notes = ?, client_notes = ?
         WHERE id = ?`,
        [
          Boolean(isActive), totalWeeks || 12, currentWeek || 1, pctProtocol || null, pctStartWeek || null,
          estrogenControl || null, organSupport || null, coachNotes || null, clientNotes || null, protocolId,
        ]
      );
    } else {
      const [result] = await connection.query(
        `INSERT INTO cycle_protocols
           (nutrition_plan_id, client_id, coach_id, is_active, total_weeks, current_week,
            pct_protocol, pct_start_week, estrogen_control, organ_support, coach_notes, client_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plan.id, clientId, req.user.id, Boolean(isActive), totalWeeks || 12, currentWeek || 1,
          pctProtocol || null, pctStartWeek || null, estrogenControl || null, organSupport || null,
          coachNotes || null, clientNotes || null,
        ]
      );
      protocolId = result.insertId;
    }

    await connection.query('DELETE FROM cycle_compounds WHERE protocol_id = ?', [protocolId]);
    for (const [index, compound] of compounds.entries()) {
      if (!compound?.name || compound.dose === undefined || compound.dose === null || compound.dose === '') continue;
      await connection.query(
        `INSERT INTO cycle_compounds (protocol_id, name, dose, unit, frequency, start_week, end_week, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          protocolId, compound.name, Number(compound.dose), compound.unit || 'mg', compound.frequency || null,
          Number(compound.startWeek) || 1, compound.endWeek ? Number(compound.endWeek) : null, index,
        ]
      );
    }

    await connection.commit();
    const protocol = await getProtocolWithCompounds(connection, plan.id);
    res.json({ nutritionPlanId: plan.id, nutritionPlanTitle: plan.title, protocol });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.delete('/:clientId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureCycleSchema(connection);
    const clientId = Number(req.params.clientId);
    if (req.user.role === 'coach' && !(await coachHasClient(connection, req.user.id, clientId))) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const plan = await getActiveNutritionPlan(connection, clientId);
    if (plan) await connection.query('DELETE FROM cycle_protocols WHERE nutrition_plan_id = ?', [plan.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

export default router;
