# Quick Start: Testing Card Rendering

## Summary of Changes

1. **Fixed Button Messages:** Buttons now send simple trigger messages instead of full conversational prompts
2. **Agent Must Initiate:** The agent is expected to start conversations based on the action type
3. **Enhanced Logging:** Added logging at key points to track card rendering

## How to Test

### 1. Check Your Environment

Make sure you're using the tool-based agent:
```bash
export USE_TOOL_AGENT=true
npm run dev
```

### 2. Watch the Logs

**Server Console:**
Look for these logs when clicking buttons:
```
[ChatHome] Sending action: { triggerMessage: 'Plan ahead', agent: 'suggest_goals' }
[chat/respond] Starting response { requestedAgentType: 'suggest_goals', ... }
[processWithToolAgent] Starting agent processing
[processWithToolAgent] ✅ Found structured data with type: goal_suggestion
[chat/respond] 🎴 SENDING CARD TO FRONTEND: goal_suggestion
```

**Browser Console (DevTools F12):**
```
[Composer] 📤 Sending to server: { threadId: '...', content: 'Plan ahead', requestedAgentType: 'suggest_goals' }
[Composer] 🎴 RECEIVED CARD FROM SERVER: goal_suggestion
[ConversationStream] 📊 Card payload detected: goal_suggestion
```

### 3. Expected Behavior by Button

#### "Plan ahead" Button
- Sends: `{ content: "Plan ahead", requestedAgentType: "suggest_goals" }`
- Agent should: Ask "What's on top of your mind?" and call `create_goal_with_habits` tool
- Expected card: `goal_suggestion` card with goal + habits

#### "Review progress" Button  
- Sends: `{ content: "Review progress", requestedAgentType: "review_progress" }`
- Agent should: Ask "How's your day going?" and call `review_daily_habits` tool
- Expected card: `habit_review` card with today's habits

### 4. What to Look For

✅ **Working:**
- Server logs show `requestedAgentType` being received
- Server logs show tools being called
- Server logs show `🎴 SENDING CARD TO FRONTEND`
- Browser shows `🎴 RECEIVED CARD FROM SERVER`
- Card appears in chat UI

❌ **Broken:**
- No logs for cards being sent
- Tool returns empty output
- Agent doesn't call any tools
- Card type doesn't match any renderer

### 5. Debugging Steps

If cards aren't rendering:

1. **Check Agent Mode:** Look for logs like:
   ```
   mode: "Plan Ahead"
   contextInstructions: "You are helping the user plan ahead..."
   ```

2. **Check Tool Calls:** Look for:
   ```
   Tool calls executed:
     1. create_goal_with_habits: { input: {...}, output: {...} }
   ```

3. **Check Structured Data:** Look for:
   ```
   ✅ Found structured data with type: goal_suggestion
   Full structured data: { type: 'goal_suggestion', goal: {...}, habits: [...] }
   ```

4. **Check Frontend:** Look in browser console:
   ```
   🎴 RECEIVED CARD FROM SERVER: goal_suggestion
   📊 Card payload detected: goal_suggestion
   ```

### 6. Card Types to Test

| Button | Agent Type | Expected Tool | Card Type | Component |
|--------|------------|---------------|-----------|-----------|
| Plan ahead | suggest_goals | create_goal_with_habits | goal_suggestion | GoalSuggestionCard |
| Review progress | review_progress | review_daily_habits | habit_review | Inline habit card |
| Optimize focus | prioritize_optimize | (optimization logic) | optimization | OptimizationCard |
| Surprise me | surprise_me | share_insight | insight | Inline insight card |

## Troubleshooting

### Issue: Agent responds but no card
- Check: Is `structuredData` in the response?
- Check: Does tool output have `type` property?
- Solution: Ensure tools return proper JSON with `type` field

### Issue: Card shows wrong content
- Check: Is card data structure matching the component props?
- Solution: Verify tool output matches `GoalSuggestionCard` interface

### Issue: Button doesn't trigger agent
- Check: Is `requestedAgentType` being sent?
- Solution: Verify button click handler in `ChatHome.tsx`

## Next Steps

Once cards are rendering:
1. Test each button
2. Verify card content is correct
3. Check card actions (accept/dismiss) work
4. Verify cards persist to database
