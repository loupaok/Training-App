#!/usr/bin/env node

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  try {
    console.log('\n🔐 Coach/Admin User Creator\n');

    // Get input
    const fullName = await question('Full Name: ');
    const email = await question('Email: ');
    const password = await question('Password: ');
    const specializations = await question('Specializations (optional): ');
    const role = await question('Role (coach/admin) [coach]: ') || 'coach';

    if (!['coach', 'admin'].includes(role)) {
      console.error('❌ Invalid role. Must be coach or admin');
      rl.close();
      process.exit(1);
    }

    // Connect to database
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'coach_management'
    });

    console.log('\n✓ Connected to database');

    // Check if email exists
    const [existingUser] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      console.error('❌ Email already exists');
      await connection.end();
      rl.close();
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await connection.query(
      'INSERT INTO users (email, password, full_name, role, specializations, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [email, hashedPassword, fullName, role, specializations || null]
    );

    console.log(`\n✅ ${role.toUpperCase()} created successfully!`);
    console.log(`ID: ${result.insertId}`);
    console.log(`Email: ${email}`);
    console.log(`Role: ${role}\n`);

    await connection.end();
    rl.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();
