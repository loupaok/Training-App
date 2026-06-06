-- ========================================
-- Coach Management App - Database Setup
-- ========================================

-- Create Database
CREATE DATABASE IF NOT EXISTS coach_management;
USE coach_management;

-- ========================================
-- Create users table
-- ========================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'moderator', 'coach', 'client') NOT NULL DEFAULT 'client',
  profile_photo VARCHAR(255),
  bio TEXT,
  specializations VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
);

-- ========================================
-- Create coach_clients junction table
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
  INDEX idx_client_id (client_id)
);

-- ========================================
-- Create sessions table (for coaching sessions)
-- ========================================
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

-- ========================================
-- Create goals table
-- ========================================
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

-- ========================================
-- Verify tables created
-- ========================================
SHOW TABLES;
SHOW DATABASES;

-- Setup Complete!
-- You can now use the app and register users
