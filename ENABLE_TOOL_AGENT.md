# Enable Tool-Based Agent

## The Problem

You're using the OLD agent router which:
- Doesn't respond to our new system prompts
- Doesn't use the `requestedAgentType` for "Plan ahead" and "Review progress"  
- Doesn't call the new tools that generate cards
- Just responds with generic text

## The Solution

Enable the NEW tool-based agent that:
- ✅ Understands "Plan ahead" and "Review progress" modes
- ✅ Calls tools like `create_goal_with_habits` and `review_daily_habits`
- ✅ Returns structured data that renders as cards
- ✅ Has all our updated system prompts

## How to Enable

### Option 1: Export before running (recommended)

```bash
cd /Users/vivekanandaramu/AI/intention-growth-hub
export USE_TOOL_AGENT=true
npm run dev
```

### Option 2: Add to .env file

```bash
# Add this line to your .env file (create it if it doesn't exist)
USE_TOOL_AGENT=true
```

### Option 3: One-liner

```bash
USE_TOOL_AGENT=true npm run dev
```

## Verify It's Working

After starting the server, check the logs for:

```
[lifeCoachService] USE_TOOL_AGENT env var: true
[lifeCoachService] USE_TOOL_AGENT flag: true
[lifeCoachService] Using NEW tool-based agent
```

If you see:
```
[lifeCoachService] Using OLD agent router
```

Then `USE_TOOL_AGENT` is not set correctly.

## Expected Behavior After Enabling

### "Plan ahead" Button
- Agent asks: "What's on top of your mind right now?"
- As conversation proceeds, agent calls `create_goal_with_habits` tool
- Card appears with goal + habits

### "Review progress" Button  
- Agent asks: "How's your day going?"
- Agent calls `review_daily_habits` tool
- Card appears with today's habits checklist

## Debugging

If cards still don't render:

1. **Check logs for mode detection:**
   ```
   mode: "Plan Ahead"
   mode: "Review Progress"
   ```

2. **Check for tool calls:**
   ```
   Tool calls executed:
     1. create_goal_with_habits: ...
   ```

3. **Check for structured data:**
   ```
   ✅ Found structured data with type: goal_suggestion
   🎴 SENDING CARD TO FRONTEND: goal_suggestion
   ```

4. **Check browser console:**
   ```
   🎴 RECEIVED CARD FROM SERVER: goal_suggestion
   📊 Card payload detected: goal_suggestion
   ```

## Quick Test

1. Enable `USE_TOOL_AGENT=true`
2. Click "Plan ahead" button
3. Type "I want to build a website"
4. Agent should call `create_goal_with_habits` tool
5. Card should render with goal + habits

If step 4/5 don't happen, check server logs for tool calls.
