# Preseason Tab Data Loading - Bug Fix

## Issue
Rosters/managers/keepers were not getting pulled into the preseason tab.

## Root Cause Analysis

### Problem 1: Missing `manager_sleeper_ids` Table
The migrated controller code was querying a table `manager_sleeper_ids` that doesn't exist in the database schema yet:

```sql
LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?
```

This caused SQL errors: `SQLITE_ERROR: no such table: manager_sleeper_ids`

### Problem 2: Missing `name_id` in SELECT
The controller query was missing `m.name_id` in the SELECT clause:

**Before:**
```sql
SELECT m.full_name, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
FROM managers m
LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?
```

**Issue:** The `sleeperService.getFinalRosters()` function expects managers to have a `name_id` property (see [backend/services/sleeperService.js:1469](backend/services/sleeperService.js#L1469)) to populate the `manager_id` field on each roster. Without it, all rosters would have `manager_id: null`.

## Fixes Applied

### File: [backend/controllers/seasonController.js](backend/controllers/seasonController.js)

#### Fix 1: `getFinalRosters()` function (lines 193-209)
Added try-catch to handle missing table and included `name_id` in query:

```javascript
// Try to fetch managers with season-specific sleeper IDs if table exists
let managers;
try {
  managers = await allAsync(`
    SELECT m.full_name, m.name_id, COALESCE(msi.sleeper_user_id, m.sleeper_user_id) as sleeper_user_id
    FROM managers m
    LEFT JOIN manager_sleeper_ids msi ON m.name_id = msi.name_id AND msi.season = ?
  `, [year]);
} catch (error) {
  // If manager_sleeper_ids table doesn't exist, fall back to just managers table
  if (error.message.includes('no such table: manager_sleeper_ids')) {
    logger.warn('manager_sleeper_ids table not found, using default sleeper_user_id from managers table');
    managers = await allAsync('SELECT full_name, name_id, sleeper_user_id FROM managers');
  } else {
    throw error;
  }
}
```

#### Fix 2: `getActiveWeekMatchups()` function (lines 119-135)
Same fix applied for consistency.

## Impact

### Before Fix
- ❌ `/api/seasons/${year}/keepers` would fail with SQL error
- ❌ No roster data would load in preseason tab
- ❌ Manager associations would be missing (`manager_id: null`)

### After Fix
- ✅ Route handles missing `manager_sleeper_ids` table gracefully
- ✅ Falls back to default `sleeper_user_id` from managers table
- ✅ Includes `name_id` so managers are properly associated with rosters
- ✅ Preseason tab should load rosters with manager information

## Testing Required

1. **Start server** - Verify it starts without errors
2. **Test endpoint** - `curl http://localhost:3001/api/seasons/2024/keepers` should return roster data
3. **Check frontend** - Preseason tab should display rosters with manager names
4. **Verify manager associations** - Each roster should have a `manager_id` field populated

## Future Work

If the `manager_sleeper_ids` table is needed for managing season-specific Sleeper user IDs:
1. Add table to database schema
2. Create migration script
3. Remove fallback logic (or keep it for backwards compatibility)

---

**Fixed**: November 26, 2025
**Files Modified**:
- [backend/controllers/seasonController.js](backend/controllers/seasonController.js)
