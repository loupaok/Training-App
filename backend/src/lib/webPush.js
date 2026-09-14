import webpush from 'web-push';
import { pool } from '../index.js';

// Read lazily (not at module-load time): index.js calls dotenv.config() after its
// imports resolve, so a top-level process.env read here would always see undefined.
let vapidReady = false;
function ensureVapidConfigured() {
  if (vapidReady) return;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidReady = true;
  }
}

export function isPushConfigured() {
  ensureVapidConfigured();
  return vapidReady;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

async function sendToSubscription(connection, subscription, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth }
      },
      JSON.stringify(payload)
    );
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await connection.query('DELETE FROM push_subscriptions WHERE id = ?', [subscription.id]);
    } else {
      console.error('Web push send failed:', error.message);
    }
  }
}

// Sends a browser push notification to every subscribed device of one user.
// No-ops silently when VAPID keys aren't configured, so the feature works with zero setup.
export async function sendPushToUser(userId, payload) {
  if (!isPushConfigured()) return;

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id WHERE ps.user_id = ? AND u.push_enabled = 1',
      [userId]
    );
    for (const subscription of rows) {
      await sendToSubscription(connection, subscription, payload);
    }
  } finally {
    connection.release();
  }
}

export async function sendPushToUsers(userIds, payload) {
  if (!isPushConfigured() || !userIds.length) return;

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id WHERE ps.user_id IN (?) AND u.push_enabled = 1`,
      [userIds]
    );
    for (const subscription of rows) {
      await sendToSubscription(connection, subscription, payload);
    }
  } finally {
    connection.release();
  }
}
