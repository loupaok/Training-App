import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: { ciphers: 'SSLv3' }
});

function interpolateTemplate(value, variables) {
  return String(value || '').replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables?.[key] ?? ''));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function wrapStoredTemplate(body) {
  return `
<div style="background:#f5f6fa;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <div style="padding:32px;color:#1f2430;line-height:1.6;white-space:pre-line;">
      ${escapeHtml(body).replace(/\n/g, '<br>')}
    </div>
    <div style="padding:16px 32px;background:#f5f6fa;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9aa0a6;">${escapeHtml(process.env.EMAIL_FROM_NAME || 'CoachApp')}</p>
    </div>
  </div>
</div>`;
}

export async function getEmailTemplate(templateKey, variables, conn) {
  let connection = conn;
  let ownsConnection = false;

  try {
    if (!connection) {
      const { pool } = await import('../index.js');
      connection = await pool.getConnection();
      ownsConnection = true;
    }

    const [rows] = await connection.query(
      'SELECT subject, body FROM email_templates WHERE template_key = ? LIMIT 1',
      [templateKey]
    );
    if (!rows.length) return null;

    return {
      subject: interpolateTemplate(rows[0].subject, variables),
      html: wrapStoredTemplate(interpolateTemplate(rows[0].body, variables)),
    };
  } catch (error) {
    console.warn(`Email template lookup failed for ${templateKey}:`, error.message);
    return null;
  } finally {
    if (ownsConnection && connection) connection.release();
  }
}

// Accepts either sendMail({ to, subject, html }) or the legacy sendMail(to, subject, html).
export async function sendMail(arg1, arg2, arg3) {
  const { to, subject, html } = typeof arg1 === 'object' && arg1 !== null
    ? arg1
    : { to: arg1, subject: arg2, html: arg3 };

  if (!process.env.SMTP_USER) {
    console.warn('Email not configured - skipping');
    return { skipped: true };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const fromName = process.env.EMAIL_FROM_NAME;
  await transporter.sendMail({
    from: fromName ? `"${fromName}" <${from}>` : from,
    to,
    subject,
    html
  });
}
