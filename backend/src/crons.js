import cron from 'node-cron';
import fs from 'fs';
import { pool } from './index.js';
import { sendMail } from './lib/mailer.js';
import { updateReminderEmail, subscriptionExpiryEmail } from './lib/email-templates.js';

// ─── CRON 1 ──────────────────────────────────────────────────────────────────
// Daily 00:05 — update subscription statuses
// active → expiring_soon (≤7 days left)
// active/expiring_soon → expired (end_date passed)
cron.schedule('5 0 * * *', async () => {
  console.log('[CRON] Running subscription status update...');
  try {
    const connection = await pool.getConnection();

    // Mark expired
    const [expired] = await connection.query(
      `UPDATE subscriptions
       SET status = 'expired'
       WHERE end_date < CURDATE()
         AND status NOT IN ('cancelled', 'paused', 'expired')`
    );

    // Mark expiring soon (within 7 days)
    const [expiring] = await connection.query(
      `UPDATE subscriptions
       SET status = 'expiring_soon'
       WHERE end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         AND status = 'active'`
    );

    connection.release();
    console.log(`[CRON] Subscriptions — expired: ${expired.affectedRows}, expiring_soon: ${expiring.affectedRows}`);
  } catch (err) {
    console.error('[CRON] Subscription status update failed:', err.message);
  }
});

// ─── CRON 2 ──────────────────────────────────────────────────────────────────
// Daily 01:00 — keep only the 3 most recent progress updates worth of photos per client
cron.schedule('0 1 * * *', async () => {
  console.log('[CRON] Running photo cleanup...');
  try {
    const connection = await pool.getConnection();

    // Get all clients that have progress photos
    const [clients] = await connection.query(
      `SELECT DISTINCT client_id FROM progress_updates`
    );

    let totalDeleted = 0;

    for (const { client_id } of clients) {
      // Get all progress_update ids for this client ordered newest first
      const [updates] = await connection.query(
        `SELECT id FROM progress_updates WHERE client_id = ? ORDER BY submitted_at DESC`,
        [client_id]
      );

      // Keep the 3 most recent, delete photos from the rest
      const toDelete = updates.slice(3).map(u => u.id);
      if (toDelete.length === 0) continue;

      // Fetch photo paths before deleting
      const [photos] = await connection.query(
        `SELECT photo_url FROM progress_photos WHERE progress_update_id IN (?)`,
        [toDelete]
      );

      // Delete physical files
      photos.forEach(p => {
        if (fs.existsSync(p.photo_url)) {
          fs.unlinkSync(p.photo_url);
        }
      });

      // Delete DB rows (cascade from progress_updates not triggered — delete directly)
      if (photos.length > 0) {
        await connection.query(
          `DELETE FROM progress_photos WHERE progress_update_id IN (?)`,
          [toDelete]
        );
        totalDeleted += photos.length;
      }
    }

    connection.release();
    console.log(`[CRON] Photo cleanup — deleted ${totalDeleted} photo(s)`);
  } catch (err) {
    console.error('[CRON] Photo cleanup failed:', err.message);
  }
});

// ─── CRON 3 ──────────────────────────────────────────────────────────────────
// Daily 09:00 — send expiry notification emails
// - Client: notified on 7 days before expiry
// - Coach: notified on 3 days before expiry
cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] Running expiry notifications...');
  try {
    const connection = await pool.getConnection();

    // Subscriptions expiring in exactly 7 days → notify client
    const [clientSubs] = await connection.query(
      `SELECT s.id, s.plan_name, s.end_date,
              uc.email AS client_email, uc.full_name AS client_name
       FROM subscriptions s
       JOIN users uc ON uc.id = s.client_id
       WHERE s.end_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         AND s.status IN ('active', 'expiring_soon')`
    );

    for (const sub of clientSubs) {
      await sendMail(
        sub.client_email,
        'Your subscription is expiring soon',
        `<p>Hi ${sub.client_name},</p>
         <p>Your <strong>${sub.plan_name}</strong> subscription expires on <strong>${new Date(sub.end_date).toLocaleDateString('el-GR')}</strong>.</p>
         <p>Please contact your coach to renew.</p>`
      );
      console.log(`[CRON] Expiry email sent to client: ${sub.client_email}`);
    }

    // Subscriptions expiring in exactly 3 days → notify coach
    const [coachSubs] = await connection.query(
      `SELECT s.id, s.plan_name, s.end_date,
              uc.full_name AS client_name,
              uco.email AS coach_email, uco.full_name AS coach_name
       FROM subscriptions s
       JOIN users uc  ON uc.id  = s.client_id
       JOIN users uco ON uco.id = s.coach_id
       WHERE s.end_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
         AND s.status IN ('active', 'expiring_soon')`
    );

    for (const sub of coachSubs) {
      await sendMail(
        sub.coach_email,
        `Client subscription expiring in 3 days — ${sub.client_name}`,
        `<p>Hi ${sub.coach_name},</p>
         <p>Your client <strong>${sub.client_name}</strong>'s <strong>${sub.plan_name}</strong> subscription expires on <strong>${new Date(sub.end_date).toLocaleDateString('el-GR')}</strong>.</p>
         <p>You may want to reach out to arrange a renewal.</p>`
      );
      console.log(`[CRON] Expiry email sent to coach: ${sub.coach_email}`);
    }

    connection.release();
    console.log(`[CRON] Expiry notifications — clients: ${clientSubs.length}, coaches: ${coachSubs.length}`);
  } catch (err) {
    console.error('[CRON] Expiry notifications failed:', err.message);
  }
});

// ─── CRON 4 ──────────────────────────────────────────────────────────────────
// Daily 09:00 — remind clients whose weekly-update day is today and who
// haven't submitted a weekly update yet this week.
function getCurrentWeekStart() {
  const current = new Date();
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  current.setDate(diff);
  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(current.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] Running weekly update reminders...');
  try {
    const connection = await pool.getConnection();
    const todayDayOfWeek = new Date().getDay();
    const weekStart = getCurrentWeekStart();

    const [dueClients] = await connection.query(
      `SELECT u.id, u.email, u.full_name
       FROM users u
       JOIN update_schedule us ON us.client_id = u.id
       WHERE u.role = 'client' AND u.is_active = 1
         AND us.day_of_week = ?
         AND NOT EXISTS (
           SELECT 1 FROM weekly_updates wu WHERE wu.client_id = u.id AND wu.week_start = ?
         )`,
      [todayDayOfWeek, weekStart]
    );

    for (const client of dueClients) {
      const name = client.full_name || client.email;
      // /client/update (a dedicated submission page) doesn't exist yet — this
      // build never included one, so the reminder links to the real client
      // dashboard instead of a route that would 404.
      const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/client-dashboard`;
      try {
        await sendMail({ to: client.email, ...updateReminderEmail(name, dashboardUrl) });
        console.log(`Reminder sent to ${name}`);
      } catch (e) {
        console.error('Email failed', e);
      }
    }

    connection.release();
    console.log('Update reminders sent');
  } catch (e) {
    console.error('Cron error:', e);
  }
}, { timezone: 'Europe/Athens' });

// ─── CRON 5 ──────────────────────────────────────────────────────────────────
// Daily 08:00 — email clients whose subscription expires in exactly 7 days
// (separate from CRON 3's existing 09:00 expiry notifications, left untouched).
cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] Running subscription expiry reminders...');
  try {
    const connection = await pool.getConnection();

    const [expiringSubs] = await connection.query(
      `SELECT uc.email AS client_email, uc.full_name AS client_name
       FROM subscriptions s
       JOIN users uc ON uc.id = s.client_id
       WHERE s.end_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         AND s.status IN ('active', 'expiring_soon')`
    );

    for (const sub of expiringSubs) {
      const name = sub.client_name || sub.client_email;
      try {
        await sendMail({ to: sub.client_email, ...subscriptionExpiryEmail(name, 7) });
      } catch (e) {
        console.error('Email failed', e);
      }
    }

    connection.release();
    console.log('Subscription expiry reminders sent');
  } catch (e) {
    console.error('Cron error:', e);
  }
}, { timezone: 'Europe/Athens' });

console.log('✓ Cron jobs registered');
