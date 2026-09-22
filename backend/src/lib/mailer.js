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
