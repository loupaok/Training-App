-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'moderator', 'coach', 'client') NOT NULL DEFAULT 'client',
  profile_photo VARCHAR(255),
  bio TEXT,
  specializations VARCHAR(255),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
);

-- Create coach_clients junction table
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
  INDEX idx_client_id (client_id)
);

-- Create sessions table (for coaching sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coach_id INT NOT NULL,
  client_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_at DATETIME NOT NULL,
  duration INT,
  status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_coach_id (coach_id),
  INDEX idx_client_id (client_id),
  INDEX idx_scheduled_at (scheduled_at)
);

-- Extended client profile details (1:1 with users where role='client')
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  date_of_birth DATE,
  gender ENUM('male', 'female', 'other'),
  phone VARCHAR(30),
  height_cm DECIMAL(5,2),
  weight_kg DECIMAL(5,2),
  fitness_goal TEXT,
  medical_notes TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);

-- Subscription plans available on the platform
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  coach_id INT,
  plan_name VARCHAR(100) NOT NULL,
  plan_type ENUM('monthly', 'quarterly', 'semi_annual', 'annual', 'custom') NOT NULL DEFAULT 'monthly',
  price DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  start_date DATE NOT NULL,
  end_date DATE,
  status ENUM('active', 'expiring_soon', 'paused', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_end_date (end_date)
);

-- Social media links for coaches and clients
CREATE TABLE IF NOT EXISTS social_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  platform ENUM('instagram', 'facebook', 'youtube', 'tiktok', 'twitter', 'linkedin', 'website', 'other') NOT NULL,
  url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_platform (user_id, platform),
  INDEX idx_user_id (user_id)
);

-- Progress check-in updates submitted by clients
CREATE TABLE IF NOT EXISTS progress_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  coach_id INT,
  weight_kg DECIMAL(5,2),
  body_fat_pct DECIMAL(4,1),
  muscle_mass_kg DECIMAL(5,2),
  waist_cm DECIMAL(5,2),
  hips_cm DECIMAL(5,2),
  chest_cm DECIMAL(5,2),
  mood_score TINYINT CHECK (mood_score BETWEEN 1 AND 10),
  energy_score TINYINT CHECK (energy_score BETWEEN 1 AND 10),
  sleep_hours DECIMAL(3,1),
  notes TEXT,
  coach_feedback TEXT,
  reviewed_at TIMESTAMP NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_client_id (client_id),
  INDEX idx_submitted_at (submitted_at)
);

-- Photos attached to progress updates
CREATE TABLE IF NOT EXISTS progress_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  progress_update_id INT NOT NULL,
  client_id INT NOT NULL,
  photo_url VARCHAR(500) NOT NULL,
  angle ENUM('front', 'back', 'side_left', 'side_right', 'other') DEFAULT 'other',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (progress_update_id) REFERENCES progress_updates(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_progress_update_id (progress_update_id),
  INDEX idx_client_id (client_id)
);

-- Schedule defining when a client must submit progress updates
CREATE TABLE IF NOT EXISTS update_schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coach_id INT NOT NULL,
  client_id INT NOT NULL,
  frequency ENUM('daily', 'weekly', 'biweekly', 'monthly') NOT NULL DEFAULT 'weekly',
  day_of_week TINYINT CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday
  day_of_month TINYINT CHECK (day_of_month BETWEEN 1 AND 31),
  reminder_enabled TINYINT(1) NOT NULL DEFAULT 1,
  next_due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_coach_client_schedule (coach_id, client_id),
  INDEX idx_client_id (client_id),
  INDEX idx_next_due_date (next_due_date)
);

-- Training plans created by coaches and assigned to clients
CREATE TABLE IF NOT EXISTS training_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coach_id INT NOT NULL,
  client_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_weeks TINYINT UNSIGNED,
  difficulty ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'intermediate',
  is_template TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('draft', 'active', 'completed', 'archived') NOT NULL DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_coach_id (coach_id),
  INDEX idx_client_id (client_id),
  INDEX idx_status (status)
);

-- Nutrition plans created by coaches and assigned to clients
CREATE TABLE IF NOT EXISTS nutrition_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coach_id INT NOT NULL,
  client_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  daily_calories INT UNSIGNED,
  protein_g DECIMAL(6,1),
  carbs_g DECIMAL(6,1),
  fat_g DECIMAL(6,1),
  notes TEXT,
  is_template TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('draft', 'active', 'completed', 'archived') NOT NULL DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_coach_id (coach_id),
  INDEX idx_client_id (client_id),
  INDEX idx_status (status)
);

-- Exercises / sets within a training plan
CREATE TABLE IF NOT EXISTS reps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  training_plan_id INT NOT NULL,
  day_number TINYINT UNSIGNED NOT NULL DEFAULT 1,
  exercise_name VARCHAR(255) NOT NULL,
  sets TINYINT UNSIGNED,
  reps_per_set VARCHAR(50),  -- e.g. "8-12" or "AMRAP"
  rest_seconds VARCHAR(50),
  weight_kg DECIMAL(6,2),
  duration_seconds SMALLINT UNSIGNED,
  distance_m INT UNSIGNED,
  notes TEXT,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (training_plan_id) REFERENCES training_plans(id) ON DELETE CASCADE,
  INDEX idx_training_plan_id (training_plan_id),
  INDEX idx_day_number (day_number)
);

-- Payment records for client subscriptions
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  coach_id INT,
  subscription_id INT,
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  method ENUM('cash', 'bank_transfer', 'card', 'paypal', 'stripe', 'other') DEFAULT 'other',
  status ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  reference_number VARCHAR(100),
  notes TEXT,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_paid_at (paid_at)
);

-- Refresh tokens for persistent sessions
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(512) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at)
);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  coach_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
  progress INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_client_id (client_id),
  INDEX idx_coach_id (coach_id)
);
