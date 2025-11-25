const { z } = require('zod');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Middleware factory for validating request data with Zod schemas
 * @param {Object} schemas - Object containing schemas for body, query, params
 * @param {z.ZodSchema} schemas.body - Zod schema for request body
 * @param {z.ZodSchema} schemas.query - Zod schema for query parameters
 * @param {z.ZodSchema} schemas.params - Zod schema for route parameters
 * @returns {Function} Express middleware function
 */
function validate(schemas) {
  return async (req, res, next) => {
    try {
      // Validate request body
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      // Validate query parameters
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }

      // Validate route parameters
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          'Request validation failed',
          error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        );

        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: validationError.details
        });

        return next(validationError);
      }

      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
const commonSchemas = {
  // Year parameter (must be >= 2016)
  year: z.coerce.number().int().min(2016, 'Year must be 2016 or later'),

  // Roster ID
  rosterId: z.coerce.number().int().positive('Roster ID must be positive'),

  // Manager name_id
  managerId: z.string().min(1, 'Manager ID is required').trim(),

  // Boolean flag
  boolean: z.enum(['true', 'false', '1', '0', 'yes', 'no']).transform(val => {
    return ['true', '1', 'yes'].includes(val.toLowerCase());
  }),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    offset: z.coerce.number().int().nonnegative().optional()
  }),

  // UUID
  uuid: z.string().uuid('Must be a valid UUID'),

  // Email
  email: z.string().email('Must be a valid email address'),

  // Password (min 8 chars)
  password: z.string().min(8, 'Password must be at least 8 characters'),

  // NFL week number
  week: z.coerce.number().int().min(1).max(18, 'Week must be between 1 and 18'),

  // Player position
  position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),

  // Season type
  seasonType: z.enum(['regular', 'pre', 'post']).default('regular')
};

module.exports = {
  validate,
  commonSchemas
};
