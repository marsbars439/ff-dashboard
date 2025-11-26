# Sprint 3 Migration Status

## Overview

This document tracks the systematic migration of all routes from the monolithic [server.js](backend/server.js) to controllers. We're migrating incrementally to avoid breaking the application again.

**Status**: =á In Progress - Controllers Created, Routes Not Yet Integrated

## Strategy

1.  Create all controllers with extracted route logic
2. = Create route files that use controllers
3. ó Add database middleware to attach helpers (runAsync, allAsync, getAsync)
4. ó Mount new routes ALONGSIDE old routes in server.js
5. ó Test each endpoint to ensure identical behavior
6. ó Remove old routes only after confirmation

## Controllers Created

###  SeasonController ([seasonController.js](backend/controllers/seasonController.js))
Handles all season-related operations:
- `GET /api/team-seasons` - Get all seasons with manager names
- `GET /api/team-seasons/:year` - Get seasons for specific year
- `GET /api/seasons/:year/matchups` - Get all matchups for season
- `GET /api/seasons/:year/active-week/matchups` - Get current week matchups with lineups
- `GET /api/seasons/:year/playoffs` - Get playoff bracket
- `GET /api/seasons/:year/keepers` - Get final rosters for keeper selection
- `POST /api/team-seasons` - Create team season
- `PUT /api/team-seasons/:id` - Update team season
- `DELETE /api/team-seasons/:id` - Delete team season
- `GET /api/managers/:nameId/seasons` - Get seasons for specific manager

**Dependencies**: sleeperService (for matchups, playoffs, rosters)

###  RankingsController ([rankingsController.js](backend/controllers/rankingsController.js))
Handles ROS rankings:
- `GET /api/ros-rankings` - Get all ROS rankings with last updated timestamp
- `POST /api/ros-rankings/refresh` - Refresh rankings from FantasyPros

**Dependencies**: refreshRosRankings service function

###  TradesController ([tradesController.js](backend/controllers/tradesController.js))
Handles manual trades:
- `GET /api/trades/:year` - Get all trades for year
- `POST /api/trades` - Create new trade
- `DELETE /api/trades/:id` - Delete trade

###  SettingsController ([settingsController.js](backend/controllers/settingsController.js))
Handles league settings:
- `GET /api/league-settings` - Get all league settings with lock states
- `PUT /api/league-settings/:year` - Update league ID for year
- `POST /api/league-settings/:year/manual-complete` - Mark season as complete

###  StatsController ([statsController.js](backend/controllers/statsController.js))
Handles statistics:
- `GET /api/stats` - Get championships, total seasons, total managers
- `GET /api/health` - Health check endpoint

###  UploadController ([uploadController.js](backend/controllers/uploadController.js))
Handles Excel uploads:
- `POST /api/upload-excel` - Upload and import Excel file

**Dependencies**: multer middleware, XLSX library

###  SleeperIdsController ([sleeperIdsController.js](backend/controllers/sleeperIdsController.js))
Handles manager-sleeper ID mappings:
- `GET /api/manager-sleeper-ids` - Get all mappings
- `POST /api/manager-sleeper-ids` - Create mapping
- `PUT /api/manager-sleeper-ids/:id` - Update mapping
- `DELETE /api/manager-sleeper-ids/:id` - Delete mapping

###  ManagerController ([managerController.js](backend/controllers/managerController.js))
Handles manager operations (already existed, updated):
- `GET /api/managers` - Get all managers with emails
- `GET /api/managers/:id` - Get manager by ID
- `POST /api/managers` - Create manager with email handling
- `PUT /api/managers/:id` - Update manager
- `DELETE /api/managers/:id` - Delete manager

**Dependencies**: managerService (for email hydration)

###  KeeperController ([keeperController.js](backend/controllers/keeperController.js))
Handles keeper operations (already existed):
- `GET /api/keepers/:year` - Get keepers for year with lock status
- `POST /api/keepers/:year/:rosterId` - Save keepers for roster
- `PUT /api/keepers/lock` - Lock/unlock keeper selections

**Note**: Contains transaction support for atomic keeper saves (critical fix from code review)

## Route Files Status

### ó To Be Created:

1. `backend/routes/seasons.js` - Mount seasonController routes
2. `backend/routes/rankings.js` - Mount rankingsController routes
3. `backend/routes/trades.js` - Mount tradesController routes
4. `backend/routes/settings.js` - Mount settingsController routes
5. `backend/routes/stats.js` - Mount statsController routes
6. `backend/routes/upload.js` - Mount uploadController routes
7. `backend/routes/sleeperIds.js` - Mount sleeperIdsController routes
8. Update `backend/routes/managers.js` - Mount updated managerController
9. Update `backend/routes/keepers.js` - Mount keeperController

## Database Middleware Required

Controllers expect `req.db` to have:
- `runAsync(sql, params)` - Promisified db.run()
- `getAsync(sql, params)` - Promisified db.get()
- `allAsync(sql, params)` - Promisified db.all()
- `db` - Raw database connection (for some operations)

Controllers also expect `req.services` to have:
- `sleeperService` - For matchups, playoffs, rosters
- `refreshRosRankings` - For ROS rankings refresh

**Action needed**: Create middleware to attach these helpers to `req.db` and `req.services`

## Integration Plan

### Step 1: Create Route Files
Create route files that:
- Import the controller
- Define routes using Express Router
- Export router factory function

### Step 2: Create Database Middleware
Add middleware in server.js that attaches:
```javascript
app.use((req, res, next) => {
  req.db = {
    runAsync,
    getAsync,
    allAsync,
    db
  };
  req.services = {
    sleeperService,
    refreshRosRankings
  };
  next();
});
```

### Step 3: Mount New Routes
In server.js, mount new routes BEFORE old routes:
```javascript
// New controller routes
app.use('/api', require('./routes/seasons')({ db }));
app.use('/api', require('./routes/rankings')({ db }));
// ... etc
```

### Step 4: Test Each Endpoint
- Use Postman/curl to test each endpoint
- Verify response matches old route exactly
- Check database changes are identical

### Step 5: Remove Old Routes (AFTER Testing)
Once all endpoints verified working:
- Comment out old route implementations
- Test again to ensure nothing breaks
- Remove commented code

## Critical Fixes to Apply

After migration complete, apply these fixes from code review:

### 1. Token Cleanup (Memory Leak Fix)
**File**: [backend/middleware/auth.js](backend/middleware/auth.js) (if we create it) OR server.js
**Current**: Tokens accumulate indefinitely
**Fix**: Add hourly cleanup with `unref()`

### 2. Database Race Condition
**File**: [backend/server.js](backend/server.js)
**Current**: Server starts before DB initialized
**Fix**: Await DB init before starting server

### 3. Transaction Support
**File**: [backend/controllers/keeperController.js](backend/controllers/keeperController.js)
**Status**:  Already implemented in controller
**Action**: Ensure this is used when routes are mounted

## Routes Already Migrated (From Previous Sprint 3)

These routes were already extracted but lost in rollback:
-  `/api/auth/*` - Using [backend/routes/auth.js](backend/routes/auth.js)
-  `/api/rules/*` - Using [backend/routes/rules.js](backend/routes/rules.js)
-  `/api/sleeper/*` - Using [backend/routes/sleeper.js](backend/routes/sleeper.js)
-  `/api/summaries/*` - Using [backend/routes/summaries.js](backend/routes/summaries.js)

## Files Not Changing

These Sprint 1-2 files remain valid:
-  [backend/utils/logger.js](backend/utils/logger.js)
-  [backend/middleware/errorHandler.js](backend/middleware/errorHandler.js)
-  [backend/utils/errors.js](backend/utils/errors.js)
-  [backend/utils/constants.js](backend/utils/constants.js)
-  [backend/utils/validateEnv.js](backend/utils/validateEnv.js)
-  [backend/middleware/validation.js](backend/middleware/validation.js)
-  [backend/validators/keeperSchemas.js](backend/validators/keeperSchemas.js)
-  [backend/validators/seasonSchemas.js](backend/validators/seasonSchemas.js)

## Next Steps

1. Create all route files
2. Add database middleware to server.js
3. Mount new routes alongside old ones
4. Test one route group at a time
5. Apply critical fixes
6. Remove old routes after verification

## Testing Checklist

For each endpoint:
- [ ] Returns same status code
- [ ] Returns same response structure
- [ ] Returns same data
- [ ] Database changes are identical
- [ ] Error handling works the same way
- [ ] Frontend still works correctly

## Risk Mitigation

-  All old routes remain functional during migration
-  New routes added alongside, not replacing
-  Can roll back by simply unmounting new routes
-  Testing each route before removing old implementation
-  Documented all dependencies clearly

## Lessons Learned

1.  Never remove routes without testing replacements first
2.  Keep old routes working while adding new ones
3.  Document all dependencies and services needed
4.  Test incrementally, one route group at a time
5.  Have clear rollback plan before starting

---

**Last Updated**: {Current Date}
**Migration Started**: {Session Start}
**Expected Completion**: After all route files created and tested
