# Coach Management App

Ένα σύγχρονο web application για τη διαχείριση προγραμμάτων coaching με roles-based access control.

## 🏗️ Αρχιτεκτονική

```
coach-management/
├── backend/                 # Express.js API
│   ├── src/
│   │   ├── index.js        # Main server
│   │   ├── middleware/      # Authentication, validation
│   │   ├── routes/          # API endpoints
│   │   └── database/        # Database schema
│   ├── uploads/             # File storage
│   └── package.json
├── frontend/                # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── context/        # React Context
│   │   ├── components/     # Reusable components
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── .env                     # Environment variables
└── .gitignore
```

## 🚀 Installation

### Backend Setup

```bash
cd backend
npm install
```

### Frontend Setup

```bash
cd frontend
npm install
```

## 📋 Configuration

1. **Edit `.env` file** και συμπληρώστε τις database credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=coach_management
   JWT_SECRET=your_secret_key
   ```

2. **Setup Database**:
   - Δημιουργήστε τη database: `coach_management`
   - Τρέξτε το schema: `backend/src/database/schema.sql`

## ▶️ Running the App

**Terminal 1 - Backend**:
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

- Backend: http://localhost:5000
- Frontend: http://localhost:5173

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Δημιουργία λογαριασμού
- `POST /api/auth/login` - Σύνδεση

### Coaches
- `GET /api/coaches` - Λίστα coaches
- `GET /api/coaches/:id` - Προφίλ coach
- `PUT /api/coaches/:id` - Ενημέρωση προφίλ

### Clients
- `GET /api/clients` - Clients του coach
- `GET /api/clients/:id` - Προφίλ client
- `POST /api/clients/:clientId/assign` - Ανάθεση client σε coach

## 🔐 Features

- ✅ JWT Authentication
- ✅ Role-based Access Control (Coach & Client)
- ✅ File Upload (Profile Photos)
- ✅ MySQL Database Integration
- ✅ Cron Jobs for Scheduled Tasks
- ✅ Responsive UI with Tailwind CSS

## 🗄️ Database Tables

- `users` - Χρήστες (coaches & clients)
- `coach_clients` - Σχέση coaches-clients
- `sessions` - Coaching sessions
- `goals` - Client goals

## 📝 Next Steps

1. ✅ Εγκαταστήστε τα dependencies
2. ✅ Συνδέστε τη MySQL database
3. ✅ Δημιουργήστε λογαριασμούς
4. ✅ Προσθέστε περισσότερες σελίδες/components
5. ✅ Εφαρμόστε επιπλέον features (messaging, notifications, etc.)

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, MySQL, JWT, Multer, Node-Cron
- **Frontend**: React 18, Vite, Tailwind CSS, React Router
- **Database**: MySQL 8+

---

Created for Coach Management System
