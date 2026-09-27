import express from 'express';
import { pool } from '../index.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  getDiscordUser,
  addMemberToGuild,
  addRole,
  removeRole,
  getActiveRoleId,
  getGuildMember,
} from '../lib/discord.js';

const router = express.Router();
router.use(authenticateToken, authorizeRole(['client']));

export async function ensureDiscordSchema(connection) {
  for (const statement of [
    'ALTER TABLE users ADD COLUMN discord_id VARCHAR(50) NULL',
    'ALTER TABLE users ADD COLUMN discord_username VARCHAR(100) NULL',
    'ALTER TABLE users ADD COLUMN discord_connected_at TIMESTAMP NULL',
  ]) {
    try {
      await connection.query(statement);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

async function hasActiveSubscription(connection, clientId) {
  const [rows] = await connection.query(
    `SELECT id FROM subscriptions
     WHERE client_id = ? AND status IN ('active', 'expiring_soon')
       AND start_date <= CURDATE() AND end_date >= CURDATE()
     LIMIT 1`,
    [clientId]
  );
  return rows.length > 0;
}

// Visited via a real browser navigation (not fetch) so the accessToken cookie
// rides along — Discord's own page has to load in the top-level window.
router.get('/auth', (req, res) => {
  res.redirect(buildAuthorizeUrl());
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ message: 'Missing authorization code.' });

  const connection = await pool.getConnection();
  try {
    await ensureDiscordSchema(connection);

    const tokenData = await exchangeCodeForToken(code);
    const discordUser = await getDiscordUser(tokenData.access_token);

    await connection.query(
      'UPDATE users SET discord_id = ?, discord_username = ?, discord_connected_at = NOW() WHERE id = ?',
      [discordUser.id, discordUser.username, req.user.id]
    );

    try {
      await addMemberToGuild(discordUser.id, tokenData.access_token);
    } catch (error) {
      console.error('Discord addMemberToGuild failed:', error.message);
    }

    let hasRole = false;
    if (await hasActiveSubscription(connection, req.user.id)) {
      const roleId = await getActiveRoleId();
      if (roleId) {
        try {
          await addRole(discordUser.id, roleId);
          hasRole = true;
        } catch (error) {
          console.error('Discord addRole failed:', error.message);
        }
      }
    }

    res.json({ success: true, discordUsername: discordUser.username, hasRole });
  } catch (error) {
    console.error('Discord callback failed:', error);
    res.status(502).json({ message: error.message || 'Η σύνδεση με το Discord απέτυχε.' });
  } finally {
    connection.release();
  }
});

router.get('/status', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureDiscordSchema(connection);
    const subscriptionActive = await hasActiveSubscription(connection, req.user.id);
    const [rows] = await connection.query('SELECT discord_id, discord_username FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];

    const guildUrl = `https://discord.com/channels/${process.env.DISCORD_GUILD_ID}`;

    if (!user?.discord_id) {
      return res.json({ connected: false, discordUsername: null, hasRole: false, subscriptionActive, guildUrl });
    }

    let hasRole = false;
    try {
      const roleId = await getActiveRoleId();
      const member = roleId ? await getGuildMember(user.discord_id) : null;
      hasRole = Boolean(member?.roles?.includes(roleId));
    } catch (error) {
      console.error('Discord status role lookup failed:', error.message);
    }

    res.json({ connected: true, discordUsername: user.discord_username, hasRole, subscriptionActive, guildUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

router.delete('/disconnect', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureDiscordSchema(connection);
    const [rows] = await connection.query('SELECT discord_id FROM users WHERE id = ?', [req.user.id]);
    const discordId = rows[0]?.discord_id;

    if (discordId) {
      try {
        const roleId = await getActiveRoleId();
        if (roleId) await removeRole(discordId, roleId);
      } catch (error) {
        console.error('Discord disconnect role removal failed:', error.message);
      }
    }

    await connection.query(
      'UPDATE users SET discord_id = NULL, discord_username = NULL, discord_connected_at = NULL WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection.release();
  }
});

export default router;
