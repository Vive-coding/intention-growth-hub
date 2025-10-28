# Changes Made

## Removed Simulation Functionality
1. **Deleted**: `server/routes/simulateConversations.ts`
2. **Updated**: `server/routes.ts` - removed simulation route registration
3. **Updated**: `client/src/pages/chat/ChatHome.tsx` - removed simulation buttons

## Files to Edit for Prompts
See `FILES_TO_EDIT.md` for complete list.

**Main file to edit**: `server/ai/singleAgent.ts` (lines 17-95)
- This contains the system prompt that instructs the agent

**Tool files to edit**: `server/ai/tools/*.ts`
- Each tool has a `description` field in its schema
- These descriptions tell the LLM when/why to use each tool

## What to Focus On

The agent is currently too conversational and not calling tools enough.
You'll want to make the prompts more explicit and mandatory about tool usage.

Key issues to address:
1. Make tool calling required in specific situations
2. Remove ambiguity about when to use tools  
3. Add hard triggers for tool usage
4. Ensure tool descriptions are clear and prescriptive
