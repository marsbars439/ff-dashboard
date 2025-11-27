# Preseason Tab Data Loading - Issue Resolution

## Issue
Rosters/managers/keepers were not getting pulled into the preseason tab.

## Root Cause Analysis

### **PRIMARY ISSUE: Database Not Configured**

After investigation, the main problem is that the database lacks required configuration data:

1. **Empty `league_settings` table** - No Sleeper league IDs configured for any season
2. **Missing `sleeper_user_id` values** - All managers have `null` for `sleeper_user_id`

When the frontend calls `/api/seasons/${year}/keepers`, the backend:
- Looks up the league ID for that year in `league_settings`
- Returns 404 "League ID not found for year" because the table is empty
- Cannot fetch roster data from Sleeper without a league ID

### **SECONDARY ISSUE: Code Bugs (Fixed)**

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

## **REQUIRED: Database Configuration Steps**

To get the preseason tab working, you need to configure your league settings:

### Step 1: Add League ID for Your Season

Use the API to set the Sleeper league ID for the year you want to display:

```bash
curl -X PUT http://localhost:3001/api/league-settings/2024 \
  -H "Content-Type: application/json" \
  -d '{"leagueId": "YOUR_SLEEPER_LEAGUE_ID"}'
```

Replace `YOUR_SLEEPER_LEAGUE_ID` with your actual Sleeper league ID (can be found in the Sleeper app URL).

### Step 2: Sync Season Data from Sleeper

After adding the league ID, sync the season data which will populate manager sleeper_user_ids:

```bash
curl -X POST http://localhost:3001/api/seasons/2024/sync \
  -H "Content-Type: application/json" \
  -d '{"leagueId": "YOUR_SLEEPER_LEAGUE_ID"}'
```

This will:
- Fetch all league data from Sleeper
- Populate manager sleeper_user_ids
- Load team seasons, rosters, and matchup data

### Step 3: Verify It Works

```bash
curl http://localhost:3001/api/seasons/2024/keepers
```

Should now return roster data with managers and players.

## Alternative: Direct Database Insert

If you prefer to manually configure the database:

```sql
-- Add league ID for 2024 season
INSERT INTO league_settings (year, league_id) VALUES (2024, 'YOUR_SLEEPER_LEAGUE_ID');

-- Update manager sleeper_user_ids (you'll need to look these up from Sleeper API)
UPDATE managers SET sleeper_user_id = '123456789' WHERE name_id = 'byronkou';
-- ... repeat for each manager
```

## Testing After Configuration

1. **Verify league settings** - `curl http://localhost:3001/api/league-settings`
2. **Test endpoint** - `curl http://localhost:3001/api/seasons/2024/keepers` should return roster data
3. **Check frontend** - Preseason tab should display rosters with manager names
4. **Verify manager associations** - Each roster should have a `manager_id` field populated

---

**Fixed**: November 26, 2025
**Files Modified**:
- [backend/controllers/seasonController.js](backend/controllers/seasonController.js)
