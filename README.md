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

**Backend**

- Node.js
- Express
- MySQL / MariaDB
- multer (file uploads)
- node-cron (scheduled jobs)
- nodemailer (email / Office 365)
- jsonwebtoken (auth)
- bcrypt (password hashing)

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

Frontend → [http://localhost:3000](http://localhost:3000)
Backend  → [http://localhost:5000](http://localhost:5000)

Environment variables needed in
backend/.env:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=coach_management

JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_secret

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

BANK_IBAN=
BANK_NAME=
BANK_BENEFICIARY=
```

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
