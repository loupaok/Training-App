import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();
const CATEGORIES = ['proteins', 'amino-acids', 'vitamins-health', 'fat-burners', 'creatine', 'pre-workout', 'carbohydrates', 'foods'];
const SEED_SUPPLEMENTS = [
  ['proteins', 'Whey Πρωτεΐνη'], ['proteins', 'Isolate Πρωτεΐνη'], ['proteins', 'Πρωτεΐνες Όγκου'], ['proteins', 'Υδρολυμένη Πρωτεΐνη'],
  ['amino-acids', 'EAA'], ['amino-acids', 'BCAA'], ['amino-acids', 'Γλουταμίνη'], ['amino-acids', 'Amino Complex'], ['amino-acids', 'Μεμονωμένα Αμινοξέα'],
  ['vitamins-health', 'Πολυβιταμίνες & Packs'], ['vitamins-health', 'Μεμονωμένες Βιταμίνες'], ['vitamins-health', 'Ωμέγα-3 & Λιπαρά Οξέα'], ['vitamins-health', 'Μέταλλα'], ['vitamins-health', 'Αντιοξειδωτικά'], ['vitamins-health', 'Πεπτικό / Προβιοτικά'], ['vitamins-health', 'Ύπνος & Anti-Stress'], ['vitamins-health', 'Ειδική Υποστήριξη'],
  ['fat-burners', 'Λιποδιαλύτες'], ['fat-burners', 'Καρνιτίνη'], ['creatine', 'Μονοϋδρική Κρεατίνη'], ['creatine', 'Φόρμουλες Κρεατίνης'],
  ['pre-workout', 'Pre-Workout'], ['pre-workout', 'Ηλεκτρολύτες & Ισοτονικά'], ['pre-workout', 'Αύξησης Τεστοστερόνης'],
  ['foods', 'Αλείμματα'], ['foods', 'Βούτυρα'], ['foods', 'Μπάρες'], ['foods', 'Σνακ'], ['foods', 'Γλυκό'], ['foods', 'Σάλτσες'], ['foods', 'Σιρόπι (Zero)'],
];
const COLUMNS = `id, category, name, short_code AS shortCode, form, daily_dose AS dailyDose, dose_unit AS doseUnit, timing, link_url AS linkUrl, is_active AS isActive`;

async function ensureSupplementsSchema(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS supplements (
    id INT AUTO_INCREMENT PRIMARY KEY, category VARCHAR(80) NOT NULL, name VARCHAR(150) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_supplement_category_name (category, name))`);
  await connection.query(`ALTER TABLE supplements
    ADD COLUMN IF NOT EXISTS short_code VARCHAR(12) NULL,
    ADD COLUMN IF NOT EXISTS form VARCHAR(80) NULL,
    ADD COLUMN IF NOT EXISTS daily_dose DECIMAL(8,2) NULL,
    ADD COLUMN IF NOT EXISTS dose_unit VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS timing VARCHAR(160) NULL,
    ADD COLUMN IF NOT EXISTS link_url VARCHAR(600) NULL`);
  await connection.query('INSERT IGNORE INTO supplements (category, name) VALUES ?', [SEED_SUPPLEMENTS]);
}

function itemFrom(row) { return { ...row, isActive: Boolean(row.isActive) }; }
function payload(source) {
  return {
    category: String(source.category || '').trim(), name: String(source.name || '').trim(),
    shortCode: String(source.shortCode || '').trim().slice(0, 12) || null,
    form: String(source.form || '').trim().slice(0, 80) || null,
    dailyDose: source.dailyDose === '' || source.dailyDose == null ? null : Number(source.dailyDose),
    doseUnit: String(source.doseUnit || '').trim().slice(0, 20) || null,
    timing: String(source.timing || '').trim().slice(0, 160) || null,
    linkUrl: String(source.linkUrl || '').trim().slice(0, 600) || null,
  };
}
const validators = [
  body('category').isIn(CATEGORIES), body('name').trim().isLength({ min: 1, max: 150 }),
  body('shortCode').optional({ nullable: true }).isString().isLength({ max: 12 }), body('form').optional({ nullable: true }).isString().isLength({ max: 80 }),
  body('dailyDose').optional({ nullable: true }).isFloat({ min: 0 }), body('doseUnit').optional({ nullable: true }).isString().isLength({ max: 20 }),
  body('timing').optional({ nullable: true }).isString().isLength({ max: 160 }),
  body('linkUrl').optional({ nullable: true }).isString().isLength({ max: 600 }),
];

router.get('/', authorizeRole(['coach', 'admin']), async (req, res) => {
  const filters = ['is_active = 1']; const values = [];
  const category = String(req.query.category || ''); const search = String(req.query.search || '').trim();
  if (category && CATEGORIES.includes(category)) { filters.push('category = ?'); values.push(category); }
  if (search) { filters.push('name LIKE ?'); values.push(`%${search}%`); }
  let connection;
  try { connection = await pool.getConnection(); await ensureSupplementsSchema(connection);
    const [items] = await connection.query(`SELECT ${COLUMNS} FROM supplements WHERE ${filters.join(' AND ')} ORDER BY name`, values);
    res.json({ items: items.map(itemFrom) });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' });
  } finally { connection?.release(); }
});

router.post('/', authorizeRole(['coach', 'admin']), validators, async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ message: 'Μη έγκυρα στοιχεία συμπληρώματος.', errors: errors.array() });
  const item = payload(req.body); let connection;
  try { connection = await pool.getConnection(); await ensureSupplementsSchema(connection);
    const [result] = await connection.query('INSERT INTO supplements (category, name, short_code, form, daily_dose, dose_unit, timing, link_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [item.category, item.name, item.shortCode, item.form, item.dailyDose, item.doseUnit, item.timing, item.linkUrl]);
    const [[created]] = await connection.query(`SELECT ${COLUMNS} FROM supplements WHERE id = ?`, [result.insertId]); res.status(201).json(itemFrom(created));
  } catch (error) { if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Υπάρχει ήδη συμπλήρωμα με αυτό το όνομα.' }); console.error(error); res.status(500).json({ message: 'Server error' });
  } finally { connection?.release(); }
});

router.put('/:id', authorizeRole(['coach', 'admin']), validators, async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ message: 'Μη έγκυρα στοιχεία συμπληρώματος.', errors: errors.array() });
  const item = payload(req.body); let connection;
  try { connection = await pool.getConnection(); await ensureSupplementsSchema(connection);
    const [result] = await connection.query('UPDATE supplements SET category = ?, name = ?, short_code = ?, form = ?, daily_dose = ?, dose_unit = ?, timing = ?, link_url = ? WHERE id = ?', [item.category, item.name, item.shortCode, item.form, item.dailyDose, item.doseUnit, item.timing, item.linkUrl, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Το συμπλήρωμα δεν βρέθηκε.' });
    const [[updated]] = await connection.query(`SELECT ${COLUMNS} FROM supplements WHERE id = ?`, [req.params.id]); res.json(itemFrom(updated));
  } catch (error) { if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Υπάρχει ήδη συμπλήρωμα με αυτό το όνομα.' }); console.error(error); res.status(500).json({ message: 'Server error' });
  } finally { connection?.release(); }
});

router.delete('/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  let connection;
  try { connection = await pool.getConnection(); await ensureSupplementsSchema(connection);
    const [result] = await connection.query('UPDATE supplements SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Το συμπλήρωμα δεν βρέθηκε.' }); res.status(204).end();
  } catch (error) { console.error(error); res.status(500).json({ message: 'Server error' });
  } finally { connection?.release(); }
});

export default router;
