import express from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../index.js';
import { authorizeRole } from '../middleware/auth.js';
import { ensureMediaCategories, folderCategory } from './media.js';

// Read/organize surface for the three centralized-image categories (exercise,
// food, progress_photo). Never duplicates exercises/foods/progress_photos data —
// only tracks, via media_category_items, which Media Gallery subfolder each
// existing row is filed into. Deleting an item still goes through its own
// owning route (exercises.js / mediaFoods.js / this file's /photos/:id), which
// stays the single source of truth for removing the underlying image.

const router = express.Router();
const CATEGORIES = ['exercise', 'food', 'progress_photo'];

function categoryQueries(category, hasSearch) {
  if (category === 'exercise') {
    return {
      list: `SELECT ei.id AS entityId, e.name AS title, ei.image_url AS url, ei.exercise_id AS parentId
             FROM exercise_images ei
             JOIN exercises e ON e.id = ei.exercise_id
             JOIN media_category_items mci ON mci.category = 'exercise' AND mci.entity_id = ei.id
             WHERE mci.folder_id = ? ${hasSearch ? 'AND e.name LIKE ?' : ''}
             ORDER BY ei.id DESC LIMIT ? OFFSET ?`,
      count: `SELECT COUNT(*) AS c
              FROM media_category_items mci
              JOIN exercise_images ei ON ei.id = mci.entity_id
              JOIN exercises e ON e.id = ei.exercise_id
              WHERE mci.category = 'exercise' AND mci.folder_id = ? ${hasSearch ? 'AND e.name LIKE ?' : ''}`,
    };
  }
  if (category === 'food') {
    return {
      list: `SELECT f.id AS entityId, f.name_gr AS title, f.image_url AS url
             FROM foods f
             JOIN media_category_items mci ON mci.category = 'food' AND mci.entity_id = f.id
             WHERE mci.folder_id = ? ${hasSearch ? 'AND f.name_gr LIKE ?' : ''}
             ORDER BY f.id DESC LIMIT ? OFFSET ?`,
      count: `SELECT COUNT(*) AS c
              FROM media_category_items mci
              JOIN foods f ON f.id = mci.entity_id
              WHERE mci.category = 'food' AND mci.folder_id = ? ${hasSearch ? 'AND f.name_gr LIKE ?' : ''}`,
    };
  }
  return {
    list: `SELECT pp.id AS entityId, CONCAT('Πρόοδος #', pp.id, ' — ', pp.angle) AS title, pp.photo_url AS url
           FROM progress_photos pp
           JOIN media_category_items mci ON mci.category = 'progress_photo' AND mci.entity_id = pp.id
           WHERE mci.folder_id = ? ${hasSearch ? 'AND pp.angle LIKE ?' : ''}
           ORDER BY pp.id DESC LIMIT ? OFFSET ?`,
    count: `SELECT COUNT(*) AS c
            FROM media_category_items mci
            JOIN progress_photos pp ON pp.id = mci.entity_id
            WHERE mci.category = 'progress_photo' AND mci.folder_id = ? ${hasSearch ? 'AND pp.angle LIKE ?' : ''}`,
  };
}

router.get('/categories/:category', authorizeRole(['coach', 'admin', 'moderator']), async (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ message: 'Invalid category' });
  }

  try {
    const connection = await pool.getConnection();
    const rootIds = await ensureMediaCategories(connection);
    const rootId = rootIds[category];
    const requestedFolderId = req.query.folderId ? Number(req.query.folderId) : rootId;

    if (requestedFolderId !== rootId) {
      const resolvedCategory = await folderCategory(connection, requestedFolderId);
      if (resolvedCategory !== category) {
        connection.release();
        return res.status(400).json({ message: 'Folder does not belong to this category' });
      }
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 48));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const { list, count } = categoryQueries(category, Boolean(search));
    const listParams = search ? [requestedFolderId, `%${search}%`, limit, offset] : [requestedFolderId, limit, offset];
    const countParams = search ? [requestedFolderId, `%${search}%`] : [requestedFolderId];

    const [items] = await connection.query(list, listParams);
    const [[{ c: total }]] = await connection.query(count, countParams);
    connection.release();

    res.json({
      items: items.map((item) => ({ ...item, category, folderId: requestedFolderId })),
      total,
      page,
      limit,
      rootFolderId: rootId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/categories/:category/:entityId/folder', authorizeRole(['coach', 'admin']), [
  body('folderId').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { category, entityId } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ message: 'Invalid category' });
  }

  try {
    const connection = await pool.getConnection();
    const targetFolderId = Number(req.body.folderId);
    const resolvedCategory = await folderCategory(connection, targetFolderId);
    if (resolvedCategory !== category) {
      connection.release();
      return res.status(400).json({ message: 'Cannot move an item to a folder outside its own category' });
    }

    const [result] = await connection.query(
      'UPDATE media_category_items SET folder_id = ? WHERE category = ? AND entity_id = ?',
      [targetFolderId, category, entityId]
    );
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json({ message: 'Item moved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/categories/:category/bulk-move', authorizeRole(['coach', 'admin']), [
  body('entityIds').isArray({ min: 1 }),
  body('folderId').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { category } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ message: 'Invalid category' });
  }

  try {
    const connection = await pool.getConnection();
    const targetFolderId = Number(req.body.folderId);
    const resolvedCategory = await folderCategory(connection, targetFolderId);
    if (resolvedCategory !== category) {
      connection.release();
      return res.status(400).json({ message: 'Cannot move items to a folder outside their own category' });
    }

    await connection.query(
      'UPDATE media_category_items SET folder_id = ? WHERE category = ? AND entity_id IN (?)',
      [targetFolderId, category, req.body.entityIds]
    );
    connection.release();
    res.json({ message: 'Items moved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
