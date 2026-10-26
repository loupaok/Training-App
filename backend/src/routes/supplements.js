import express from 'express';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

const CATEGORIES = [
  'proteins', 'amino-acids', 'vitamins-health', 'fat-burners',
  'creatine', 'pre-workout', 'carbohydrates', 'foods',
];

const SEED_SUPPLEMENTS = [
  ['proteins', 'Whey Πρωτεΐνη'],
  ['proteins', 'Isolate Πρωτεΐνη'],
  ['proteins', 'Πρωτεΐνες Όγκου'],
  ['proteins', 'Υδρολυμένη Πρωτεΐνη'],
  ['amino-acids', 'EAA'],
  ['amino-acids', 'BCAA'],
  ['amino-acids', 'Γλουταμίνη'],
  ['amino-acids', 'Amino Complex'],
  ['amino-acids', 'Μεμονωμένα Αμινοξέα'],
  ['vitamins-health', 'Πολυβιταμίνες & Packs'],
  ['vitamins-health', 'Μεμονωμένες Βιταμίνες'],
  ['vitamins-health', 'Ωμέγα-3 & Λιπαρά Οξέα'],
  ['vitamins-health', 'Μέταλλα'],
  ['vitamins-health', 'Αντιοξειδωτικά'],
  ['vitamins-health', 'Πεπτικό / Προβιοτικά'],
  ['vitamins-health', 'Ύπνος & Anti-Stress'],
  ['vitamins-health', 'Ειδική Υποστήριξη'],
  ['fat-burners', 'Λιποδιαλύτες'],
  ['fat-burners', 'Καρνιτίνη'],
  ['creatine', 'Μονοϋδρική Κρεατίνη'],
  ['creatine', 'Φόρμουλες Κρεατίνης'],
  ['pre-workout', 'Pre-Workout'],
  ['pre-workout', 'Ηλεκτρολύτες & Ισοτονικά'],
  ['pre-workout', 'Αύξησης Τεστοστερόνης'],
  ['foods', 'Αλείμματα'],
  ['foods', 'Βούτυρα'],
  ['foods', 'Μπάρες'],
  ['foods', 'Σνακ'],
  ['foods', 'Γλυκό'],
  ['foods', 'Σάλτσες'],
  ['foods', 'Σιρόπι (Zero)'],
];

async function ensureSupplementsSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS supplements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category VARCHAR(80) NOT NULL,
      name VARCHAR(150) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_supplement_category_name (category, name)
    )
  `);
  await connection.query('INSERT IGNORE INTO supplements (category, name) VALUES ?', [SEED_SUPPLEMENTS]);
}

router.get('/', authorizeRole(['coach', 'admin']), async (req, res) => {
  const category = String(req.query.category || '');
  const search = String(req.query.search || '').trim();
  const filters = ['is_active = 1'];
  const values = [];

  if (category && CATEGORIES.includes(category)) {
    filters.push('category = ?');
    values.push(category);
  }
  if (search) {
    filters.push('name LIKE ?');
    values.push(`%${search}%`);
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await ensureSupplementsSchema(connection);
    const [items] = await connection.query(
      `SELECT id, category, name FROM supplements WHERE ${filters.join(' AND ')} ORDER BY name`,
      values
    );
    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    connection?.release();
  }
});

export default router;
