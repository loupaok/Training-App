# 🚀 Coach Management App - Quick Start Guide

## ✅ Project Structure

Το project έχει δημιουργηθεί με την εξής δομή:

```
Training App/
├── backend/
│   ├── src/
│   │   ├── index.js              ← Main Express server
│   │   ├── middleware/
│   │   │   └── auth.js           ← JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.js           ← Register/Login
│   │   │   ├── coaches.js        ← Coach endpoints
│   │   │   └── clients.js        ← Client endpoints
│   │   └── database/
│   │       └── schema.sql        ← Database tables
│   ├── uploads/                  ← File storage directory
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx   ← Auth state management
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── services/
│   │   │   └── api.js            ← API client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── .env                          ← Environment variables
├── .env.example                  ← Configuration template
├── .gitignore                    ← Git ignore rules
└── README.md
```

## 🔧 Installation Steps

### 1️⃣ Backend Setup
```bash
cd backend
npm install
```

### 2️⃣ Frontend Setup
```bash
cd frontend
npm install
```

### 3️⃣ Database Setup

**Δημιουργήστε database:**
```sql
CREATE DATABASE coach_management;
USE coach_management;
```

**Τρέξτε το schema:**
- Ανοίξτε `backend/src/database/schema.sql`
- Εκτελέστε τα SQL statements στη MySQL (ή phpMyAdmin)

### 4️⃣ Environment Configuration

Ενημερώστε το `.env` με τα credentials σας:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=coach_management
JWT_SECRET=your_secret_key_here
```

## ▶️ Running the Application

### Επιλογή 1: Δύο Terminal Windows

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Επιλογή 2: Χρήση VS Code Terminal

Press `Ctrl + ` για να ανοίξετε το terminal και τρέξτε τις παραπάνω εντολές σε δύο tabs.

## 🌐 Access the App

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

## 📝 Default Test Credentials

Δημιουργήστε νέα accounts:
1. Πηγαίνετε στο Register page
2. Συμπληρώστε τα στοιχεία
3. Επιλέξτε role (Coach ή Client)
4. Κάντε login

## 📚 Key Features Implemented

✅ **Authentication**
- JWT-based auth
- Register/Login
- Role-based access (coach/client)

✅ **Backend**
- Express REST API
- MySQL database integration
- File upload support (Multer)
- Cron jobs ready
- Validation middleware

✅ **Frontend**
- React 18 with Hooks
- React Router for navigation
- Context API for state management
- Tailwind CSS for styling
- Vite for fast development

✅ **Database**
- Users table with roles
- Coach-Clients relationship
- Sessions tracking
- Goals management

## 🔌 API Endpoints (Quick Reference)

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`

### Coaches
- `GET /api/coaches` - List all coaches
- `GET /api/coaches/:id` - Get coach profile
- `PUT /api/coaches/:id` - Update coach profile

### Clients
- `GET /api/clients` - Get assigned clients
- `GET /api/clients/:id` - Get client profile
- `POST /api/clients/:clientId/assign` - Assign client to coach

## 🚨 Common Issues & Solutions

### "Cannot connect to database"
→ Check .env credentials and MySQL is running

### "Module not found" errors
→ Run `npm install` in backend & frontend

### "Port already in use"
→ Change PORT in .env or close other processes

### Frontend can't reach backend
→ Check FRONTEND_URL in .env and vite proxy config

## 📦 Next Steps

1. Test the registration and login flow
2. Add more pages/components as needed
3. Implement messaging system
4. Add notifications
5. Build admin dashboard
6. Deploy to production

## 🎯 Useful Commands

**Backend Development:**
- `npm run dev` - Start with auto-reload
- `npm start` - Production start

**Frontend Development:**
- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 📄 Important Files to Know

- `backend/src/index.js` - Backend entry point
- `frontend/src/App.jsx` - Frontend routing
- `backend/src/database/schema.sql` - Database schema
- `.env` - Configuration (don't commit this!)
- `package.json` - Dependencies

---

**Happy Coding! 🎉**
