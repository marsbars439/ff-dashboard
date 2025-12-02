/**
 * Upload Controller
 * Handles Excel file upload and data import
 */

const XLSX = require('xlsx');
const logger = require('../utils/logger');

/**
 * Upload Excel file and import data
 */
async function uploadExcel(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const { runAsync, db } = req.db;
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    // Clear existing data
    await runAsync('DELETE FROM team_seasons');

    // Insert new data
    const insertQuery = `
      INSERT INTO team_seasons (
        year, name_id, team_name, wins, losses, points_for, points_against,
        regular_season_rank, playoff_finish, dues, payout, dues_chumpion, high_game
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let insertedCount = 0;
    for (const row of jsonData) {
      const values = [
        row.year,
        row.name_id,
        row.team_name || '',
        row.wins,
        row.losses,
        row.points_for || 0,
        row.points_against || 0,
        row.regular_season_rank || null,
        row.playoff_finish || null,
        row.dues,
        row.payout || 0,
        row.dues_chumpion || 0,
        row.high_game || null
      ];

      try {
        await runAsync(insertQuery, values);
        insertedCount++;
      } catch (error) {
        logger.error('Error inserting row', { error: error.message, row });
      }
    }

    // Clean up uploaded file
    require('fs').unlinkSync(req.file.path);

    logger.info('Data imported from Excel', { rowsProcessed: jsonData.length, inserted: insertedCount });
    res.json({
      message: 'Data imported successfully',
      rowsProcessed: jsonData.length
    });
  } catch (error) {
    logger.error('Error processing Excel file', { error: error.message });
    res.status(500).json({ error: 'Failed to process Excel file: ' + error.message });
  }
}

module.exports = {
  uploadExcel
};
