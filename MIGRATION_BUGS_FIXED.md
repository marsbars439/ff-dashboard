# Migration Bugs Fixed - Sprint 3

## Summary

During the Sprint 3 migration from monolithic server.js to controller-based architecture, several bugs were introduced where the migrated controllers didn't match the original response formats.

---

## Bug #1: Missing `name_id` in Manager Queries ✅ FIXED

**Location**: [backend/controllers/seasonController.js](backend/controllers/seasonController.js)

**Functions Affected**:
- `getActiveWeekMatchups()` (lines 122-135)
- `getFinalRosters()` (lines 196-209)

**Problem**: The SQL query was missing `m.name_id` in the SELECT clause, causing manager associations to fail.

**Original Query**:
```sql
SELECT m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
FROM managers m
LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?
```

**Fixed Query**:
```sql
SELECT m.full_name, m.name_id, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
FROM managers m
LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?
```

**Impact**: Without `name_id`, the `sleeperService.getFinalRosters()` couldn't populate `manager_id` on rosters, breaking manager-roster associations in the frontend.

---

## Bug #2: Missing `manager_sleeper_ids` Table Handling ✅ FIXED

**Location**: [backend/controllers/seasonController.js](backend/controllers/seasonController.js)

**Functions Affected**:
- `getActiveWeekMatchups()` (lines 127-135)
- `getFinalRosters()` (lines 201-209)

**Problem**: The code LEFT JOINed to `manager_sleeper_ids` table which doesn't exist, causing SQL errors.

**Error**: `SQLITE_ERROR: no such table: manager_sleeper_ids`

**Fix**: Added try-catch with fallback:
```javascript
try {
  managers = await allAsync(`
    SELECT m.full_name, m.name_id, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
    FROM managers m
    LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?
  `, [year]);
} catch (error) {
  if (error.message.includes('no such table: manager_sleeper_ids')) {
    logger.warn('manager_sleeper_ids table not found, using default sleeper_user_id from managers table');
    managers = await allAsync('SELECT full_name, name_id, sleeper_user_id FROM managers');
  } else {
    throw error;
  }
}
```

---

## Bug #3: Incorrect Response Format for Keepers ✅ FIXED

**Location**: [backend/controllers/keeperController.js](backend/controllers/keeperController.js)

**Function**: `getKeepersByYear()` (lines 112-135)

**Problem**: Controller returned just the keepers array instead of an object with metadata.

**Original (Broken)**:
```javascript
res.json(keepers);  // Just returns array
```

**Expected by Frontend** (from KeeperToolsContext.js:111):
```javascript
const savedKeepers = await savedKeepRes.json();
// Expects: { keepers: [...], locked, lockedAt, updatedAt }
```

**Fixed**:
```javascript
// Get lock status
const lockRow = await getKeeperTradeLockRow(req.db, year);

res.json({
  keepers,
  locked: lockRow ? lockRow.locked === 1 : false,
  lockedAt: lockRow?.locked_at || null,
  updatedAt: lockRow?.updated_at || null
});
```

**Frontend Error Fixed**:
```
Error fetching keepers: TypeError: can't access property "reduce", m.keepers is undefined
```

This occurred because the frontend tried to access `response.keepers` but got the array directly.

---

## Bug #4: Undefined `scheduleEntry` and `normalizedScheduleStatus` Variables ✅ FIXED

**Location**: [backend/services/sleeperService.js](backend/services/sleeperService.js)

**Lines Affected**: 791, 844, 872, 950, 1118

**Problem**: The variables `scheduleEntry` and `normalizedScheduleStatus` were referenced in multiple places but never defined, causing ReferenceErrors.

**Errors**:
- `ReferenceError: scheduleEntry is not defined`
- `ReferenceError: normalizedScheduleStatus is not defined`

**Impact**: The `/api/seasons/:year/active-week/matchups` endpoint was returning 500 errors, preventing the "Current Matchup" section from displaying on the Seasons tab.

**Fix**: Removed all references to the undefined `scheduleEntry` variable:

1. **Line 791** - Removed from `homeAway` fallback chain:
```javascript
// Before:
const homeAway = scheduleEntry?.home_away || scoreboardHomeAway || ...

// After:
const homeAway = scoreboardHomeAway || ...
```

2. **Line 847** - Removed from `isByeWeek` check:
```javascript
// Before:
const isByeWeek = ... || (scheduleEntry && scheduleEntry.status === 'bye') || ...

// After:
const isByeWeek = ... || (normalizedByeWeek != null && ...)
```

3. **Line 952** - Removed from inactive player check:
```javascript
// Before:
if (!team && !statsEntry && !scheduleEntry) { return 'inactive'; }

// After:
if (!team && !statsEntry) { return 'inactive'; }
```

4. **Line 1118** - Removed from `game_id` fallback chain:
```javascript
// Before:
game_id: statsEntry?.game_id || scheduleEntry?.game_id || scoreboardEntry?.gameId || null

// After:
game_id: statsEntry?.game_id || scoreboardEntry?.gameId || null
```

**Fix**: Removed all references to the undefined `normalizedScheduleStatus` variable:

5. **Line 844** - Removed from `isByeWeek` check:
```javascript
// Before:
const isByeWeek = normalizedStatus === 'bye' || normalizedStatsStatus === 'bye' ||
  normalizedScheduleStatus === 'bye' || normalizedScoreboardStatus === 'bye' || ...

// After:
const isByeWeek = normalizedStatus === 'bye' || normalizedStatsStatus === 'bye' ||
  normalizedScoreboardStatus === 'bye' || ...
```

6. **Line 872** - Removed from `statusCandidates` array:
```javascript
// Before:
const statusCandidates = [normalizedStatus, normalizedStatsStatus,
  normalizedScheduleStatus, normalizedScoreboardStatus].filter(Boolean);

// After:
const statusCandidates = [normalizedStatus, normalizedStatsStatus,
  normalizedScoreboardStatus].filter(Boolean);
```

**Result**: Active week matchups endpoint now works correctly and the "Current Matchup" section displays on the Seasons tab.

---

## Files Modified

1. **[backend/controllers/seasonController.js](backend/controllers/seasonController.js)**
   - Added `m.name_id` to manager queries in `getActiveWeekMatchups()` and `getFinalRosters()`
   - Added fallback handling for missing `manager_sleeper_ids` table

2. **[backend/controllers/keeperController.js](backend/controllers/keeperController.js)**
   - Added `getKeeperTradeLockRow()` helper function
   - Fixed `getKeepersByYear()` to return correct response format with lock metadata

3. **[backend/services/sleeperService.js](backend/services/sleeperService.js)**
   - Removed all references to undefined `scheduleEntry` variable (lines 791, 847, 952, 1118)

---

## Testing Recommendations

1. **Test Preseason Tab**:
   - Select a year with configured league settings
   - Verify rosters load with manager names
   - Verify keeper selections can be viewed/edited

2. **Test Seasons Tab**:
   - Verify "Current Matchup" section displays
   - Check that manager names appear on matchups

3. **Test Manager Associations**:
   - Verify each roster has a `manager_id` field populated
   - Check that manager names display correctly throughout the app

---

**Fixed**: November 26, 2025
**Migration Sprint**: Sprint 3 - Controller Architecture
**Bug Category**: Response Format Mismatches & Missing Data
