import express from 'express';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';
import { ensureCycleSchema } from './cycles.js';

const router = express.Router();
const allowedUnits = new Set(['mg', 'ml', 'IU', 'mcg']);

router.use(authorizeRole(['coach']));

async function getOwnedPlan(connection, coachId, planId) {
  const [rows] = await connection.query(
    `SELECT id, client_id, coach_id
     FROM nutrition_plans
     WHERE id = ? AND coach_id = ? AND client_id IS NOT NULL
     LIMIT 1`,
    [planId, coachId],
  );
  return rows[0] || null;
}

async function getCycle(connection, planId, coachId) {
  const [protocols] = await connection.query(
    `SELECT id, nutrition_plan_id, client_id, coach_id, is_active, total_weeks, current_week,
            pct_protocol, pct_start_week, estrogen_control, organ_support, coach_notes, client_notes
     FROM cycle_protocols
     WHERE nutrition_plan_id = ? AND coach_id = ?
     LIMIT 1`,
    [planId, coachId],
  );
  if (!protocols.length) return null;

  const protocol = protocols[0];
  const [compounds] = await connection.query(
    `SELECT id, name, dose, unit, frequency, start_week, end_week, sort_order
     FROM cycle_compounds
     WHERE protocol_id = ?
     ORDER BY sort_order, id`,
    [protocol.id],
  );
  return { ...protocol, compounds };
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim().slice(0, maxLength) || null;
}

function normalizePayload(body) {
  const totalWeeks = Math.max(1, Math.min(104, Number(body.totalWeeks) || 12));
  const currentWeek = Math.max(1, Math.min(totalWeeks, Number(body.currentWeek) || 1));
  const pctStartWeek = body.pctStartWeek === undefined || body.pctStartWeek === null || body.pctStartWeek === ''
    ? null
    : Math.max(1, Math.min(totalWeeks, Number(body.pctStartWeek) || 1));
  const compounds = Array.isArray(body.compounds) ? body.compounds.reduce((items, compound, index) => {
    const name = optionalText(compound?.name, 150);
    const dose = Number(compound?.dose);
    if (!name && (compound?.dose === undefined || compound?.dose === null || compound?.dose === '')) return items;
    if (!name || !Number.isFinite(dose) || dose <= 0) {
      throw new Error('Κάθε ουσία χρειάζεται όνομα και έγκυρη θετική δόση.');
    }
    const unit = allowedUnits.has(compound?.unit) ? compound.unit : 'mg';
    const startWeek = Math.max(1, Math.min(totalWeeks, Number(compound?.startWeek) || 1));
    const endWeek = compound?.endWeek === undefined || compound?.endWeek === null || compound?.endWeek === ''
      ? null
      : Math.max(startWeek, Math.min(totalWeeks, Number(compound.endWeek) || startWeek));
    items.push({ name, dose, unit, frequency: optionalText(compound?.frequency, 30), startWeek, endWeek, sortOrder: index });
    return items;
  }, []) : [];

  return {
    isActive: Boolean(body.isActive),
    totalWeeks,
    currentWeek,
    pctProtocol: optionalText(body.pctProtocol, 100),
    pctStartWeek,
    estrogenControl: optionalText(body.estrogenControl, 200),
    organSupport: optionalText(body.organSupport, 300),
    coachNotes: optionalText(body.coachNotes, 10000),
    clientNotes: optionalText(body.clientNotes, 10000),
    compounds,
  };
}

async function saveCycle(connection, plan, coachId, body) {
  const payload = normalizePayload(body);
  const [existing] = await connection.query(
    'SELECT id FROM cycle_protocols WHERE nutrition_plan_id = ? LIMIT 1',
    [plan.id],
  );
  let protocolId;

  if (existing.length) {
    protocolId = existing[0].id;
    await connection.query(
      `UPDATE cycle_protocols
       SET coach_id = ?, is_active = ?, total_weeks = ?, current_week = ?, pct_protocol = ?, pct_start_week = ?,
           estrogen_control = ?, organ_support = ?, coach_notes = ?, client_notes = ?
       WHERE id = ? AND client_id = ?`,
      [coachId, payload.isActive, payload.totalWeeks, payload.currentWeek, payload.pctProtocol, payload.pctStartWeek,
        payload.estrogenControl, payload.organSupport, payload.coachNotes, payload.clientNotes, protocolId, plan.client_id],
    );
  } else {
    const [result] = await connection.query(
      `INSERT INTO cycle_protocols
       (nutrition_plan_id, client_id, coach_id, is_active, total_weeks, current_week, pct_protocol, pct_start_week,
        estrogen_control, organ_support, coach_notes, client_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [plan.id, plan.client_id, coachId, payload.isActive, payload.totalWeeks, payload.currentWeek, payload.pctProtocol,
        payload.pctStartWeek, payload.estrogenControl, payload.organSupport, payload.coachNotes, payload.clientNotes],
    );
    protocolId = result.insertId;
  }

  await connection.query('DELETE FROM cycle_compounds WHERE protocol_id = ?', [protocolId]);
  for (const compound of payload.compounds) {
    await connection.query(
      `INSERT INTO cycle_compounds
       (protocol_id, name, dose, unit, frequency, start_week, end_week, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [protocolId, compound.name, compound.dose, compound.unit, compound.frequency, compound.startWeek, compound.endWeek, compound.sortOrder],
    );
  }
}

async function notifyCycleChange(connection, clientId, change) {
  const messages = {
    activated: { title: 'Το Cycle Protocol ενεργοποιήθηκε', body: 'Ο coach ενεργοποίησε το Cycle Protocol σου.' },
    deactivated: { title: 'Το Cycle Protocol απενεργοποιήθηκε', body: 'Ο coach απενεργοποίησε το Cycle Protocol σου.' },
    updated: { title: 'Το Cycle Protocol ενημερώθηκε', body: 'Ο coach έκανε αλλαγές στο Cycle Protocol σου.' },
  };

  try {
    const { notifyUser } = await import('./clients.js');
    await notifyUser(connection, clientId, {
      clientId,
      type: 'cycle_protocol_updated',
      ...messages[change],
      linkUrl: '/client-nutrition',
    });
  } catch (error) {
    console.error('Nutrition cycle notification failed:', error);
  }
}

async function resolvePlan(connection, req, res) {
  await ensureCycleSchema(connection);
  const planId = Number(req.params.planId);
  if (!Number.isInteger(planId) || planId < 1) {
    res.status(400).json({ message: 'Μη έγκυρο πλάνο διατροφής.' });
    return null;
  }
  const plan = await getOwnedPlan(connection, req.user.id, planId);
  if (!plan) {
    res.status(403).json({ message: 'Δεν έχεις πρόσβαση σε αυτό το πλάνο διατροφής.' });
    return null;
  }
  return plan;
}

router.get('/:planId/cycle', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const plan = await resolvePlan(connection, req, res);
    if (!plan) return;
    res.json({ cycle: await getCycle(connection, plan.id, req.user.id) });
  } catch (error) {
    console.error('Nutrition cycle lookup failed:', error);
    res.status(500).json({ message: 'Δεν φορτώθηκε το Cycle Protocol.' });
  } finally {
    connection.release();
  }
});

async function upsertHandler(req, res) {
  const connection = await pool.getConnection();
  try {
    const plan = await resolvePlan(connection, req, res);
    if (!plan) return;
    const previousCycle = await getCycle(connection, plan.id, req.user.id);
    await connection.beginTransaction();
    await saveCycle(connection, plan, req.user.id, req.body || {});
    await connection.commit();
    const cycle = await getCycle(connection, plan.id, req.user.id);
    const change = !cycle?.is_active ? 'deactivated' : !previousCycle || !previousCycle.is_active ? 'activated' : 'updated';
    await notifyCycleChange(connection, plan.client_id, change);
    res.json({ cycle });
  } catch (error) {
    await connection.rollback().catch(() => {});
    const status = error instanceof Error && error.message.includes('Κάθε ουσία') ? 400 : 500;
    if (status === 500) console.error('Nutrition cycle save failed:', error);
    res.status(status).json({ message: error instanceof Error ? error.message : 'Δεν αποθηκεύτηκε το Cycle Protocol.' });
  } finally {
    connection.release();
  }
}

router.post('/:planId/cycle', upsertHandler);
router.put('/:planId/cycle', upsertHandler);

router.patch('/:planId/cycle/toggle', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const plan = await resolvePlan(connection, req, res);
    if (!plan) return;
    const [result] = await connection.query(
      'UPDATE cycle_protocols SET is_active = ? WHERE nutrition_plan_id = ? AND coach_id = ? AND client_id = ?',
      [Boolean(req.body?.isActive), plan.id, req.user.id, plan.client_id],
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Δημιούργησε πρώτα ένα Cycle Protocol.' });
    const isActive = Boolean(req.body?.isActive);
    await notifyCycleChange(connection, plan.client_id, isActive ? 'activated' : 'deactivated');
    res.json({ cycle: await getCycle(connection, plan.id, req.user.id) });
  } catch (error) {
    console.error('Nutrition cycle toggle failed:', error);
    res.status(500).json({ message: 'Δεν ενημερώθηκε η κατάσταση του Cycle Protocol.' });
  } finally {
    connection.release();
  }
});

export default router;
