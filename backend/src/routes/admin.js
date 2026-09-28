import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { logClientActivity } from '../lib/client-activity-log.js';

const router = express.Router();
// Roles an admin can create/reassign from the Users panel — clients are excluded because they
// self-register via /auth/register; this panel only provisions internal staff accounts.
const TEAM_ROLES = ['admin', 'moderator', 'coach'];
const PERMISSIONS = ['messages', 'view_payments', 'approve_payments', 'send_announcements'];

async function ensureRoleEnum(connection) {
  await connection.query(
    "ALTER TABLE users MODIFY role ENUM('admin', 'moderator', 'coach', 'client') NOT NULL DEFAULT 'client'"
  );
  for (const statement of [
    'ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL',
    'ALTER TABLE users ADD COLUMN deleted_by INT NULL'
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

function publicUserSelect() {
  return 'id, email, full_name, role, specializations, permissions, is_active, status, created_at';
}

function normalizePermissions(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((permission) => PERMISSIONS.includes(permission)))];
}

// Get all users, optionally filtered by role/status (Admin only)
router.get('/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureRoleEnum(connection);

    const conditions = ["role IN ('admin', 'moderator', 'coach')", 'deleted_at IS NULL'];
    const values = [];
    if (req.query.role && TEAM_ROLES.includes(req.query.role)) {
      conditions.push('role = ?');
      values.push(req.query.role);
    }
    if (req.query.status === 'active') {
      conditions.push('is_active = 1');
    } else if (req.query.status === 'inactive') {
      conditions.push('is_active = 0');
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [users] = await connection.query(
      `SELECT ${publicUserSelect()} FROM users ${whereClause} ORDER BY created_at DESC, full_name ASC`,
      values
    );
    connection.release();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/users/trash', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureRoleEnum(connection);
    const [users] = await connection.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.deleted_at,
              COALESCE(deleted_by.full_name, deleted_by.email) AS deleted_by_name
       FROM users u
       LEFT JOIN users deleted_by ON deleted_by.id = u.deleted_by
       WHERE u.role IN ('admin', 'moderator', 'coach') AND u.deleted_at IS NOT NULL
       ORDER BY u.deleted_at DESC, u.full_name ASC`
    );
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// Create a staff user (Admin only) — admin/moderator/coach; clients self-register
router.post('/users', authenticateToken, authorizeRole(['admin']), [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').notEmpty(),
  body('role').isIn(TEAM_ROLES),
  body('specializations').optional(),
  body('permissions').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();

  try {
    await ensureRoleEnum(connection);
    const { email, password, fullName, role, specializations } = req.body;
    const permissions = normalizePermissions(req.body.permissions);

    const [existingUser] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      connection.release();
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.query(
      'INSERT INTO users (email, password, full_name, role, specializations, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [email, hashedPassword, fullName, role, specializations || null, JSON.stringify(permissions)]
    );

    connection.release();
    res.status(201).json({ message: 'User created successfully', id: result.insertId });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update role/status (Admin only)
router.put('/users/:userId', authenticateToken, authorizeRole(['admin']), [
  body('role').optional().isIn(TEAM_ROLES),
  body('isActive').optional().isBoolean(),
  body('fullName').optional().notEmpty(),
  body('specializations').optional(),
  body('permissions').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();

  try {
    await ensureRoleEnum(connection);
    const updates = [];
    const values = [];

    if (req.body.role) {
      updates.push('role = ?');
      values.push(req.body.role);
    }
    if (req.body.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(req.body.isActive ? 1 : 0);
    }
    if (req.body.fullName) {
      updates.push('full_name = ?');
      values.push(req.body.fullName);
    }
    if (req.body.specializations !== undefined) {
      updates.push('specializations = ?');
      values.push(req.body.specializations || null);
    }
    if (req.body.permissions !== undefined) {
      updates.push('permissions = ?');
      values.push(JSON.stringify(normalizePermissions(req.body.permissions)));
    }

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ message: 'No updates provided' });
    }

    values.push(req.params.userId);
    const [result] = await connection.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/users/:userId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const userId = Number(req.params.userId);
  if (userId === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account' });
  const connection = await pool.getConnection();
  try {
    await ensureRoleEnum(connection);
    const [result] = await connection.query(
      `UPDATE users SET deleted_at = NOW(), deleted_by = ?, is_active = 0
       WHERE id = ? AND role IN ('admin', 'moderator', 'coach') AND deleted_at IS NULL`,
      [req.user.id, userId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'User not found or already in trash' });
    res.json({ message: 'User moved to trash' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.put('/users/:userId/restore', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureRoleEnum(connection);
    const [result] = await connection.query(
      `UPDATE users SET deleted_at = NULL, deleted_by = NULL, is_active = 1
       WHERE id = ? AND role IN ('admin', 'moderator', 'coach') AND deleted_at IS NOT NULL`,
      [Number(req.params.userId)]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Trashed user not found' });
    res.json({ message: 'User restored' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.delete('/users/:userId/permanent', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const userId = Number(req.params.userId);
  if (userId === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account' });
  const connection = await pool.getConnection();
  try {
    await ensureRoleEnum(connection);
    await connection.beginTransaction();
    // menu_settings intentionally uses a restrictive FK, so remove the user's
    // personal navigation preference before deleting the account itself.
    await connection.query('DELETE FROM menu_settings WHERE user_id = ?', [userId]);
    const [result] = await connection.query(
      "DELETE FROM users WHERE id = ? AND role IN ('admin', 'moderator', 'coach') AND deleted_at IS NOT NULL",
      [userId]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ message: 'Trashed user not found' });
    }
    await connection.commit();
    res.json({ message: 'User permanently deleted' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

// Reset any user's password directly (Admin only) — unlike the self-service
// /auth/change-password, this does not require knowing the current password
// (e.g. the user is locked out, or it's a new hire's first login).
router.put('/users/:userId/reset-password', authenticateToken, authorizeRole(['admin']), [
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const connection = await pool.getConnection();

  try {
    const [targetUsers] = await connection.query(
      'SELECT id, role FROM users WHERE id = ? LIMIT 1',
      [req.params.userId]
    );
    if (!targetUsers.length) {
      connection.release();
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    const [result] = await connection.query('UPDATE users SET password = ? WHERE id = ?', [
      hashedPassword,
      req.params.userId
    ]);

    if (result.affectedRows === 0) {
      connection.release();
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUsers[0].role === 'client') {
      await logClientActivity(connection, {
        clientId: Number(req.params.userId),
        action: 'Password reset',
        performedBy: req.user.id,
      });
    }

    connection.release();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    connection.release();
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create Coach (Admin only)
router.post('/coaches', authenticateToken, authorizeRole(['admin']), [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').notEmpty(),
  body('specializations').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password, fullName, specializations } = req.body;
    const connection = await pool.getConnection();

    // Check if user exists
    const [existingUser] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      connection.release();
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create coach
    const [result] = await connection.query(
      'INSERT INTO users (email, password, full_name, role, specializations, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [email, hashedPassword, fullName, 'coach', specializations || null]
    );

    connection.release();

    res.status(201).json({ 
      message: 'Coach created successfully',
      coachId: result.insertId 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all coaches (Admin only)
router.get('/coaches', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [coaches] = await connection.query(
      'SELECT id, email, full_name, specializations, created_at FROM users WHERE role = "coach"'
    );
    connection.release();
    res.json(coaches);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete coach (Admin only)
router.delete('/coaches/:coachId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [result] = await connection.query(
      'DELETE FROM users WHERE id = ? AND role = "coach"',
      [req.params.coachId]
    );

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Coach not found' });
    }

    res.json({ message: 'Coach deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all clients (Admin only)
router.get('/clients', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [clients] = await connection.query(
      'SELECT id, email, full_name, created_at FROM users WHERE role = "client"'
    );
    connection.release();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get stats (Admin only)
router.get('/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureRoleEnum(connection);

    const [coachCount] = await connection.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "coach"'
    );

    const [moderatorCount] = await connection.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "moderator"'
    );

    const [adminCount] = await connection.query(
      'SELECT COUNT(*) as count FROM users WHERE role = "admin"'
    );

    connection.release();

    res.json({
      admins: adminCount[0].count,
      moderators: moderatorCount[0].count,
      coaches: coachCount[0].count,
      totalTeamMembers: adminCount[0].count + moderatorCount[0].count + coachCount[0].count
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
