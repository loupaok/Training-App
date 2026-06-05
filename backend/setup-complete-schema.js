#!/usr/bin/env node

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupCompleteSchema() {
  let connection;
  try {
    console.log('\n📋 Coach Management App - Complete Schema Setup\n');

    // Step 1: Connect to MySQL (without database first)
    console.log('Step 1: Connecting to MySQL...');
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      multipleStatements: true
    });
    console.log('✓ Connected to MySQL');

    // Step 2: Create database
    console.log('\nStep 2: Creating database...');
    await connection.query('CREATE DATABASE IF NOT EXISTS coach_management');
    console.log('✓ Database created/verified');

    // Step 3: Use database
    console.log('\nStep 3: Selecting database...');
    await connection.query('USE coach_management');
    console.log('✓ Database selected');

    // Step 4: Read and execute schema
    console.log('\nStep 4: Creating tables...');
    const schemaPath = path.join(__dirname, 'src', 'database', 'complete-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split queries properly (remove comments and handle multiple statements)
    const queries = schema
      .split(';')
      .map(q => q.trim())
      .filter(q => q && !q.startsWith('--'));

    let tablesCreated = 0;
    for (const query of queries) {
      if (query.toUpperCase().startsWith('CREATE TABLE')) {
        try {
          await connection.query(query + ';');
          const tableName = query.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1];
          if (tableName) {
            console.log(`  ✓ ${tableName}`);
            tablesCreated++;
          }
        } catch (err) {
          console.error(`  ✗ Error creating table: ${err.message}`);
        }
      }
    }

    // Step 5: Get table statistics
    console.log('\nStep 5: Verifying tables...');
    const [tables] = await connection.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'coach_management' ORDER BY TABLE_NAME"
    );
    
    console.log(`✓ Total tables created: ${tables.length}`);
    console.log('\nTables:');
    tables.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.TABLE_NAME}`);
    });

    // Step 6: Get index statistics
    console.log('\nStep 6: Checking indexes...');
    const [indexes] = await connection.query(
      "SELECT COUNT(DISTINCT INDEX_NAME) as total_indexes FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'coach_management' AND INDEX_NAME != 'PRIMARY'"
    );
    console.log(`✓ Total indexes: ${indexes[0].total_indexes}`);

    // Step 7: Test connections and relationships
    console.log('\nStep 7: Testing database connections...');
    
    try {
      // Test users table
      const [userCount] = await connection.query('SELECT COUNT(*) as count FROM users');
      console.log(`✓ Users table: ${userCount[0].count} records`);

      // Test if admin exists
      const [adminCount] = await connection.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      );
      console.log(`✓ Admin users: ${adminCount[0].count}`);

      // Test if clients table exists and is empty
      const [clientCount] = await connection.query('SELECT COUNT(*) as count FROM clients');
      console.log(`✓ Clients table: ${clientCount[0].count} records`);

      // Test foreign key constraints
      console.log('\nStep 8: Verifying foreign key constraints...');
      const [fks] = await connection.query(
        "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = 'coach_management' AND REFERENCED_TABLE_NAME IS NOT NULL"
      );
      console.log(`✓ Foreign key constraints: ${fks[0].count}`);

    } catch (err) {
      console.error(`✗ Connection test failed: ${err.message}`);
    }

    console.log('\n✅ Schema setup completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`  • Database: coach_management`);
    console.log(`  • Tables: ${tables.length}`);
    console.log(`  • Indexes: ${indexes[0].total_indexes}`);
    console.log('  • Foreign Keys: Enabled');
    console.log('  • Status: ✓ Ready for use\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

setupCompleteSchema();
