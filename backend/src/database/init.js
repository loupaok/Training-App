import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initDatabase() {
  let connection;

  try {
    // Connect without specifying a database first so we can create it
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });

    const dbName = process.env.DB_NAME || 'coach_management';

    console.log(`Creating database "${dbName}" if it doesn't exist...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${dbName}\``);
    console.log(`✓ Using database "${dbName}"`);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema...');
    await connection.query(schema);
    console.log('✓ All tables created successfully');

    // Verify tables
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);
    console.log(`\nTables in "${dbName}":`);
    tableNames.forEach(t => console.log(`  - ${t}`));

    console.log('\n✓ Database initialised successfully');
  } catch (err) {
    console.error('✗ Database initialisation failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

initDatabase();
