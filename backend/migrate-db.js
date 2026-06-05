#!/usr/bin/env node

import mysql from 'mysql2/promise';

async function runMigration() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'coach_management'
    });

    console.log('✓ Connected to database');

    // Check if role column needs update
    const [columns] = await connection.query(
      "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='role'"
    );

    if (columns.length > 0 && !columns[0].COLUMN_TYPE.includes('admin')) {
      console.log('Updating role column...');
      await connection.query(
        "ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'coach', 'client') NOT NULL DEFAULT 'client'"
      );
      console.log('✓ Role column updated');
    } else {
      console.log('✓ Role column already has admin role');
    }

    await connection.end();
    console.log('✓ Migration completed\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();
