/**
 * Sleeper IDs Controller
 * Handles manager-sleeper ID mappings
 */

const logger = require('../utils/logger');

/**
 * Get all manager-sleeper ID mappings
 */
async function getAllMappings(req, res, next) {
  try {
    const { allAsync } = req.db;

    const mappings = await allAsync(`
      SELECT msi.*, m.full_name
      FROM manager_sleeper_ids msi
      LEFT JOIN managers m ON msi.name_id = m.name_id
      ORDER BY msi.season DESC, m.full_name
    `);

    res.json({ mappings });
  } catch (error) {
    logger.error('Error fetching sleeper ID mappings', { error: error.message });
    next(error);
  }
}

/**
 * Create a new mapping
 */
async function createMapping(req, res, next) {
  try {
    const { runAsync } = req.db;
    const { name_id, sleeper_user_id, season } = req.body;

    if (!name_id || !sleeper_user_id || !season) {
      return res.status(400).json({ error: 'name_id, sleeper_user_id and season are required' });
    }

    const result = await runAsync(
      'INSERT INTO manager_sleeper_ids (name_id, sleeper_user_id, season) VALUES (?, ?, ?)',
      [name_id, sleeper_user_id, season]
    );

    logger.info('Sleeper ID mapping created', { id: result.lastID, name_id, season });
    res.json({ message: 'Mapping added successfully', id: result.lastID });
  } catch (error) {
    logger.error('Error creating sleeper ID mapping', { error: error.message });
    next(error);
  }
}

/**
 * Update a mapping
 */
async function updateMapping(req, res, next) {
  try {
    const { runAsync } = req.db;
    const id = req.params.id;
    const { name_id, sleeper_user_id, season } = req.body;

    if (!name_id || !sleeper_user_id || !season) {
      return res.status(400).json({ error: 'name_id, sleeper_user_id and season are required' });
    }

    const result = await runAsync(
      'UPDATE manager_sleeper_ids SET name_id = ?, sleeper_user_id = ?, season = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name_id, sleeper_user_id, season, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    logger.info('Sleeper ID mapping updated', { id, name_id, season });
    res.json({ message: 'Mapping updated successfully' });
  } catch (error) {
    logger.error('Error updating sleeper ID mapping', { id: req.params.id, error: error.message });
    next(error);
  }
}

/**
 * Delete a mapping
 */
async function deleteMapping(req, res, next) {
  try {
    const { runAsync } = req.db;
    const id = req.params.id;

    const result = await runAsync('DELETE FROM manager_sleeper_ids WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    logger.info('Sleeper ID mapping deleted', { id });
    res.json({ message: 'Mapping deleted successfully' });
  } catch (error) {
    logger.error('Error deleting sleeper ID mapping', { id: req.params.id, error: error.message });
    next(error);
  }
}

module.exports = {
  getAllMappings,
  createMapping,
  updateMapping,
  deleteMapping
};
