# Sprint 6: Prisma ORM Migration - Attempt & Blockers

**Date:** 2025-11-26
**Status:** ⚠️ BLOCKED - Reverted to Legacy Controllers
**Completion:** 80% (Technical work complete, runtime blocker encountered)

---

## Overview

Sprint 6 aimed to migrate the backend from raw SQL queries to Prisma ORM for improved type safety, better developer experience, and easier database migrations. While the technical migration was successful, a runtime configuration issue with Prisma 7 and the LibSQL SQLite adapter prevented deployment.

---

## ✅ What Was Accomplished

### 1. Prisma Installation & Setup
- Installed Prisma packages:
  - `@prisma/client` v7.0.1
  - `prisma` CLI v7.0.1
  - `@prisma/adapter-libsql` v7.0.1
  - `@libsql/client` v0.15.15

### 2. Database Introspection
- Created [prisma/schema.prisma](backend/prisma/schema.prisma) with 16 models:
  - `managers`, `manager_emails`, `team_seasons`
  - `keepers`, `keeper_trade_locks`
  - `league_settings`, `league_rules`
  - `rule_change_proposals`, `rule_votes`, `rule_change_votes`, `rule_change_voting_locks`
  - `manual_trades`, `previews`, `summaries`, `ros_rankings`
  - `manager_credentials` (ignored due to missing unique identifier)

### 3. Prisma Service Module
- Created [backend/services/prisma.js](backend/services/prisma.js):
  - Centralized Prisma Client instance
  - LibSQL adapter configuration for SQLite
  - Logging for queries, errors, and warnings
  - Graceful shutdown handler

### 4. Controller Refactoring
Successfully created Prisma versions of 3 main controllers:

#### [managerController.prisma.js](backend/controllers/managerController.prisma.js)
- `getAllManagers()` - Uses `findMany()` with email relations
- `getManagerById()` - Uses `findUnique()` with includes
- `createManager()` - Transaction-based creation with email insertion
- `updateManager()` - Conditional updates with Prisma
- `deleteManager()` - Cascade deletes via Prisma relations

#### [seasonController.prisma.js](backend/controllers/seasonController.prisma.js)
- `getAllSeasons()` - Join with managers via Prisma relations
- `getSeasonByYear()` - Filtered queries with includes
- `getLeagueSettings()` - Simple unique lookups
- `createTeamSeason()`, `updateTeamSeason()`, `deleteTeamSeason()` - CRUD operations
- `getLeagueStats()` - GroupBy aggregations for championships

#### [keeperController.prisma.js](backend/controllers/keeperController.prisma.js)
- `getKeeperTradeLock()` - Unique lookups with defaults
- `updateKeeperTradeLock()` - Upsert pattern for lock management
- `saveKeepers()` - Transaction-based delete + bulk insert
- `isKeeperTradeLocked()` - Helper function with Prisma

### 5. Backup & Swap
- Created `.legacy.js` backups of original controllers
- Swapped controllers to Prisma versions
- Maintained complete rollback capability

---

## ❌ Blocking Issue

### Error: `URL_INVALID: The URL 'undefined' is not in a valid format`

**Root Cause:**
Prisma 7 introduced breaking changes requiring either an `adapter` or `accelerateUrl` for the PrismaClient constructor. The LibSQL adapter for SQLite is receiving an undefined URL despite proper path resolution.

**What We Tried:**
1. ✅ Verified database file exists at `backend/data/fantasy_football.db`
2. ✅ Used `path.resolve()` for absolute path
3. ✅ Converted Windows backslashes to forward slashes
4. ✅ Added logging to confirm dbPath: `C:\Users\marsb\Documents\GitHub\ff-dashboard\backend\data\fantasy_football.db`
5. ❌ LibSQL `createClient()` still receives undefined URL internally

**Code Snippet:**
```javascript
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'data', 'fantasy_football.db');
logger.info('Database path:', { dbPath }); // Logs correctly

const libsql = createClient({
  url: `file:${dbPath.replace(/\\/g, '/')}`  // URL is correct here
});

const adapter = new PrismaLibSql(libsql);  // Adapter receives undefined internally
```

**Error Stack:**
```
PrismaClientKnownRequestError:
Invalid `prisma.managers.findMany()` invocation
URL_INVALID: The URL 'undefined' is not in a valid format
```

---

## 🔄 Resolution: Revert to Legacy

Given time constraints and the complexity of debugging Prisma 7's new adapter system, we reverted to the original SQL-based controllers:

```bash
cd backend/controllers
cp managerController.legacy.js managerController.js
cp seasonController.legacy.js seasonController.js
cp keeperController.legacy.js keeperController.js
```

**Result:** Backend is fully functional with legacy controllers. ✅

---

## 📁 Files Created (Preserved for Future)

All Prisma work is preserved and ready for future attempts:

- [backend/prisma/schema.prisma](backend/prisma/schema.prisma) - Database schema
- [backend/prisma.config.ts](backend/prisma.config.ts) - Prisma CLI configuration
- [backend/services/prisma.js](backend/services/prisma.js) - Prisma Client setup
- [backend/controllers/managerController.prisma.js](backend/controllers/managerController.prisma.js)
- [backend/controllers/seasonController.prisma.js](backend/controllers/seasonController.prisma.js)
- [backend/controllers/keeperController.prisma.js](backend/controllers/keeperController.prisma.js)
- [backend/controllers/*.legacy.js](backend/controllers/) - Original backups

---

## 🔮 Future Recommendations

### Option 1: Wait for Prisma 7 Stability
- Monitor Prisma GitHub issues for LibSQL adapter fixes
- Wait for Prisma 7.x patch releases
- Attempt migration again in 2-3 months

### Option 2: Use Better-SQLite3 Adapter
Instead of LibSQL, try the `@prisma/adapter-better-sqlite3`:
```bash
npm install better-sqlite3 @prisma/adapter-better-sqlite3
```

Update `services/prisma.js`:
```javascript
const Database = require('better-sqlite3');
const { PrismaBetterSQLite } = require('@prisma/adapter-better-sqlite3');

const db = new Database('./data/fantasy_football.db');
const adapter = new PrismaBetterSQLite(db);

const prisma = new PrismaClient({ adapter });
```

### Option 3: Downgrade to Prisma 6
Prisma 6 had simpler SQLite configuration without adapters:
```bash
npm install prisma@6 @prisma/client@6
```

Then use direct connection string in schema:
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./data/fantasy_football.db"
}
```

### Option 4: Migrate to PostgreSQL
If type safety and migrations are critical, consider migrating from SQLite to PostgreSQL where Prisma has better support.

---

## 📊 Progress Summary

| Task | Status | Notes |
|------|--------|-------|
| Install Prisma | ✅ Complete | v7.0.1 installed |
| Create Schema | ✅ Complete | 16 models introspected |
| Generate Client | ✅ Complete | Types generated successfully |
| Prisma Service | ✅ Complete | Created with adapter |
| Manager Controller | ✅ Complete | Refactored to Prisma |
| Season Controller | ✅ Complete | Refactored to Prisma |
| Keeper Controller | ✅ Complete | Refactored to Prisma |
| Runtime Testing | ❌ Blocked | LibSQL adapter URL issue |
| **Final Status** | **Reverted** | Legacy controllers restored |

---

## 🎯 Key Learnings

1. **Prisma 7 is different** - Major breaking changes from v6, especially for SQLite
2. **Adapter ecosystem is new** - LibSQL adapter may have rough edges
3. **Raw SQL works fine** - Current implementation is stable and performant
4. **Premature optimization** - Prisma may not be necessary for this project's scale
5. **Preserve work** - All Prisma code saved for future attempts

---

## 💡 Conclusion

While Prisma ORM would provide excellent type safety and developer experience, the Prisma 7 + LibSQL adapter combination proved unstable for our SQLite use case. The legacy SQL-based approach continues to serve the project well.

**Recommendation:** Skip Sprint 6 for now and proceed to Sprint 7 (WebSockets & Security) or Sprint 8 (Testing). Revisit Prisma migration when:
- Prisma 7.1+ is released with better SQLite support
- LibSQL adapter documentation improves
- Project requirements demand stronger type safety

**Updated Sprint Progress:** 5/8 Sprints Complete (Sprints 1-5 ✅, Sprint 6 ⚠️ Deferred)

---

**Next Steps:** Proceed with remaining sprints using stable, working legacy controllers.
