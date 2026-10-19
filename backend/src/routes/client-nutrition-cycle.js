import express from 'express';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';
import { ensureCycleSchema } from './cycles.js';

const router = express.Router();
router.use(authorizeRole(['client']));

router.get('/cycle', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    res.set('Cache-Control', 'no-store, private, max-age=0');
    await ensureCycleSchema(connection);
    const [protocolRows] = await connection.query(
      `SELECT cp.id, cp.is_active, cp.total_weeks, cp.current_week, cp.pct_protocol, cp.pct_start_week,
              cp.estrogen_control, cp.organ_support, cp.client_notes
       FROM cycle_protocols cp
       INNER JOIN nutrition_plans np ON np.id = cp.nutrition_plan_id
       WHERE cp.client_id = ? AND cp.is_active = TRUE
       ORDER BY np.updated_at DESC, cp.updated_at DESC
       LIMIT 1`,
      [req.user.id],
    );
    if (!protocolRows.length) return res.json({ cycle: null });

    const cycle = protocolRows[0];
    const [compounds] = await connection.query(
      `SELECT id, name, dose, unit, frequency, start_week, end_week, sort_order
       FROM cycle_compounds
       WHERE protocol_id = ?
       ORDER BY sort_order, id`,
      [cycle.id],
    );
    res.json({ cycle: { ...cycle, compounds } });
  } catch (error) {
    console.error('Client nutrition cycle lookup failed:', error);
    res.status(500).json({ message: 'Δεν φορτώθηκε το Cycle Protocol.' });
  } finally {
    connection.release();
  }
});

export default router;
