# Snapshot Debug Guide

This guide will help you systematically verify what's happening with snapshots in your production environment.

## 🔍 Debugging Steps

### 1. Run Database Debug Script

First, check what snapshot data exists in your production database:

```bash
cd /Users/vivekanandaramu/AI/intention-growth-hub
node debug_snapshots.js
```

This will show you:
- Total snapshots in the database
- User-specific snapshots
- Life metrics and their snapshots
- Recent snapshot activity
- Goals and their correlation with snapshots

### 2. Test Snapshot Creation Process

Verify that snapshot creation works correctly:

```bash
node test_snapshot_creation.js
```

This will:
- Find a test user
- Get their life metrics and goals
- Calculate current progress manually
- Create/update a snapshot
- Verify the snapshot was created correctly

### 3. Check Production Logs

With the enhanced logging now in place, check your production logs for:

```
🔍 [SNAPSHOTS DEBUG] Request received:
📅 [SNAPSHOTS DEBUG] Date range:
📊 [SNAPSHOTS DEBUG] Initial fetch result:
⚠️ [SNAPSHOTS DEBUG] No snapshots found for This Month, attempting lazy upsert...
✅ [SNAPSHOTS DEBUG] Lazy upsert completed
```

### 4. Use Client-Side Debug Tool

In development mode, the `DetailedLifeOverview` component now includes a debug tool that will show:
- API response data
- Snapshot counts
- Goal counts
- Progress data availability

### 5. Check API Endpoints Directly

Test the snapshot API directly:

```bash
# Replace with your actual user ID and metric name
curl "https://your-app.railway.app/api/life-metrics/Career%20Growth/progress-snapshots?period=This%20Month" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🚨 Common Issues and Solutions

### Issue 1: No Snapshots in Database
**Symptoms:** Debug script shows 0 snapshots
**Causes:**
- Snapshots were never created
- User has no goals
- Snapshot creation is failing silently

**Solutions:**
1. Run the test snapshot creation script
2. Check if user has goals and life metrics
3. Verify snapshot creation triggers are working

### Issue 2: Snapshots Exist But Chart Shows Empty
**Symptoms:** Database has snapshots but chart is empty
**Causes:**
- Date range filtering issues
- Timezone problems
- Data format mismatches

**Solutions:**
1. Check the date range calculations in the API
2. Verify timezone handling
3. Check the data format returned by the API

### Issue 3: Lazy Upsert Failing
**Symptoms:** "Lazy snapshot upsert failed" in logs
**Causes:**
- Database connection issues
- Permission problems
- Data validation errors

**Solutions:**
1. Check database connectivity
2. Verify user permissions
3. Check the `upsertTodayProgressSnapshot` function

### Issue 4: Wrong Data in Snapshots
**Symptoms:** Snapshots exist but show incorrect progress
**Causes:**
- Progress calculation errors
- Goal status issues
- Data synchronization problems

**Solutions:**
1. Verify goal progress calculations
2. Check goal status updates
3. Ensure data consistency

## 🔧 Quick Fixes

### Force Snapshot Creation
If snapshots are missing, you can force creation by:

1. **Via API:** Make a request to any goal-related endpoint (this triggers snapshot creation)
2. **Via Database:** Run the test script to create snapshots manually
3. **Via Code:** Call `upsertTodayProgressSnapshot` directly

### Reset Snapshots
If snapshots are corrupted:

```sql
-- Delete all snapshots for a user (replace with actual user ID)
DELETE FROM progress_snapshots WHERE user_id = 'your-user-id';

-- Or delete all snapshots
DELETE FROM progress_snapshots;
```

### Verify Data Integrity
Check that your data is consistent:

```sql
-- Check for orphaned snapshots
SELECT * FROM progress_snapshots 
WHERE life_metric_name NOT IN (
  SELECT name FROM life_metric_definitions
);

-- Check for missing user snapshots
SELECT DISTINCT user_id FROM life_metric_definitions
WHERE user_id NOT IN (
  SELECT DISTINCT user_id FROM progress_snapshots
);
```

## 📊 Expected Data Flow

1. **User creates a goal** → Snapshot created for all metrics
2. **User completes a habit** → Snapshot updated for relevant metric
3. **User updates goal progress** → Snapshot updated for relevant metric
4. **Chart loads** → Fetches snapshots for date range
5. **No snapshots found** → Lazy upsert creates today's snapshot

## 🎯 Next Steps

1. Run the debug scripts to identify the specific issue
2. Check production logs for error patterns
3. Use the client-side debug tool to inspect API responses
4. Fix the identified issue
5. Verify the fix works end-to-end

## 📝 Logging

The enhanced logging will show you exactly what's happening:

- **Request details:** User, metric, period, timestamp
- **Date range calculations:** Start/end dates for the query
- **Database results:** Count and sample of returned snapshots
- **Lazy upsert attempts:** When and why they're triggered
- **Error details:** Full error information with context

This should give you complete visibility into the snapshot system and help identify where the issue lies.
