import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const demoClients = [
  {
    fullName: 'Νίκος Αντωνίου',
    email: 'nikos@example.com',
    phone: '+30 694 123 4567',
    weightKg: 78.4,
    fitnessGoal: '75 kg',
  },
  {
    fullName: 'Μαρία Καραλή',
    email: 'maria@example.com',
    phone: '+30 694 234 5678',
    weightKg: 65.2,
    fitnessGoal: '60 kg',
  },
  {
    fullName: 'Κώστας Δημητρίου',
    email: 'kostas@example.com',
    phone: '+30 694 345 6789',
    weightKg: 84.1,
    fitnessGoal: '80 kg',
  },
  {
    fullName: 'Έλενα Παπαδάκη',
    email: 'elena@example.com',
    phone: '+30 694 456 7890',
    weightKg: 58.6,
    fitnessGoal: '55 kg',
  },
  {
    fullName: 'Αλέξανδρος Παπαδόπουλος',
    email: 'alex@example.com',
    phone: '+30 694 567 8901',
    weightKg: 92.3,
    fitnessGoal: '85 kg',
    inactive: true,
  },
  {
    fullName: 'Γιάννης Παπαδόπουλος',
    email: 'giannis@example.com',
    phone: '+30 694 678 9012',
    weightKg: 88.7,
    fitnessGoal: '82 kg',
  },
  {
    fullName: 'Δήμητρα Ιωάννου',
    email: 'dimitra@example.com',
    phone: '+30 694 789 0123',
    weightKg: 61.3,
    fitnessGoal: '58 kg',
  },
];

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'coach_management',
});

const password = await bcrypt.hash('DemoClient1!', 10);

for (const client of demoClients) {
  const [existing] = await connection.query(
    'SELECT id FROM users WHERE email = ?',
    [client.email]
  );

  let userId;
  if (existing.length) {
    userId = existing[0].id;
    await connection.query(
      'UPDATE users SET full_name = ?, role = "client", is_active = ? WHERE id = ?',
      [client.fullName, client.inactive ? 0 : 1, userId]
    );
  } else {
    const [result] = await connection.query(
      'INSERT INTO users (email, password, full_name, role, is_active, created_at) VALUES (?, ?, ?, "client", ?, NOW())',
      [client.email, password, client.fullName, client.inactive ? 0 : 1]
    );
    userId = result.insertId;
  }

  await connection.query(
    `INSERT INTO clients (user_id, phone, weight_kg, fitness_goal)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       phone = VALUES(phone),
       weight_kg = VALUES(weight_kg),
       fitness_goal = VALUES(fitness_goal)`,
    [userId, client.phone, client.weightKg, client.fitnessGoal]
  );
}

const [rows] = await connection.query(
  'SELECT id, email, full_name, is_active FROM users WHERE role = "client" ORDER BY full_name'
);

await connection.end();
console.log(`Seeded ${demoClients.length} demo clients.`);
console.table(rows);
