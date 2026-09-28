import express from 'express';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken, authorizeRole(['coach']));

const PERIODS = ['week', 'month', 'quarter', 'year'];
const PERIOD_TITLES = {
  week: 'Αυτή η εβδομάδα',
  month: 'Αυτός ο μήνας',
  quarter: 'Τρέχον τρίμηνο',
  year: 'Τρέχον έτος',
};
const REVENUE_LABELS = {
  week: 'Έσοδα εβδομάδας',
  month: 'Μηνιαία έσοδα',
  quarter: 'Έσοδα τριμήνου',
  year: 'Ετήσια τάση εσόδων',
};
const WEEK_LABELS = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'];
const MONTH_WEEK_LABELS = ['1η εβδ.', '2η εβδ.', '3η εβδ.', '4η εβδ.'];
const MONTH_SHORT = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setHours(0, 0, 0, 0);
  d.setDate(diff);
  return d;
}

function getPeriodRange(period, now = new Date()) {
  if (period === 'week') {
    const start = startOfWeek(now);
    return { start, end: addDays(start, 7) };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }
  if (period === 'quarter') {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), qStartMonth, 1);
    const end = new Date(now.getFullYear(), qStartMonth + 3, 1);
    return { start, end };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  return { start, end };
}

function getPreviousRange({ start, end }) {
  const durationMs = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - durationMs), end: new Date(start.getTime()) };
}

function emptyBuckets(period, range) {
  if (period === 'week') return WEEK_LABELS.map((label) => ({ label, value: 0 }));
  if (period === 'month') return MONTH_WEEK_LABELS.map((label) => ({ label, value: 0 }));
  if (period === 'quarter') return [0, 1, 2].map((i) => ({ label: MONTH_SHORT[(range.start.getMonth() + i) % 12], value: 0 }));
  return MONTH_SHORT.map((label) => ({ label, value: 0 }));
}

function bucketIndex(period, range, date) {
  if (period === 'week') {
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
  }
  if (period === 'month') {
    return Math.min(3, Math.floor((date.getDate() - 1) / 7));
  }
  if (period === 'quarter') {
    const idx = date.getMonth() - range.start.getMonth();
    return idx >= 0 && idx < 3 ? idx : null;
  }
  return date.getMonth();
}

function bucketize(period, range, rows, dateField, valueFn) {
  const buckets = emptyBuckets(period, range);
  rows.forEach((row) => {
    const date = new Date(row[dateField]);
    const idx = bucketIndex(period, range, date);
    if (idx === null || idx === undefined || !buckets[idx]) return;
    buckets[idx].value += valueFn(row);
  });
  return buckets;
}

function sum(rows, fn) {
  return rows.reduce((total, row) => total + fn(row), 0);
}

router.get('/', async (req, res) => {
  const period = PERIODS.includes(req.query.period) ? req.query.period : 'month';
  const connection = await pool.getConnection();
  try {
    const now = new Date();
    const range = getPeriodRange(period, now);
    const prevRange = getPreviousRange(range);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

    const [currentPayments] = await connection.query(
      `SELECT p.id, p.amount, p.status, p.method, COALESCE(p.paid_at, p.created_at) AS effective_at,
              p.client_id, p.subscription_id,
              u.full_name AS client_name, u.email AS client_email,
              s.plan_name, s.status AS subscription_status
       FROM payments p
       JOIN users u ON u.id = p.client_id
       LEFT JOIN subscriptions s ON s.id = p.subscription_id
       WHERE COALESCE(p.paid_at, p.created_at) >= ? AND COALESCE(p.paid_at, p.created_at) < ?
       ORDER BY effective_at DESC`,
      [range.start, range.end]
    );

    const [prevCompleted] = await connection.query(
      `SELECT amount FROM payments
       WHERE status = 'completed' AND paid_at >= ? AND paid_at < ?`,
      [prevRange.start, prevRange.end]
    );

    const [ytdCompleted] = await connection.query(
      `SELECT amount FROM payments WHERE status = 'completed' AND paid_at >= ? AND paid_at < ?`,
      [yearStart, yearEnd]
    );

    const [[pendingRow]] = await connection.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'pending'`
    );

    const [[activeSubsRow]] = await connection.query(
      `SELECT COUNT(*) AS count FROM subscriptions
       WHERE status IN ('active', 'expiring_soon') AND start_date <= CURDATE() AND end_date >= CURDATE()`
    );

    const [[endingSoonRow]] = await connection.query(
      `SELECT COUNT(*) AS count FROM subscriptions
       WHERE status IN ('active', 'expiring_soon') AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`
    );

    const [[clientCountsRow]] = await connection.query(
      `SELECT
         SUM(CASE WHEN is_active = 1 AND status = 'active' THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN is_active = 1 AND status = 'pending_payment' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN is_active = 0 OR status = 'expired' THEN 1 ELSE 0 END) AS inactive
       FROM users WHERE role = 'client'`
    );

    const [newClients] = await connection.query(
      `SELECT id, created_at FROM users WHERE role = 'client' AND created_at >= ? AND created_at < ?`,
      [range.start, range.end]
    );

    const [expiredInPeriod] = await connection.query(
      `SELECT id FROM subscriptions WHERE status = 'expired' AND end_date >= ? AND end_date < ?`,
      [range.start, range.end]
    );
    const activeAtStart = Number(activeSubsRow.count) + expiredInPeriod.length;
    const churnRate = activeAtStart > 0 ? Math.round((expiredInPeriod.length / activeAtStart) * 1000) / 10 : 0;

    // "Renewal" = this client has an earlier completed payment before this one.
    const [priorPaymentClientIds] = await connection.query(
      `SELECT DISTINCT client_id FROM payments WHERE status = 'completed' AND COALESCE(paid_at, created_at) < ?`,
      [range.start]
    );
    const renewalClientIds = new Set(priorPaymentClientIds.map((row) => row.client_id));

    const completedInPeriod = currentPayments.filter((row) => row.status === 'completed');
    const currentTotal = sum(completedInPeriod, (row) => Number(row.amount));
    const prevTotal = sum(prevCompleted, (row) => Number(row.amount));
    const comparison = prevTotal > 0
      ? `${currentTotal >= prevTotal ? '+' : ''}${Math.round(((currentTotal - prevTotal) / prevTotal) * 1000) / 10}%`
      : currentTotal > 0 ? '+100%' : '0%';

    const revenueBuckets = bucketize(period, range, completedInPeriod, 'effective_at', (row) => Number(row.amount));
    const clientBuckets = bucketize(period, range, newClients, 'created_at', () => 1);

    const clientRevenueMap = new Map();
    completedInPeriod.forEach((row) => {
      const key = row.client_name || row.client_email || `#${row.client_id}`;
      const entry = clientRevenueMap.get(key) || { client: key, payments: 0, revenueValue: 0 };
      entry.payments += 1;
      entry.revenueValue += Number(row.amount);
      clientRevenueMap.set(key, entry);
    });
    const clientRevenue = [...clientRevenueMap.values()]
      .sort((a, b) => b.revenueValue - a.revenueValue)
      .slice(0, 6)
      .map((entry) => ({ client: entry.client, payments: entry.payments, revenue: `€${entry.revenueValue.toLocaleString('el-GR')}` }));

    const subscriptionFilterFor = (status) => {
      if (status === 'active') return 'active';
      if (status === 'expiring_soon') return 'ending';
      return 'inactive';
    };

    const payments = currentPayments.map((row) => ({
      client: row.client_name || row.client_email || `Πελάτης #${row.client_id}`,
      plan: row.plan_name || 'Χωρίς πλάνο',
      amount: Number(row.amount),
      date: new Date(row.effective_at).toISOString().slice(0, 10),
      status: row.status === 'completed' ? 'paid' : row.status === 'refunded' ? 'refunded' : row.status,
      subscription: row.subscription_status ? subscriptionFilterFor(row.subscription_status) : 'inactive',
      renewal: renewalClientIds.has(row.client_id),
    }));

    res.json({
      title: PERIOD_TITLES[period],
      revenueLabel: REVENUE_LABELS[period],
      annualRevenue: `€${sum(ytdCompleted, (row) => Number(row.amount)).toLocaleString('el-GR')}`,
      comparison,
      activeSubscriptions: Number(activeSubsRow.count),
      pendingAmount: `€${Number(pendingRow.total).toLocaleString('el-GR')}`,
      churnRate: `${churnRate}%`,
      endingSoon: Number(endingSoonRow.count),
      activeClients: Number(clientCountsRow.active) || 0,
      pendingClients: Number(clientCountsRow.pending) || 0,
      inactiveClients: Number(clientCountsRow.inactive) || 0,
      revenue: revenueBuckets,
      clients: clientBuckets,
      payments,
      clientRevenue,
    });
  } catch (error) {
    console.error('Analytics fetch failed:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

export default router;
