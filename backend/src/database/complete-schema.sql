-- ========================================
-- Coach Management App - Complete Schema
-- ========================================

-- Drop existing tables (careful with this!)
-- DROP DATABASE IF EXISTS coach_management;
-- CREATE DATABASE coach_management;
USE coach_management;

-- ========================================
-- 1. USERS TABLE (Already exists, ensuring consistency)
-- ========================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'coach', 'client') NOT NULL DEFAULT 'client',
  profile_photo VARCHAR(255),
  bio TEXT,
  specializations VARCHAR(255),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_is_active (is_active)
);

-- ========================================
-- 2. CLIENTS TABLE (Extended user info for clients)
-- ========================================
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  coach_id INT NOT NULL,
  age INT,
  height DECIMAL(5, 2),
  current_weight DECIMAL(6, 2),
  goal_weight DECIMAL(6, 2),
  fitness_level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
  health_notes TEXT,
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_coach_id (coach_id),
  INDEX idx_user_id (user_id)
);

-- ========================================
-- 3. SUBSCRIPTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  coach_id INT NOT NULL,
  plan_type ENUM('basic', 'premium', 'elite') NOT NULL,
  status ENUM('active', 'paused', 'cancelled', 'expired') DEFAULT 'active',
  start_date DATE NOT NULL,
  end_date DATE,
  price DECIMAL(10, 2),
  billing_cycle ENUM('monthly', 'quarterly', 'yearly') DEFAULT 'monthly',
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_client_id (client_id),
  INDEX idx_coach_id (coach_id),
  INDEX idx_status (status),
  INDEX idx_start_date (start_date)
);

-- ========================================
-- 4. SOCIAL LINKS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS social_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  platform VARCHAR(50) NOT NULL,
  url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_platform (platform)
);

-- ========================================
-- 5. TRAINING PLANS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS training_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  coach_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_weeks INT DEFAULT 12,
  difficulty_level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'intermediate',
  status ENUM('active', 'draft', 'completed', 'archived') DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_client_id (client_id),
  INDEX idx_coach_id (coach_id),
  INDEX idx_status (status)
);

-- ========================================
-- 6. TRAINING PLAN DETAILS (Workout schedules)
-- ========================================
CREATE TABLE IF NOT EXISTS training_plan_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_plan_id INT NOT NULL,
  day_of_week INT DEFAULT 1,
  session_name VARCHAR(255),
  description TEXT,
  duration_minutes INT,
  rest_days INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (training_plan_id) REFERENCES training_plans(id) ON DELETE CASCADE,
  INDEX idx_training_plan_id (training_plan_id)
);

-- ========================================
-- 7. NUTRITION PLANS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS nutrition_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  coach_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  daily_calories INT,
  protein_grams INT,
  carbs_grams INT,
  fat_grams INT,
  status ENUM('active', 'draft', 'completed', 'archived') DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_client_id (client_id),
  INDEX idx_coach_id (coach_id),
  INDEX idx_status (status)
);

-- ========================================
-- 8. REPS TABLE (Exercise performance tracking)
-- ========================================
CREATE TABLE IF NOT EXISTS reps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  training_plan_id INT NOT NULL,
  exercise_name VARCHAR(255) NOT NULL,
  sets INT DEFAULT 3,
  reps_min INT,
  reps_max INT,
  weight DECIMAL(6, 2),
  weight_unit ENUM('kg', 'lbs') DEFAULT 'kg',
  notes TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (training_plan_id) REFERENCES training_plans(id) ON DELETE RESTRICT,
  INDEX idx_client_id (client_id),
  INDEX idx_date (date),
  INDEX idx_exercise_name (exercise_name)
);

-- ========================================
-- 9. PROGRESS UPDATES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS progress_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  coach_id INT NOT NULL,
  title VARCHAR(255),
  description TEXT,
  weight DECIMAL(6, 2),
  body_measurements TEXT,
  mood ENUM('great', 'good', 'ok', 'bad') DEFAULT 'ok',
  energy_level INT DEFAULT 5,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_client_id (client_id),
  INDEX idx_coach_id (coach_id),
  INDEX idx_created_at (created_at)
);

-- ========================================
-- 10. PROGRESS PHOTOS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS progress_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  progress_update_id INT,
  photo_url VARCHAR(500) NOT NULL,
  photo_type ENUM('front', 'side', 'back', 'full_body', 'other') DEFAULT 'other',
  caption TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (progress_update_id) REFERENCES progress_updates(id) ON DELETE CASCADE,
  INDEX idx_client_id (client_id),
  INDEX idx_progress_update_id (progress_update_id),
  INDEX idx_photo_type (photo_type)
);

-- ========================================
-- 11. UPDATE SCHEDULE TABLE (Cron job tracking)
-- ========================================
CREATE TABLE IF NOT EXISTS update_schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  coach_id INT NOT NULL,
  schedule_type ENUM('daily', 'weekly', 'biweekly', 'monthly') DEFAULT 'weekly',
  scheduled_day INT DEFAULT 1,
  scheduled_time TIME DEFAULT '08:00:00',
  is_active BOOLEAN DEFAULT TRUE,
  last_sent TIMESTAMP,
  next_scheduled TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_client_id (client_id),
  INDEX idx_is_active (is_active),
  INDEX idx_next_scheduled (next_scheduled)
);

-- ========================================
-- 12. PAYMENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50),
  payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  transaction_id VARCHAR(255) UNIQUE,
  invoice_url VARCHAR(500),
  payment_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT,
  INDEX idx_subscription_id (subscription_id),
  INDEX idx_payment_status (payment_status),
  INDEX idx_payment_date (payment_date)
);

-- ========================================
-- 13. COACH_CLIENTS JUNCTION TABLE (kept for compatibility)
-- ========================================
CREATE TABLE IF NOT EXISTS coach_clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coach_id INT NOT NULL,
  client_id INT NOT NULL,
  status ENUM('active', 'inactive', 'completed') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_coaching_pair (coach_id, client_id),
  INDEX idx_coach_id (coach_id),
  INDEX idx_client_id (client_id),
  INDEX idx_status (status)
);

-- ========================================
-- 14. EXERCISES LIBRARY TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS exercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  muscle_group VARCHAR(120) NOT NULL,
  secondary_muscles VARCHAR(255),
  equipment VARCHAR(255) NOT NULL,
  level ENUM('Αρχάριο', 'Μεσαίο', 'Δύσκολο') DEFAULT 'Αρχάριο',
  type VARCHAR(120) NOT NULL,
  image_url VARCHAR(600),
  video_url VARCHAR(600),
  instructions TEXT,
  programs_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_muscle_group (muscle_group),
  INDEX idx_equipment (equipment),
  INDEX idx_level (level),
  INDEX idx_type (type)
);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Check all tables created
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'coach_management' ORDER BY TABLE_NAME;

-- Count of tables
SELECT COUNT(*) as total_tables FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'coach_management';

-- List all indexes
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'coach_management' ORDER BY TABLE_NAME, INDEX_NAME;
