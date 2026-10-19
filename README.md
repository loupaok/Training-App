# Coach Management App

A full-stack platform for online
personal coaching — manage clients,
training & nutrition plans,
weekly updates, and payments.

## Stack

**Frontend**

- React 18
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn UI
- dnd-kit (drag & drop)
- Recharts / Tremor (charts)
- Lucide React (icons)
- Capacitor (native iOS / Android shell)

**Backend**

- Node.js
- Express
- MySQL / MariaDB
- multer (file uploads)
- node-cron (scheduled jobs)
- nodemailer (email / Office 365)
- jsonwebtoken (auth)
- bcrypt (password hashing)
- Firebase Admin SDK (native push notifications)

**Database**

- MySQL / MariaDB
- XAMPP (local development)

**Storage**

- Local filesystem
- uploads/media/exercises/
- uploads/media/foods/
- uploads/media/progress/
- uploads/media/branding/

## Run it

Prerequisites:

- Node.js 18+
- MySQL / MariaDB on port 3306
- XAMPP (recommended for local)
- Android Studio for Android builds
- Xcode on macOS for iOS builds

Install and start:

```bash
# Backend

cd backend
npm install
npm run dev

# Frontend (new terminal)

cd frontend
npm install
npm run dev
```

Before the first run, copy `backend/.env.example` to `backend/.env` and
`frontend/.env.example` to `frontend/.env.local`, then fill in only the values
needed for your environment. Real environment files and production credentials
must never be committed.

Frontend → [http://localhost:3000](http://localhost:3000)
Backend  → [http://localhost:5000](http://localhost:5000)
Moible   →  http://192.168.1.4:3000/login


Environment variables needed in
backend/.env:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=coach_management

JWT_SECRET=your_secret

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

BANK_IBAN=
BANK_NAME=
BANK_BENEFICIARY=
```

For all supported configuration values, security limits, Discord, Firebase, and
backup options, use [`backend/.env.example`](backend/.env.example). Browser-safe
frontend settings are documented in [`frontend/.env.example`](frontend/.env.example).

### Backups

From `backend`, create a database plus uploads backup:

```bash
npm run backup
npm run backup:verify -- backups/<timestamp>
```

Set `DB_DUMP_BIN` if `mysqldump` is not on the server PATH. With XAMPP on
Windows it is commonly `C:\xampp\mysql\bin\mysqldump.exe`. Schedule the backup
command daily and keep encrypted copies away from the application server. See
[the production launch checklist](PRODUCTION_LAUNCH_CHECKLIST.md) for the
required restore test and release checks.

### Native push notifications

Native push notifications are optional. To enable FCM delivery, add these values
to `backend/.env` after creating a Firebase service account:

```env
# Enables FCM delivery. If omitted, the application safely skips native push.
FCM_SERVER_KEY=enabled

# One-line JSON contents of the Firebase service-account key file.
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

The `push_token` column is added automatically the first time the push-token
endpoint is used. The corresponding SQL migration is also available at
`backend/src/database/migrations/20261018_add_push_token.sql`.

### Capacitor mobile apps

The iOS and Android shells load the hosted application rather than a static
export. Before building a native app, replace `https://yoursite.com` in
`frontend/capacitor.config.ts` with the production HTTPS URL of this app.

For local browser testing only, the current mobile URL is
`http://192.168.1.4:3000/login`. Do not use this HTTP LAN URL as the
production Capacitor `server.url`.

The mobile client must also know the public API URL. Create `frontend/.env.local`
or set the deployment environment variable:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.yoursite.com/api
```

Sync and open the native projects:

```bash
cd frontend
npx cap sync
npx cap open android
npx cap open ios # macOS only
```

Push permissions are requested only after a successful native login or
registration. The browser version does not request native push permissions.

## Login

**Admin / Coach:**
URL: [http://localhost:3000/login](http://localhost:3000/login)
Email: [admin@example.com](mailto:admin@example.com)
Password: admin123

**Client:**
URL: [http://localhost:3000/login](http://localhost:3000/login)
Email: (client email)
Password: (set during registration)

**New client registration:**
URL: [http://localhost:3000/register](http://localhost:3000/register)

## Roles

| Role      | Access                          |
| --------- | ------------------------------- |
| admin     | Full access — all pages,        |
|           | settings, user management       |
| coach     | Clients, plans, content,        |
|           | updates, questionnaire          |
| moderator | View and edit clients,          |
|           | read-only elsewhere             |
| client    | Own dashboard, training plan,   |
|           | nutrition plan, weekly updates, |
|           | progress, payments              |

---


