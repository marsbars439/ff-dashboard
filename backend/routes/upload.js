/**
 * Upload Routes
 * Routes for Excel file uploads
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const { requireAdmin } = require('../middleware/auth');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// POST /api/upload-excel - Upload and import Excel file (admin only)
router.post('/upload-excel', requireAdmin, upload.single('file'), uploadController.uploadExcel);

module.exports = router;
