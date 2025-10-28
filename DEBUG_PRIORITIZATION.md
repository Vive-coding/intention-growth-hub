# Debug Prioritization Not Showing in My Focus

## The Problem
1. User accepts priorities via card
2. Card shows "Accepted" ✅  
3. But My Focus page shows "No priorities yet"

## How It Should Work

### Database Flow
1. `prioritize_goals` tool runs
2. Tool fetches all active goals for user
3. Tool selects top 3 (by createdAt for now)
4. Tool calls `MyFocusService.persistFromAgent()` → saves to `myFocusPrioritySnapshots` table
5. Card shows Accept/Reject buttons

### On Accept
6. User clicks "Accept These Priorities"
7. `onAccept` handler invalidates My Focus cache
8. My Focus page fetches from `/api/my-focus`
9. `MyFocusService.getMyFocus()` checks for latest snapshot
10. If snapshot exists, calls `hydrateSnapshotGoals()`
11. Returns priority goals

## Debugging Steps

### 1. Check if data is in database
```sql
SELECT * FROM my_focus_priority_snapshots 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC 
LIMIT 1;
```

### 2. Check server logs
```bash
tail -f server.log | grep -i "priorit"
```

### 3. Check frontend cache
```javascript
// In browser console
localStorage.getItem('priority_...') // Should be 'accepted'
```

### 4. Check API response
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/my-focus | jq
```

## Likely Issues

### Issue 1: Snapshot not being created
- Check if `MyFocusService.persistFromAgent()` is being called
- Check if `myFocusPrioritySnapshots` table insert is failing
- Look for error logs: "[MyFocus] failed to persist priority snapshot"

### Issue 2: Snapshot not being read
- Check if `getMyFocus()` is finding the snapshot
- Check if `hydrateSnapshotGoals()` is working
- The snapshot query is: `orderBy(desc(myFocusPrioritySnapshots.createdAt)).limit(1)`

### Issue 3: Cache not invalidating
- Check if `queryClient.invalidateQueries({ queryKey: ['/api/my-focus'] })` is being called
- The MyFocusService has CACHE_TTL_MS = 0 (cache disabled), so this shouldn't be the issue

### Issue 4: Items format mismatch
The tool returns:
```json
{
  "type": "prioritization",
  "items": [
    { "id": "goal-123", "title": "...", "description": "...", "rank": 1 }
  ]
}
```

But persistFromAgent expects:
```json
{
  "type": "prioritization",
  "items": [
    { "goalInstanceId": "goal-123", "rank": 1, "reason?": "..." }
  ]
}
```

**THIS IS THE BUG!** The tool is creating items with `id`, `title`, `description` but should be using `goalInstanceId`.

