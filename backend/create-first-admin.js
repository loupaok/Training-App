#!/usr/bin/env node

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function createFirstAdmin() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'coach_management'
    });

    console.log('\n✓ Connected to database');

    // Check if admin exists
    const [admins] = await connection.query(
      "SELECT id FROM users WHERE role = 'admin'"
    );

    if (admins.length > 0) {
      console.log('✓ Admin user already exists');
      await connection.end();
      return;
    }

    // Create first admin
    const adminData = {
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 10),
      fullName: 'Admin User',
      role: 'admin'
    };

    const [result] = await connection.query(
      'INSERT INTO users (email, password, full_name, role, created_at) VALUES (?, ?, ?, ?, NOW())',
      [adminData.email, adminData.password, adminData.fullName, adminData.role]
    );

    console.log('\n✅ Admin user created!');
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`🔐 Password: admin123`);
    console.log(`🆔 Admin ID: ${result.insertId}`);
    console.log('\n⚠️  CHANGE THIS PASSWORD IMMEDIATELY!\n');

    await connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createFirstAdmin();
