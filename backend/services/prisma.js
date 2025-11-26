/**
 * Prisma Service
 * Centralized Prisma Client instance with logging and error handling
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');
const logger = require('../utils/logger');

// Create LibSQL client for SQLite
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'data', 'fantasy_football.db');
logger.info('Database path:', { dbPath });

const libsql = createClient({
  url: `file:${dbPath.replace(/\\/g, '/')}`  // Convert Windows backslashes to forward slashes
});

const adapter = new PrismaLibSql(libsql);

const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' }
  ]
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('Prisma Query', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`
    });
  });
}

prisma.$on('error', (e) => {
  logger.error('Prisma Error', { message: e.message, target: e.target });
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma Warning', { message: e.message });
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
