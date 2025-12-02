const { z } = require('zod');
const { commonSchemas } = require('../middleware/validation');

/**
 * Schema for getting keepers by year
 * GET /api/keepers/:year
 */
const getKeepersByYear = {
  params: z.object({
    year: commonSchemas.year
  })
};

/**
 * Schema for saving keeper selections
 * POST /api/keepers/:year/:rosterId
 */
const saveKeepers = {
  params: z.object({
    year: commonSchemas.year,
    rosterId: commonSchemas.rosterId
  }),
  body: z.object({
    keepers: z.array(
      z.object({
        playerId: z.string().min(1, 'Player ID is required'),
        playerName: z.string().optional(),
        position: commonSchemas.position.optional(),
        team: z.string().optional(),
        tradeFromRosterId: z.number().int().positive().nullable().optional(),
        tradeAmount: z.number().positive().nullable().optional(),
        tradeNote: z.string().max(500).nullable().optional()
      })
    ).max(3, 'Maximum 3 keepers allowed')
  })
};

/**
 * Schema for updating keeper trade lock
 * PUT /api/keeper-trade-lock/:year
 */
const updateKeeperTradeLock = {
  params: z.object({
    year: commonSchemas.year
  }),
  body: z.object({
    locked: commonSchemas.boolean
  })
};

/**
 * Schema for getting keeper trade lock status
 * GET /api/keeper-trade-lock/:year
 */
const getKeeperTradeLock = {
  params: z.object({
    year: commonSchemas.year
  })
};

module.exports = {
  getKeepersByYear,
  saveKeepers,
  updateKeeperTradeLock,
  getKeeperTradeLock
};
