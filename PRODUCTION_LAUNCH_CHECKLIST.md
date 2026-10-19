# Production Launch Checklist

Use this checklist before every production launch. Do not store credentials, dumps, or uploaded client files in Git.

## Environment and infrastructure

- [ ] Create production `backend/.env` and `frontend/.env.local` from the example files.
- [ ] Generate new, unique `JWT_SECRET`, SMTP settings encryption, and Discord settings encryption secrets.
- [ ] Configure `FRONTEND_URL` and `CORS_ORIGINS` with only the live HTTPS domains.
- [ ] Set `TRUST_PROXY=1` behind the hosting proxy and enable HTTPS redirects at the proxy.
- [ ] Use a dedicated MariaDB user with only the application's required privileges.
- [ ] Confirm uploads are stored outside the public source repository and are backed up.

## Security checks

- [ ] Verify security headers, CSP, CORS, rate limits, and upload limits in production.
- [ ] Resolve or formally accept every production dependency vulnerability reported by `npm audit`; do not launch with unresolved critical findings.
- [ ] Confirm only administrators can upload SVG assets; test invalid image uploads are rejected.
- [ ] Change or remove demo/test accounts and rotate their credentials.
- [ ] Review package vulnerabilities with `npm audit` and upgrade deliberately after testing.
- [ ] Configure error tracking and uptime monitoring for frontend, backend, database, and email delivery.

## Backups and recovery

- [ ] Run `npm run backup` from `backend` on a schedule at least daily.
- [ ] Store encrypted backups in a separate location from the application server.
- [ ] Run `npm run backup:verify -- backups/<timestamp>` after each new backup process is set up.
- [ ] Perform and document a MariaDB plus uploads restore test before launch.

## Core user journeys

- [ ] Register a new client, accept legal consent, complete payment, and approve the subscription.
- [ ] Test card and bank-transfer flows, including renewal, plan change, expiry, and coach approval.
- [ ] Test password reset, SMTP email delivery, notifications, messages, Discord role changes, and push notifications on a physical device.
- [ ] Test coach updates, progress photos, nutrition, workouts, offline client behavior, and responsive layouts.
- [ ] Test authorization boundaries as Admin, Moderator, Coach, and Client.

## Privacy and legal

- [ ] Replace placeholder business/contact details on `/privacy` and `/terms`.
- [ ] Obtain legal review of privacy notice, terms, consent wording, retention schedule, and processor agreements.
- [ ] Confirm the account export/delete process and the retention policy for progress photos and medical files.
- [ ] Record the lawful basis and operational process for handling health-related data.
