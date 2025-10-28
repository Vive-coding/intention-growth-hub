# Fix: Agent Hallucinating Goal Titles

## Problem

The agent was mentioning goal titles in its text BEFORE calling the prioritize_goals tool, causing hallucinations.

Example of the bug:
- Agent text: "Top 3 Priorities: **Prepare for Upcoming Interview**..."
- Card shows: "Enter 3 more interview processes"
- These don't match!

## Root Cause

The agent was analyzing goals and mentioning specific titles BEFORE calling the tool. The tool then selects DIFFERENT goals based on reasoning, causing a mismatch.

## Solution

Updated the prompt to enforce this flow:

1. **CALL TOOL FIRST** - Don't mention any specific goal titles yet
2. Tool returns the ACTUAL goal titles that exist in the database
3. **THEN** mention those exact titles in your response
4. This ensures text always matches the card

## Changes Made

### `singleAgent.ts`

**Prior to tool description:**
- Added: "Do NOT mention specific goal titles in your text BEFORE calling this tool"
- Added: "Call this tool FIRST to get the actual prioritized goals from the database"
- Added: "Only AFTER the tool returns the actual goal titles can you mention them by name"
- Added: "Use THOSE exact titles in your response"

**Playbook section 3:**
- Changed from: "Before calling, analyze goals... Call with reasoning"
- Changed to: "Call prioritize_goals FIRST (do not mention specific goals yet)"
- Added: "Only THEN mention those specific goal titles"

## How It Works Now

### Correct Flow:
1. User: "I want to prioritize my goals"
2. Agent: "Let me analyze your goals..." [DOES NOT mention titles yet]
3. Agent: Calls prioritize_goals tool
4. Tool: Returns actual goals ["Enter 3 more interview processes", "Secure First 100 Users", ...]
5. Agent: Uses THOSE exact titles in response
6. Card shows same goals as agent text

### What We Prevent:
- Agent guessing goal titles
- Mentioning goals that don't exist
- Text not matching the card

