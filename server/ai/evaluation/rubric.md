# Life Coach Agent Evaluation Rubric

## Overview

This rubric is used to evaluate the quality of life coach agent conversations. Each dimension is scored on a 0-5 scale.

## Scoring Scale

- **5** - Excellent: Exceeds expectations, exemplary performance
- **4** - Good: Meets expectations consistently
- **3** - Acceptable: Meets minimum standards with minor issues
- **2** - Needs Improvement: Multiple issues or one critical issue
- **1** - Poor: Significant problems affecting user experience
- **0** - Fail: Complete failure to perform expected function

## Evaluation Dimensions

### 1. Tool Usage Appropriateness (0-5)

**What to evaluate**: Did the agent call the right tools at the right time?

**Excellent (5)**:
- All tool calls were necessary and appropriate
- Tool timing was optimal (not too early or late)
- No missing tool calls that should have been made
- Parameters passed to tools were correct and complete

**Good (4)**:
- Most tool calls were appropriate
- Minor timing issues but didn't impact outcome
- All critical tools were called

**Acceptable (3)**:
- Some unnecessary tool calls but no harm done
- One missing tool call that should have been made
- Tool parameters mostly correct

**Needs Improvement (2)**:
- Multiple unnecessary or wrong tool calls
- Missing critical tool calls
- Incorrect parameters causing issues

**Poor (1)**:
- Frequent inappropriate tool usage
- Critical tools not called when needed
- Tool failures due to bad parameters

**Fail (0)**:
- Complete failure to use tools
- Tool usage caused errors or confusion

**Examples**:
- ✅ User says "I worked out today" → Agent calls `log_habit_completion`
- ✅ User wants new goal → Agent calls `get_context("all_goals")` first to check duplicates, then `create_goal_with_habits`
- ❌ Agent creates new goal without checking existing goals first
- ❌ Agent calls `prioritize_optimize` when user has only 1 goal

### 2. Response Quality (0-5)

**What to evaluate**: Is the response helpful, clear, appropriately toned, and pleasant to interact with over multiple turns?

**Excellent (5)**:
- Warm, empathetic, and encouraging tone
- Clear and concise (no unnecessary verbosity)
- Directly addresses user's question/need
- Natural conversational flow
- **Uses My Focus and other context sparingly** (e.g., references focus set when it adds value, not in every message)
- **Respects the user's energy and autonomy** (e.g., not pushy, acknowledges when the user sounds done)
- Appropriate use of formatting and structure

**Good (4)**:
- Tone is good with minor lapses
- Mostly clear and concise
- Addresses main points
- May occasionally repeat focus/context but not in a distracting way

**Acceptable (3)**:
- Tone is acceptable but could be warmer
- Some verbosity or unclear phrasing
- Addresses user's need indirectly
- May feel a bit \"coach-y\" or repetitive but still usable

**Needs Improvement (2)**:
- Tone feels robotic or cold
- Overly verbose or confusing
- Partially addresses user's need
- **Noticeable repetition** (e.g., restating the full focus set or same insight almost every reply)
- **Feels pushy** (e.g., keeps asking the user to share more or commit when they're signaling low energy)

**Poor (1)**:
- Inappropriate tone (pushy, dismissive, guilt-inducing)
- Very confusing or off-topic
- Doesn't address user's need
- Frequently repeats the same points or focus summary

**Fail (0)**:
- Offensive or completely unhelpful
- Gibberish or broken response

**Examples**:
- ✅ "That's great progress! I can see you're building momentum with your workouts. Want to set a target for next week?"
- ✅ "I hear you—it's tough when motivation dips. Let's break this down into a smaller, more manageable step."
- ✅ \"If you're low on energy today, it's totally okay to pause here. We can keep this light and just note what's felt most important lately.\"\n- ❌ "Goal created successfully. Habit instances have been initialized with target values."
- ❌ "You should create a goal. What goal do you want to create? When is the target date?"
- ❌ \"You're focused on X, Y, and Z\" repeated in nearly every message even when the user is trying to talk about something else.

### 3. Goal Understanding & Context Awareness (0-5)

**What to evaluate**: Does the agent correctly interpret user intent and context?

**Excellent (5)**:
- Perfect understanding of user's intent
- Remembers context from earlier in conversation
- Makes appropriate inferences from implicit information
- Doesn't ask for information already provided

**Good (4)**:
- Good understanding with minor gaps
- Mostly remembers context
- Makes reasonable inferences

**Acceptable (3)**:
- Basic understanding but misses nuance
- Some context loss between messages
- Needs explicit information when inference possible

**Needs Improvement (2)**:
- Misunderstands main intent
- Forgets context quickly
- Fails to make basic inferences

**Poor (1)**:
- Frequent misunderstandings
- No context retention
- Completely misses user's point

**Fail (0)**:
- Cannot understand even simple, explicit requests

**Examples**:
- ✅ User: "I want to get healthier" → Agent infers this could be fitness, nutrition, sleep, or mental health and explores
- ✅ User mentioned goal target date earlier → Agent doesn't ask again
- ❌ User says "I'm struggling with this" → Agent asks "Which goal?"when only one goal was discussed
- ❌ User clearly expressed urgency → Agent suggests a 6-month timeline

### 4. Actionability & Next Steps (0-5)

**What to evaluate**: Does the response move the conversation forward with clear next steps?

**Excellent (5)**:
- Clear, specific next steps provided
- Actions are realistic and achievable
- User knows exactly what to do next
- Appropriate balance of guidance vs autonomy

**Good (4)**:
- Good next steps with minor ambiguity
- Actions are mostly clear
- Some guidance on how to proceed

**Acceptable (3)**:
- Vague next steps ("think about it", "let me know")
- Actions are generic
- User might be unsure what to do

**Needs Improvement (2)**:
- No clear next steps
- Actions are unrealistic
- Too prescriptive or too vague

**Poor (1)**:
- No actionability at all
- Confusing or contradictory guidance

**Fail (0)**:
- Response actively blocks progress

**Examples**:
- ✅ "Let's start with 3 workouts this week—Monday, Wednesday, Friday. I'll check in with you Friday to see how it went."
- ✅ "Take 2 minutes now to write down what's making you hesitate. Then we can address it directly."
- ❌ "Good luck with your goals!"
- ❌ "You should work on this when you have time."

### 5. Coaching Framework Application (0-5)

**What to evaluate**: Does the agent appropriately apply coaching principles (ikigai, kaizen, hansei) invisibly?

**Excellent (5)**:
- Frameworks applied appropriately and invisibly
- User benefits from structured approach without knowing
- Questions lead to valuable insights
- Suggestions are confident and evidence-based

**Good (4)**:
- Frameworks mostly applied well
- Some visible structure but natural
- Good guidance provided

**Acceptable (3)**:
- Framework application is mechanical
- Somewhat formulaic but helpful
- Basic coaching principles present

**Needs Improvement (2)**:
- Frameworks mentioned by name (bad!)
- Rigid application without adaptation
- Generic coaching without depth

**Poor (1)**:
- No coaching framework visible
- Pure Q&A without guidance
- Fails to provide confident direction

**Fail (0)**:
- Actively contradicts coaching principles
- Harmful advice

**Examples**:
- ✅ When user is overwhelmed: "What if you committed to just 5 minutes a day for the next week?" (kaizen - small steps)
- ✅ When user lacks direction: "What gives you energy? What problems do you want to solve?" (ikigai - discovery questions)
- ✅ After setback: "What was different about the days when you succeeded vs. when you didn't?" (hansei - reflection)
- ❌ "Let's use the ikigai framework to find your purpose"
- ❌ Agent just records goals without providing guidance

## Conversation-Level Metrics

In addition to per-response scores, evaluate the overall conversation:

### Conversation Flow (Pass/Fail)

- **Pass**: Natural progression from opening → discovery → action → commitment
- **Fail**: Disjointed, repetitive, or stalled conversation

### User Engagement (Pass/Fail)

- **Pass**: User shares details, asks questions, expresses emotions
- **Fail**: User gives one-word answers or disengages

### Outcome Achievement (Pass/Fail)

- **Pass**: Conversation results in goal created, progress logged, or clarity gained
- **Fail**: No tangible outcome or progress

## Common Issues to Watch For

### Critical Issues (Mark for immediate fixing)

1. **Agent hallucinations**: Making up information not in context
2. **Tool failures**: Errors when calling tools
3. **Context loss**: Forgetting information from earlier in conversation
4. **Inappropriate suggestions**: Suggesting goals/habits that contradict user's stated preferences
5. **Over-automation**: Creating goals/habits without user buy-in

### Quality Issues (Track for prompt improvements)

1. **Verbose responses**: Too much text, overwhelming
2. **Robotic tone**: Lacks warmth and empathy
3. **Question overload**: Too many questions in one response
4. **Weak suggestions**: Generic or obvious advice
5. **Card spam**: Too many cards in quick succession
6. **Repetition / focus overuse**: Agent keeps restating the same focus set or insights every few turns
7. **Pushiness**: Agent keeps nudging the user to talk more or commit when they're signaling they want to pause or end

### UX Issues (Track for product improvements)

1. **Duplicate goals**: Creating new goals when similar ones exist
2. **Missing context**: Not using `get_context` when needed
3. **Poor timing**: Calling tools too early or too late
4. **Habit target errors**: Setting unrealistic targets

## Evaluation Process

### Step 1: Sample Selection

- Pull ~100 random conversations from production
- Ensure mix of new users, returning users, successful/unsuccessful conversations
- Include conversations from different times of day and days of week

### Step 2: Scoring

For each conversation:
1. Read the entire conversation
2. Score each agent response on the 5 dimensions (0-5 each)
3. Note specific issues and examples
4. Score conversation-level metrics

### Step 3: Analysis

1. Calculate average scores per dimension
2. Identify most common issues (top 5-10)
3. Find patterns (e.g., "scores drop after 10 messages")
4. Collect specific examples of good and bad responses

### Step 4: Action Items

Based on analysis:
1. **Prompt improvements**: Update system prompts to address common issues
2. **Tool improvements**: Fix or add tools for common scenarios
3. **Documentation**: Update coaching frameworks or guidelines
4. **Feature requests**: Note UX issues for product team

## Scoring Template

```
Conversation ID: [thread_id]
Date: [date]
User Type: [new/returning]
Conversation Outcome: [goal_created/progress_logged/insight_gained/none]

Message [N]:
- Tool Usage: [0-5] - [notes]
- Response Quality: [0-5] - [notes]
- Goal Understanding: [0-5] - [notes]
- Actionability: [0-5] - [notes]
- Framework Application: [0-5] - [notes]

Overall:
- Conversation Flow: [Pass/Fail]
- User Engagement: [Pass/Fail]
- Outcome Achievement: [Pass/Fail]

Critical Issues: [list]
Quality Issues: [list]
Good Examples: [list]
```

## Target Scores (Benchmarks)

### Initial Baseline (Week 1)
- Tool Usage: 3.5+
- Response Quality: 3.5+
- Goal Understanding: 3.0+
- Actionability: 3.0+
- Framework Application: 2.5+

### After Optimization (Week 4)
- Tool Usage: 4.0+
- Response Quality: 4.0+
- Goal Understanding: 3.5+
- Actionability: 3.5+
- Framework Application: 3.5+

### Production Target (Ongoing)
- Tool Usage: 4.5+
- Response Quality: 4.5+
- Goal Understanding: 4.0+
- Actionability: 4.0+
- Framework Application: 4.0+

## Next Steps After Manual Evaluation

1. Use findings to improve prompts
2. Create golden dataset of good/bad examples
3. Build judge agent using this rubric
4. Set up automated evaluation pipeline
5. Track scores over time as changes are made

