# Coach Management App

A full-stack platform for online
personal coaching — manage clients,
training & nutrition plans,
weekly updates, and payments.

## Stack

**Frontend:** React · Next.js ·
TypeScript · Tailwind CSS · Shadcn UI

**Backend:** Node.js · Express

**Database:** MySQL / MariaDB

## Run it

**Prerequisites:**

- Node.js 18+
- MySQL / MariaDB running on port 3306

**Install & start:**

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

Frontend: [http://localhost:3000](http://localhost:3000)
Backend: [http://localhost:5000](http://localhost:5000)

## Login

Default admin account:
Email: [admin@example.com](mailto:admin@example.com)
Password: (set in your .env)

## Roles

| Role      | Access                         |
| --------- | ------------------------------ |
| admin     | Full access to everything      |
| coach     | Manage clients, plans, content |
| moderator | View and edit clients only     |
| client    | Own dashboard and updates      |
