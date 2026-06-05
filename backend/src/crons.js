import cron from 'node-cron';
import nodemailer from 'nodemailer';
import fs from 'fs';
import { pool } from './index.js';

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

async function sendMail(to, subject, html) {
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your_email@gmail.com') {
    console.log(`[EMAIL SKIPPED] To: ${to} | Subject: ${subject}`);
    return;
  }
  await mailer.sendMail({ from: process.env.SMTP_USER, to, subject, html });
}

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

console.log('✓ Cron jobs registered');
