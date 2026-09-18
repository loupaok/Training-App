import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Global library — every coach/admin can see, create, edit and delete every
// food. No per-coach scoping (matches the "global library" requirement).
// Will be consumed by the Nutrition Plan editor in a later step.

const CATEGORIES = [
  'meat', 'fish', 'eggs', 'dairy', 'vegetables', 'fruits',
  'legumes', 'grains', 'nuts', 'oils', 'other',
];
const SERVING_UNITS = ['g', 'ml', 'piece', 'tbsp', 'cup'];

async function ensureFoodsSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS foods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name_gr VARCHAR(150) NOT NULL,
      name_en VARCHAR(150),
      category ENUM(
        'meat','fish','eggs','dairy',
        'vegetables','fruits','legumes',
        'grains','nuts','oils','other'
      ),
      calories_per_100g DECIMAL(7,2),
      protein_per_100g DECIMAL(7,2),
      carbs_per_100g DECIMAL(7,2),
      fats_per_100g DECIMAL(7,2),
      fiber_per_100g DECIMAL(7,2),
      serving_size DECIMAL(7,2) DEFAULT 100,
      serving_unit ENUM('g','ml','piece',
                        'tbsp','cup') DEFAULT 'g',
      image_url VARCHAR(255),
      source ENUM('system','custom',
                  'openfoodfacts') DEFAULT 'system',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_name_gr (name_gr)
    )
  `);

  const [[{ total }]] = await connection.query('SELECT COUNT(*) AS total FROM foods');
  if (Number(total) > 0) return;

  await connection.query(
    `INSERT IGNORE INTO foods
      (name_gr, name_en, category, calories_per_100g, protein_per_100g, carbs_per_100g,
       fats_per_100g, fiber_per_100g, serving_size, serving_unit, source)
     VALUES ?`,
    [SEED_FOODS.map((food) => [
      food.nameGr, food.nameEn, food.category, food.calories, food.protein, food.carbs,
      food.fats, food.fiber, food.servingSize ?? 100, food.servingUnit ?? 'g', 'system',
    ])]
  );
}

// Accurate macros per 100g, per the coach's seed list. English names are used
// as the Unsplash search term when a coach attaches a photo to the food.
const SEED_FOODS = [
  // Κρέατα
  { nameGr: 'Κοτόπουλο στήθος', nameEn: 'Chicken Breast', category: 'meat', calories: 165, protein: 31, carbs: 0, fats: 3.6, fiber: 0 },
  { nameGr: 'Μοσχάρι (άπαχο)', nameEn: 'Lean Beef', category: 'meat', calories: 250, protein: 26, carbs: 0, fats: 15, fiber: 0 },
  { nameGr: 'Χοιρινό φιλέτο', nameEn: 'Pork Tenderloin', category: 'meat', calories: 242, protein: 27, carbs: 0, fats: 14, fiber: 0 },
  { nameGr: 'Τουρκία στήθος', nameEn: 'Turkey Breast', category: 'meat', calories: 135, protein: 30, carbs: 0, fats: 1, fiber: 0 },
  { nameGr: 'Αρνί', nameEn: 'Lamb', category: 'meat', calories: 294, protein: 25, carbs: 0, fats: 21, fiber: 0 },

  // Ψάρια
  { nameGr: 'Τόνος (κονσέρβα νερό)', nameEn: 'Canned Tuna in Water', category: 'fish', calories: 116, protein: 26, carbs: 0, fats: 1, fiber: 0 },
  { nameGr: 'Σολομός', nameEn: 'Salmon', category: 'fish', calories: 208, protein: 20, carbs: 0, fats: 13, fiber: 0 },
  { nameGr: 'Μπακαλιάρος', nameEn: 'Cod', category: 'fish', calories: 82, protein: 18, carbs: 0, fats: 0.7, fiber: 0 },
  { nameGr: 'Γαρίδες', nameEn: 'Shrimp', category: 'fish', calories: 99, protein: 24, carbs: 0.2, fats: 0.3, fiber: 0 },
  { nameGr: 'Σαρδέλες', nameEn: 'Sardines', category: 'fish', calories: 208, protein: 25, carbs: 0, fats: 11, fiber: 0 },

  // Αυγά & Γαλακτοκομικά
  { nameGr: 'Αυγό ολόκληρο', nameEn: 'Whole Egg', category: 'eggs', calories: 155, protein: 13, carbs: 1.1, fats: 11, fiber: 0, servingSize: 60, servingUnit: 'piece' },
  { nameGr: 'Ασπράδι αυγού', nameEn: 'Egg White', category: 'eggs', calories: 52, protein: 11, carbs: 0.7, fats: 0.2, fiber: 0 },
  { nameGr: 'Γιαούρτι 0%', nameEn: 'Greek Yogurt 0%', category: 'dairy', calories: 57, protein: 10, carbs: 4, fats: 0.2, fiber: 0 },
  { nameGr: 'Γιαούρτι 2%', nameEn: 'Greek Yogurt 2%', category: 'dairy', calories: 73, protein: 9, carbs: 4, fats: 2, fiber: 0 },
  { nameGr: 'Cottage cheese', nameEn: 'Cottage Cheese', category: 'dairy', calories: 98, protein: 11, carbs: 3.4, fats: 4.3, fiber: 0 },
  { nameGr: 'Φέτα', nameEn: 'Feta Cheese', category: 'dairy', calories: 264, protein: 14, carbs: 4, fats: 21, fiber: 0 },
  { nameGr: 'Γάλα 1.5%', nameEn: 'Milk 1.5%', category: 'dairy', calories: 47, protein: 3.4, carbs: 4.8, fats: 1.5, fiber: 0 },
  { nameGr: 'Whey protein', nameEn: 'Whey Protein Powder', category: 'dairy', calories: 380, protein: 75, carbs: 8, fats: 5, fiber: 1 },

  // Δημητριακά
  { nameGr: 'Ρύζι λευκό (ωμό)', nameEn: 'White Rice Raw', category: 'grains', calories: 365, protein: 7, carbs: 80, fats: 0.7, fiber: 1.3 },
  { nameGr: 'Ρύζι καστανό (ωμό)', nameEn: 'Brown Rice Raw', category: 'grains', calories: 370, protein: 8, carbs: 77, fats: 3, fiber: 3.5 },
  { nameGr: 'Βρώμη', nameEn: 'Oats', category: 'grains', calories: 389, protein: 17, carbs: 66, fats: 7, fiber: 10 },
  { nameGr: 'Ψωμί ολικής', nameEn: 'Whole Wheat Bread', category: 'grains', calories: 247, protein: 13, carbs: 41, fats: 4, fiber: 7 },
  { nameGr: 'Ζυμαρικά (ωμά)', nameEn: 'Pasta Raw', category: 'grains', calories: 371, protein: 13, carbs: 74, fats: 1.5, fiber: 3 },
  { nameGr: 'Γλυκοπατάτα', nameEn: 'Sweet Potato', category: 'grains', calories: 86, protein: 1.6, carbs: 20, fats: 0.1, fiber: 3 },
  { nameGr: 'Πατάτα', nameEn: 'Potato', category: 'grains', calories: 77, protein: 2, carbs: 17, fats: 0.1, fiber: 2.2 },
  { nameGr: 'Κινόα (ωμή)', nameEn: 'Quinoa Raw', category: 'grains', calories: 368, protein: 14, carbs: 64, fats: 6, fiber: 7 },

  // Λαχανικά
  { nameGr: 'Μπρόκολο', nameEn: 'Broccoli', category: 'vegetables', calories: 34, protein: 2.8, carbs: 7, fats: 0.4, fiber: 2.6 },
  { nameGr: 'Σπανάκι', nameEn: 'Spinach', category: 'vegetables', calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4, fiber: 2.2 },
  { nameGr: 'Ντομάτα', nameEn: 'Tomato', category: 'vegetables', calories: 18, protein: 0.9, carbs: 3.9, fats: 0.2, fiber: 1.2 },
  { nameGr: 'Αγγούρι', nameEn: 'Cucumber', category: 'vegetables', calories: 15, protein: 0.7, carbs: 3.6, fats: 0.1, fiber: 0.5 },
  { nameGr: 'Πιπεριά', nameEn: 'Bell Pepper', category: 'vegetables', calories: 31, protein: 1, carbs: 6, fats: 0.3, fiber: 2.1 },
  { nameGr: 'Κολοκυθάκι', nameEn: 'Zucchini', category: 'vegetables', calories: 17, protein: 1.2, carbs: 3.1, fats: 0.3, fiber: 1 },
  { nameGr: 'Καρότο', nameEn: 'Carrot', category: 'vegetables', calories: 41, protein: 0.9, carbs: 10, fats: 0.2, fiber: 2.8 },
  { nameGr: 'Μαρούλι', nameEn: 'Lettuce', category: 'vegetables', calories: 15, protein: 1.4, carbs: 2.9, fats: 0.2, fiber: 1.3 },

  // Φρούτα
  { nameGr: 'Μπανάνα', nameEn: 'Banana', category: 'fruits', calories: 89, protein: 1.1, carbs: 23, fats: 0.3, fiber: 2.6, servingSize: 120, servingUnit: 'piece' },
  { nameGr: 'Μήλο', nameEn: 'Apple', category: 'fruits', calories: 52, protein: 0.3, carbs: 14, fats: 0.2, fiber: 2.4, servingSize: 150, servingUnit: 'piece' },
  { nameGr: 'Φράουλα', nameEn: 'Strawberry', category: 'fruits', calories: 32, protein: 0.7, carbs: 7.7, fats: 0.3, fiber: 2 },
  { nameGr: 'Βατόμουρο', nameEn: 'Blueberry', category: 'fruits', calories: 43, protein: 1.4, carbs: 10, fats: 0.5, fiber: 2.4 },
  { nameGr: 'Πορτοκάλι', nameEn: 'Orange', category: 'fruits', calories: 47, protein: 0.9, carbs: 12, fats: 0.1, fiber: 2.4, servingSize: 130, servingUnit: 'piece' },
  { nameGr: 'Αβοκάντο', nameEn: 'Avocado', category: 'fruits', calories: 160, protein: 2, carbs: 9, fats: 15, fiber: 7 },

  // Όσπρια
  { nameGr: 'Φακές (ωμές)', nameEn: 'Lentils Raw', category: 'legumes', calories: 353, protein: 26, carbs: 60, fats: 1, fiber: 11 },
  { nameGr: 'Ρεβίθια (ωμά)', nameEn: 'Chickpeas Raw', category: 'legumes', calories: 364, protein: 19, carbs: 61, fats: 6, fiber: 17 },
  { nameGr: 'Φασόλια (ωμά)', nameEn: 'Beans Raw', category: 'legumes', calories: 333, protein: 21, carbs: 60, fats: 1.5, fiber: 15 },
  { nameGr: 'Edamame', nameEn: 'Edamame', category: 'legumes', calories: 121, protein: 11, carbs: 8.9, fats: 5.2, fiber: 5.2 },

  // Ξηροί Καρποί & Σπόροι
  { nameGr: 'Αμύγδαλα', nameEn: 'Almonds', category: 'nuts', calories: 579, protein: 21, carbs: 22, fats: 50, fiber: 12.5 },
  { nameGr: 'Καρύδια', nameEn: 'Walnuts', category: 'nuts', calories: 654, protein: 15, carbs: 14, fats: 65, fiber: 6.7 },
  { nameGr: 'Φυστικοβούτυρο', nameEn: 'Peanut Butter', category: 'nuts', calories: 588, protein: 25, carbs: 20, fats: 50, fiber: 6 },
  { nameGr: 'Chia seeds', nameEn: 'Chia Seeds', category: 'nuts', calories: 486, protein: 17, carbs: 42, fats: 31, fiber: 34 },

  // Έλαια & Λίπη
  { nameGr: 'Ελαιόλαδο', nameEn: 'Olive Oil', category: 'oils', calories: 884, protein: 0, carbs: 0, fats: 100, fiber: 0, servingSize: 14, servingUnit: 'tbsp' },
  { nameGr: 'Βούτυρο', nameEn: 'Butter', category: 'oils', calories: 717, protein: 0.9, carbs: 0.1, fats: 81, fiber: 0, servingSize: 14, servingUnit: 'tbsp' },
  { nameGr: 'Coconut oil', nameEn: 'Coconut Oil', category: 'oils', calories: 862, protein: 0, carbs: 0, fats: 100, fiber: 0 },
];

function mapFoodRow(row) {
  return {
    id: row.id,
    nameGr: row.nameGr,
    nameEn: row.nameEn || '',
    category: row.category,
    caloriesPer100g: row.caloriesPer100g,
    proteinPer100g: row.proteinPer100g,
    carbsPer100g: row.carbsPer100g,
    fatsPer100g: row.fatsPer100g,
    fiberPer100g: row.fiberPer100g,
    servingSize: row.servingSize,
    servingUnit: row.servingUnit,
    imageUrl: row.imageUrl || '',
    source: row.source,
    isActive: Boolean(row.isActive),
  };
}

const FOOD_COLUMNS = `id, name_gr AS nameGr, name_en AS nameEn, category,
       calories_per_100g AS caloriesPer100g, protein_per_100g AS proteinPer100g,
       carbs_per_100g AS carbsPer100g, fats_per_100g AS fatsPer100g,
       fiber_per_100g AS fiberPer100g, serving_size AS servingSize,
       serving_unit AS servingUnit, image_url AS imageUrl, source, is_active AS isActive`;

router.get('/', authorizeRole(['coach', 'admin']), async (req, res) => {
  const { search = '', category = '', source = '' } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  // Capped at 500 (not 100) so a single "fetch everything for the picker"
  // call, like the Nutrition Plan editor's food picker, can't silently
  // truncate the library as it grows past 100 entries.
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 24));
  const offset = (page - 1) * limit;

  const filters = ['is_active = 1'];
  const values = [];

  if (search) {
    filters.push('(name_gr LIKE ? OR name_en LIKE ?)');
    values.push(`%${search}%`, `%${search}%`);
  }
  if (category && CATEGORIES.includes(category)) {
    filters.push('category = ?');
    values.push(category);
  }
  if (source) {
    filters.push('source = ?');
    values.push(source);
  }

  const where = `WHERE ${filters.join(' AND ')}`;

  try {
    const connection = await pool.getConnection();
    await ensureFoodsSchema(connection);

    const [[{ total }]] = await connection.query(`SELECT COUNT(*) AS total FROM foods ${where}`, values);
    const [rows] = await connection.query(
      `SELECT ${FOOD_COLUMNS} FROM foods ${where} ORDER BY name_gr LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );
    connection.release();

    res.json({ items: rows.map(mapFoodRow), total: Number(total), page, limit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureFoodsSchema(connection);
    const [rows] = await connection.query(`SELECT ${FOOD_COLUMNS} FROM foods WHERE id = ?`, [req.params.id]);
    connection.release();

    if (!rows.length) return res.status(404).json({ message: 'Food not found' });
    res.json(mapFoodRow(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const foodValidators = [
  body('nameGr').notEmpty().withMessage('Το όνομα είναι υποχρεωτικό'),
  body('nameEn').optional({ nullable: true }).isString(),
  body('category').optional({ nullable: true }).isIn(CATEGORIES),
  body('caloriesPer100g').optional({ nullable: true }).isFloat({ min: 0 }),
  body('proteinPer100g').optional({ nullable: true }).isFloat({ min: 0 }),
  body('carbsPer100g').optional({ nullable: true }).isFloat({ min: 0 }),
  body('fatsPer100g').optional({ nullable: true }).isFloat({ min: 0 }),
  body('fiberPer100g').optional({ nullable: true }).isFloat({ min: 0 }),
  body('servingSize').optional({ nullable: true }).isFloat({ min: 0 }),
  body('servingUnit').optional({ nullable: true }).isIn(SERVING_UNITS),
  body('imageUrl').optional({ nullable: true }).isString(),
];

router.post('/', authorizeRole(['coach', 'admin']), foodValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Δεν αποθηκεύτηκε το τρόφιμο.', errors: errors.array() });
  }

  const {
    nameGr, nameEn, category, caloriesPer100g, proteinPer100g, carbsPer100g,
    fatsPer100g, fiberPer100g, servingSize, servingUnit, imageUrl,
  } = req.body;

  try {
    const connection = await pool.getConnection();
    await ensureFoodsSchema(connection);
    const [result] = await connection.query(
      `INSERT INTO foods
        (name_gr, name_en, category, calories_per_100g, protein_per_100g, carbs_per_100g,
         fats_per_100g, fiber_per_100g, serving_size, serving_unit, image_url, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'custom')`,
      [
        nameGr.trim(), nameEn?.trim() || null, category || 'other',
        caloriesPer100g ?? null, proteinPer100g ?? null, carbsPer100g ?? null,
        fatsPer100g ?? null, fiberPer100g ?? null, servingSize ?? 100,
        servingUnit || 'g', imageUrl || null,
      ]
    );

    const [rows] = await connection.query(`SELECT ${FOOD_COLUMNS} FROM foods WHERE id = ?`, [result.insertId]);
    connection.release();
    res.status(201).json(mapFoodRow(rows[0]));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Υπάρχει ήδη τρόφιμο με αυτό το όνομα.' });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', authorizeRole(['coach', 'admin']), foodValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Δεν αποθηκεύτηκαν οι αλλαγές.', errors: errors.array() });
  }

  const {
    nameGr, nameEn, category, caloriesPer100g, proteinPer100g, carbsPer100g,
    fatsPer100g, fiberPer100g, servingSize, servingUnit, imageUrl,
  } = req.body;

  try {
    const connection = await pool.getConnection();
    await ensureFoodsSchema(connection);
    const [result] = await connection.query(
      `UPDATE foods
       SET name_gr = ?, name_en = ?, category = ?, calories_per_100g = ?, protein_per_100g = ?,
           carbs_per_100g = ?, fats_per_100g = ?, fiber_per_100g = ?, serving_size = ?,
           serving_unit = ?, image_url = ?
       WHERE id = ?`,
      [
        nameGr.trim(), nameEn?.trim() || null, category || 'other',
        caloriesPer100g ?? null, proteinPer100g ?? null, carbsPer100g ?? null,
        fatsPer100g ?? null, fiberPer100g ?? null, servingSize ?? 100,
        servingUnit || 'g', imageUrl || null, req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      connection.release();
      return res.status(404).json({ message: 'Food not found' });
    }

    const [rows] = await connection.query(`SELECT ${FOOD_COLUMNS} FROM foods WHERE id = ?`, [req.params.id]);
    connection.release();
    res.json(mapFoodRow(rows[0]));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Υπάρχει ήδη τρόφιμο με αυτό το όνομα.' });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authorizeRole(['coach', 'admin']), async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await ensureFoodsSchema(connection);
    const [result] = await connection.query('DELETE FROM foods WHERE id = ?', [req.params.id]);
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Food not found' });
    }
    res.json({ message: 'Food deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
