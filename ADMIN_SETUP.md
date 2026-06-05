# 🔐 Admin Panel & Role Management

## Overview

The system now supports three roles:
1. **Admin** - Manage coaches and system
2. **Coach** - Manage clients and training plans  
3. **Client** - Login and view assigned plans

---

## 🚀 Setup Instructions

### 1. Database Migration

Update existing databases:
```bash
cd backend
node migrate-db.js
```

### 2. Create First Admin

```bash
node create-first-admin.js
```

**Credentials:**
- Email: `admin@example.com`
- Password: `admin123`

⚠️ **CHANGE PASSWORD IMMEDIATELY!**

### 3. Create Additional Coaches/Admins

Interactive method:
```bash
node create-coach.js
```

---

## 📱 User Flows

### Admin Panel (`/admin`)
- View all coaches
- View all clients
- Create new coaches
- Delete coaches
- View system statistics

### Coach Dashboard (`/dashboard`)
- View assigned clients
- Manage training plans
- Track client progress

### Client Portal (`/dashboard`)
- View profile
- View assigned plans
- Submit progress
- Upload photos

---

## 🔌 API Endpoints

### Admin Routes (Protected)

```
POST   /api/admin/coaches              Create coach
GET    /api/admin/coaches              List all coaches
DELETE /api/admin/coaches/:coachId     Delete coach
GET    /api/admin/clients              List all clients
GET    /api/admin/stats                System statistics
```

### Authentication

All admin endpoints require:
- Valid JWT token
- User role = "admin"

---

## 🔐 Security Notes

- Passwords are hashed with bcryptjs
- Roles are enforced at API level
- Register page only allows client registration
- Coaches/Admins created manually by admin

---

## 📝 Database Schema

**Users Table:**
```sql
role ENUM('admin', 'coach', 'client') DEFAULT 'client'
```

---

## 🎯 Next Steps

1. Change admin password
2. Create coaches via Admin Panel
3. Assign coaches to clients
4. Add training/nutrition plans
5. Configure cron jobs for notifications
