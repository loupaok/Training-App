# Coach Management App

A coaching business platform: coaches manage clients, training plans, nutrition plans, exercise
library, media, and pricing; clients get their own portal to view plans, log progress, and handle
billing. Role-based access across admin / coach / moderator / client.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Tremor (charts) |
| Backend | Node.js, Express 4, no ORM (raw SQL via `mysql2`) |
| Database | MySQL 8+ |
| Auth | JWT (access + refresh tokens), bcrypt password hashing |
| Extras | Multer (file uploads), Node-Cron (scheduled tasks), Nodemailer |

## What's included

**Coach / admin side** (`Dashboard.jsx`, `AdminDashboard.jsx`, `Clients.jsx`, `ClientDetail.jsx`,
`ClientUpdates.jsx`, `Exercises.jsx`, `MediaLibrary.jsx`, `Analytics.jsx`, `Notifications.jsx`,
`Team.jsx`, `PricingPlans.jsx`):
- Client roster, individual client detail/management, approve or reject payments
- Training plans and nutrition plans per client, rep tracking
- Exercise library (876 seeded exercises, images/video, Greek-localized descriptions)
- Media library with folders
- Progress tracking (photos + updates) per client
- Pricing plans (public list + admin management)
- Team view of coaches, system stats and admin user management

**Client portal** (`ClientOnboarding.jsx`, `ClientDashboard.jsx`, `ClientProgram.jsx`,
`ClientPending.jsx`, `ClientExpired.jsx`, `ClientBilling.jsx`, `ClientNotifications.jsx`,
`ClientProfile.jsx`):
- Onboarding flow, profile, billing (submit payment proof)
- View assigned training/nutrition program
- Weekly progress updates with photo upload
- Own notification feed

## Run it

```bash
# 1. Start MySQL (XAMPP Control Panel → Start MySQL)
# 2. Backend
cd backend
npm install
npm run db:init              # creates the coach_management database + tables
npm run db:exercises         # seeds the exercise library
node create-first-admin.js   # creates the first admin login
npm run dev                  # http://localhost:5000

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev                  # http://localhost:3000, rewrites /api and /uploads to the backend
```

Frontend config lives in `frontend/.env.local` (gitignored): `BACKEND_ORIGIN=http://localhost:5000` tells
`next.config.ts`'s rewrites where to proxy `/api/*` and `/uploads/*` — the browser never talks to the
backend's origin directly, so there's nothing client-visible to configure beyond that one variable.

### Login

| Role | Email | Password |
| --- | --- | --- |
| admin | admin@example.com | admin123 |

**Change this password immediately after first login.** There's no self-service admin creation
after that — additional coaches/admins are created from the Admin Panel (`/admin`) or via
`node create-coach.js`. Clients register themselves through `/register` (client role only).

### Roles

| Role | Access |
| --- | --- |
| `admin` | Everything: user/coach management, system stats, all client data, pricing plans |
| `coach` | Their assigned clients: training/nutrition plans, progress, media, exercises |
| `moderator` | Read-only: view clients, exercises, media, notifications — no create/edit/delete |
| `client` | Their own portal only: profile, billing, assigned program, progress updates |

## Database

Recreate with `npm run db:init` (reads `backend/src/database/schema.sql`) — this is the **only**
schema file that matters. `complete-schema.sql` and `init.sql` in the same folder are abandoned
earlier drafts from before the project settled on its current schema; don't use them, and consider
deleting them if you want to avoid the same confusion again.

Tables: `users`, `coach_clients`, `sessions`, `goals`, `clients`, `training_plans`, `nutrition_plans`,
`reps`, `subscriptions`, `payments`, `progress_updates`, `progress_photos`, `social_links`,
`update_schedule`, `refresh_tokens`.

## API reference

All routes except `/api/auth/*`, `GET /api/coaches`, `GET /api/coaches/:id`, `GET /api/pricing-plans`,
and `GET /api/health` require a valid JWT (`Authorization: Bearer <token>`).

| Base path | Notes |
| --- | --- |
| `/api/auth` | register (client only), login, refresh/refresh-token, logout, me, profile |
| `/api/admin` | admin-only: users, coaches, clients, stats |
| `/api/coaches` | list/get public, update own profile (coach) |
| `/api/clients` | coach/admin/moderator manage clients; `/me/*` sub-routes are the client's own profile/onboarding/billing/notifications |
| `/api/client-dashboard` | client-only: dashboard data, weekly progress update with photos |
| `/api/training-plans`, `/api/nutrition-plans`, `/api/reps` | coach/admin manage per-client plans |
| `/api/subscriptions` | coach/admin |
| `/api/progress` | coach/admin: progress entries + photos |
| `/api/exercises` | coach/admin/moderator read; coach/admin write (incl. images/video) |
| `/api/media` | coach/admin/moderator read; coach/admin write, folders |
| `/api/pricing-plans` | public read; admin write |
| `GET /api/health` | health check |

## Environment

Copy `.env.example` to `.env` in `backend/` and fill in `DB_PASSWORD`/`JWT_SECRET` for your machine.
Uploaded files are gitignored and live in `backend/uploads/` — back those up separately from git if
you care about keeping them (client photos, exercise images, etc.).

## Troubleshooting

- **"Cannot connect to database"** — check `backend/.env` credentials and that MySQL is running.
- **"Module not found"** — run `npm install` in both `backend/` and `frontend/`.
- **Port already in use** — change `PORT` in `backend/.env`, or stop whatever else is on 5000/3000.
- **Frontend can't reach the backend** — check `BACKEND_ORIGIN` in `frontend/.env.local` matches where
  the backend actually runs (`next.config.ts`'s rewrites proxy `/api` and `/uploads` there).
