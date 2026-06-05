#!/usr/bin/env node

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  let connection;
  try {
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'src', 'database', 'init.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Connect to MySQL
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      multipleStatements: true
    });

    console.log('✓ Connected to MySQL');

    // Execute the SQL
    await connection.query(sql);
    console.log('✓ Database and tables created successfully!');
    console.log('✓ Database name: coach_management');
    console.log('✓ Tables: users, coach_clients, sessions, goals');

  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

setupDatabase();
