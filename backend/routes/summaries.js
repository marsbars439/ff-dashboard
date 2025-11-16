const express = require('express');

function createSummariesRouter({
  summaryService,
  generateWeeklySummary,
  generateWeeklyPreview,
  getAsync,
  runAsync,
  summarizeLimiter,
  refreshCachedSummary,
  refreshCachedPreview,
  extractSummaryLines
} = {}) {
  if (!summaryService || !getAsync || !runAsync) {
    throw new Error('Summary router requires database helpers and services');
  }

  if (typeof generateWeeklySummary !== 'function' || typeof generateWeeklyPreview !== 'function') {
    throw new Error('Weekly summary generators are required');
  }

  const router = express.Router();
  const limiter = summarizeLimiter || ((req, res, next) => next());

  router.post('/summarize', limiter, async (req, res) => {
    try {
      const summary = await summaryService.generateSummary(req.body);
      res.json({ summary });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/summary', async (req, res) => {
    try {
      const row = await getAsync('SELECT summary, created_at FROM summaries ORDER BY created_at DESC LIMIT 1');
      res.json({ summary: row ? row.summary : '', updated: row ? row.created_at : null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/summary', async (req, res) => {
    try {
      const { summary } = req.body || {};
      if (typeof summary !== 'string') {
        return res.status(400).json({ error: 'Summary text is required.' });
      }

      const trimmed = summary.trim();
      await runAsync('INSERT INTO summaries (summary) VALUES (?)', [trimmed]);
      res.json({ summary: trimmed, lines: extractSummaryLines(trimmed) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/summary/refresh', async (req, res) => {
    try {
      const summary = await refreshCachedSummary();
      res.json({ summary, lines: extractSummaryLines(summary) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/summary/generate-line', async (req, res) => {
    try {
      const index = Number.isInteger(req.body?.index)
        ? req.body.index
        : parseInt(req.body?.index, 10);
      const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;

      const { summary } = await generateWeeklySummary();
      const lines = extractSummaryLines(summary);
      const line = lines[normalizedIndex] || '';

      res.json({ line, lines, index: normalizedIndex, summary });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/preview', async (req, res) => {
    try {
      const row = await getAsync('SELECT summary, created_at FROM previews ORDER BY created_at DESC LIMIT 1');
      res.json({ summary: row ? row.summary : '', updated: row ? row.created_at : null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/preview', async (req, res) => {
    try {
      const { summary } = req.body || {};
      if (typeof summary !== 'string') {
        return res.status(400).json({ error: 'Preview text is required.' });
      }

      const trimmed = summary.trim();
      await runAsync('INSERT INTO previews (summary) VALUES (?)', [trimmed]);
      res.json({ summary: trimmed, lines: extractSummaryLines(trimmed) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/preview/refresh', async (req, res) => {
    try {
      const summary = await refreshCachedPreview();
      res.json({ summary, lines: extractSummaryLines(summary) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/preview/generate-line', async (req, res) => {
    try {
      const index = Number.isInteger(req.body?.index)
        ? req.body.index
        : parseInt(req.body?.index, 10);
      const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;

      const { summary } = await generateWeeklyPreview();
      const lines = extractSummaryLines(summary);
      const line = lines[normalizedIndex] || '';

      res.json({ line, lines, index: normalizedIndex, summary });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = {
  createSummariesRouter
};
