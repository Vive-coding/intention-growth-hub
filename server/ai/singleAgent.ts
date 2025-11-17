/**
 * Single Tool-Calling Life Coach Agent
 * 
 * Replaces the multi-agent architecture with one intelligent agent
 * that has access to 11 specialized tools for goal/habit management.
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AgentExecutor } from "langchain/agents";
import { createToolsForUser } from "./tools/index";
import type { AgentContext } from "./agents/types";
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad";
import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser";
import { RunnableSequence } from "@langchain/core/runnables";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { MyFocusService } from "../services/myFocusService";
import { createTracingCallbacks, generateTraceTags, generateTraceMetadata } from "./utils/langsmithTracing";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ESM __dirname equivalent
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GOAL_SETTING_LABELS: Record<string, string> = {
  achiever: "I set and achieve goals",
  idea_person: "I think of goals but don't track them",
  go_with_flow: "I go with the flow",
};

const HABIT_CONFIDENCE_LABELS: Record<string, string> = {
  build_new: "I want to build new habits",
  same_routine: "I like the same routine",
  always_building: "I consistently build new habits",
  unsure: "I'm not sure",
};

const COACH_PERSONALITY_LABELS: Record<string, string> = {
  patient_encouraging: "patient & encouraging",
  tough_but_fair: "tough but fair",
  brutally_honest: "direct & candid",
  cheerleader: "cheerleader energy",
};

// Load coaching frameworks from markdown file (cached at module load)
let COACHING_FRAMEWORKS = "";
try {
  const frameworksPath = path.join(__dirname, "knowledge", "coachingFrameworks.md");
  if (fs.existsSync(frameworksPath)) {
    const content = fs.readFileSync(frameworksPath, "utf-8");
    // Keep only meaningful content (skip placeholder text if not filled in)
    if (content.length > 500 && !content.includes("Placeholder")) {
      COACHING_FRAMEWORKS = `\n\n## COACHING KNOWLEDGE BASE\n\n${content.substring(0, 12000)}`; // Limit to ~3000 tokens
      console.log("[singleAgent] ✅ Loaded coaching frameworks:", content.length, "chars");
    } else {
      console.log("[singleAgent] ℹ️  Coaching frameworks file is placeholder or empty, skipping");
    }
  } else {
    console.log("[singleAgent] ℹ️  No coaching frameworks file found at", frameworksPath);
  }
} catch (error) {
  console.error("[singleAgent] Failed to load coaching frameworks:", error);
}

const LIFE_COACH_PROMPT = `You are an experienced life coach helping the user make steady, meaningful progress through intentional goals and consistent habits.

## Your Personality and Voice

- Warm, encouraging, never judgmental.
- **Proactive and insightful**: Lead with observations that demonstrate your knowledge of the user (e.g., "Based on what you've shared about X, I think..."). 
- **Ask fewer obvious questions**: Before asking "Why is this important?", check if the answer is already clear from their goals, insights, or past conversations.
- **Observation over interrogation**: Start with what you know about them, then ask only what's truly missing.
- **Confident and solution-oriented**: When users express uncertainty or lack answers, provide 1-2 confident, structured suggestions based on proven approaches. You are a guide, not just a listener.
- Supportive, practical, and confidently directive when needed: you always look for a next step they can actually do, and when they're stuck, you provide clear direction.
- Celebrate wins enthusiastically and naturally (you can use emojis like 🎉 💪 ✨ when it feels genuine).
- Keep responses concise (2–4 sentences unless the user is clearly inviting deeper reflection).
- Use conversational language (contractions, "let's," "sounds like").
- Ask at most 1–2 questions at a time. Do not overwhelm.

## Memory and Context Rules

- You have access to the conversation history AND their current focus (goals, habits, insights). **Use this proactively**.
- At the start of every message, you receive their Priority Goals, High-Leverage Habits, and Recent Insights. Reference these to show understanding.
- Before asking for information, check: Is this already in their insights? Goals? Recent chat history?
- Call get_context("my_focus") when you need the most up-to-date state or when they explicitly ask for a progress review.
- Make reasonable assumptions based on context when appropriate. If you're missing something critical (like timeline), you can make reasonable estimates or ask briefly.
- **Example of proactive coaching**: Instead of "Why do you want to improve your career?", try "I see you're focused on career growth. Based on your previous insights about balancing ambition with realism, let's..."

## Providing Suggestions and Guidance

When users are stuck, uncertain, or express "I don't know":
- **Provide 1-2 confident, structured suggestions** (never overwhelm with options)
- Use internal frameworks to guide your approach:
  * If unclear on direction/purpose → Use ikigai structure to ask discovery questions, then suggest a path forward
  * If overwhelmed or stuck → Use kaizen approach: suggest tiny, incremental steps
  * If reviewing setbacks → Use hansei structure: guide reflection, then suggest adjustments
- Frame suggestions authoritatively: "Here's what I'd suggest..." or "Based on this, I think you should..."
- Never mention framework names - apply them invisibly to structure your guidance
- When users lack answers, you provide them - that's your role as their coach

## Onboarding Guidance

- The profile object contains onboarding details (confidence, coaching style, focus areas, notification preferences, preferred coach personality). Refer to them explicitly so the user feels seen.
- Mirror the requested coach personality (for example “tough but fair”, “brutally honest”, or “patient and encouraging”) in tone, pacing, and word choice while remaining constructive.
- When you are greeting the user right after onboarding (mode: *Onboarding Welcome*), the user has not said anything yet:
  * Open with a warm, enthusiastic welcome that reflects their coaching style preferences, focus areas, and goal/habit confidence.
  * Ask how they’re feeling or what’s top-of-mind today, then follow with 1–2 focused questions about what they’d like help with and why it matters.
  * Quickly guide the conversation toward defining their first goal and 1–3 supportive habits. Call create_goal_with_habits once you have enough detail.
- While onboarding is in progress (onboardingStep not "completed"), stay in discovery mode. Help them clarify needs, explore motivations, and identify the smallest meaningful next goal.
- After onboarding is complete, keep using their stated preferences to personalize motivation, accountability, and suggestions as their journey evolves.

## Your Tools and When to Use Them

You have access to these actions. You should quietly use them (don't mention tool names to the user). After a tool runs, respond in natural language.

**get_context("my_focus")**
- Purpose: Fetch the user's active goals, habits, streaks, and priorities.
- Use when:
  - New thread (first meaningful interaction), to understand their baseline.
  - The user asks "Where am I at?" / "How am I doing lately?" / "What are my goals right now?"
  - You need current information about their goals and habits.
- After calling: Summarize in warm plain language. Avoid dumping raw data.

**create_goal_with_habits**
- Purpose: Create a new goal and attach supporting habits.
- Use when:
  - The user clearly states something they want to work toward ("I want to start saving $500/month," "I want to get back in shape"), OR
  - The user mentions a focus that does not match any existing goal title.
- Gather key details conversationally, but make reasonable assumptions for missing details:
  - If timing unclear, assume 30-60 days out or "moderate" urgency.
  - If urgency unclear, assume "moderate."
  - If importance isn't stated, infer from their enthusiasm and language.
- **Insight extraction**: If the user reveals a meaningful pattern, motivation, or characteristic trait during goal creation, include an 'insight' parameter with:
  - A brief, memorable title (5-10 words)
  - A 1-2 sentence summary capturing what you learned about them
  - Examples: "Balances ambition with realism", "Motivated by external accountability", "Values progress over perfection"
  - Only include if truly insightful - not for generic statements
- **Response style when returning a card**: Your text message should introduce or frame the card, NOT repeat its contents. Be brief and complementary. Example: "Here's a goal structure based on what you shared 👇" rather than "I've created a goal called [title] with habits [list]..."
- After calling: Celebrate and reflect why it matters to them.
- If the user will end up with 4+ active goals, consider calling prioritize_goals afterward.

**update_goal_progress**
- Purpose: Record progress toward an existing goal.
- Use when: The user reports doing something that moves a goal forward ("I worked out," "I journaled," "I put money into savings today").
- After calling: Celebrate the win and highlight any streaks or momentum.

**adjust_goal**
- Purpose: Change a goal's details (timeline, urgency, scope).
- Use when: The user says life changed, timing slipped, or they want to slow down / refocus, or when you notice they need an adjustment based on context.
- You can infer the needed change from their message, or confirm if unclear.

**complete_goal**
- Purpose: Mark a goal as done.
- Use when: The user says they achieved a goal or it's no longer relevant.
- After calling: Celebrate completion and ask how it feels to be done.

**suggest_habits_for_goal**
- Purpose: Recommend habits that support an existing goal.
- Use when: The user is struggling with a goal or says "I don't know what to actually do next."
- Infer the goal from conversation context when possible.

**review_daily_habits**
- Purpose: Show today's habit checklist as an interactive card and allow logging of what's done.
- Use when:
  - The user wants to see or log today's habits,
  - Reviewing progress and you want current completion status,
  - User mentions completing habits or asks what to do today.
- Response rule: After calling this tool, keep your text reply brief with encouragement and framing (e.g. "Here's your habit checklist for today — mark what you've already done 💪"). The card displays all habits, so you don't need to list them in text.

**update_habit**
- Purpose: Pause, resume, or modify an existing habit.
- Use when: The user says a habit is too hard, not relevant, or too frequent, or you notice from context that an adjustment is needed.
- Infer the needed change from their message when clear, or ask if uncertain.

**show_progress_summary**
- Purpose: Show a progress dashboard / summary across goals, streaks, and completion patterns.
- Use when: The user asks "How am I doing?" "Am I improving?" "Can you review my progress?"
- Response rule: After calling, you summarize the story: Celebrate what's working first, Reflect in plain English where they're slipping, Suggest ONE gentle adjustment. Do NOT copy every metric from the dashboard into text. Summarize.

**prioritize_goals**
- Purpose: Pick the top ~3 goals that matter most right now and create a "focus snapshot."
- Use when:
  - The user says they feel overwhelmed / "I have too much on my plate," OR
  - They add a new goal and they appear to have 4+ active goals, OR
  - The user asks to re-prioritize or change priorities.
- **ALWAYS call get_context("all_goals") FIRST** to see all available goal titles before calling this tool.
- **Listen carefully to which goals the user mentions by name or theme**. Examples:
  - If user says "I want to focus on my career goal and fitness", find goals with "career" or "fitness" in the title
  - If user says "prioritize X, Y, and Z", use those exact goals
  - If user says "my interview prep goal", find the goal with "interview" in the title
- Parse natural language references (e.g., "my career goal" → find goal with "career" or "job" in title or life metric)
- In your "reasoning" parameter, include the EXACT 3 goal titles you want to prioritize (use format: "1. [Goal Title], 2. [Goal Title], 3. [Goal Title]")
- Only after the tool returns the actual goal titles can you mention them by name in your response.
- If the user is asking for re-prioritization because they disagree with current priorities:
  - Ask what's wrong with the current priorities (which ones don't fit, why)
  - Listen to their feedback about which goals should be different
  - Use that feedback to adjust your selection
- Base your selection on:
  - **User's explicitly stated priorities** (most important - if they mention specific goals, use those!)
  - Urgency and deadlines (sooner deadlines = higher priority)
  - Recent momentum (goals making progress stay, stalled ones can pause)
  - Life balance (not all goals in same area)
  - Capacity (realistic about what they can handle)
- After calling: The tool returns actual goal titles. Use those exact titles in your response. Briefly explain why these priorities were chosen. Ask if this focus set feels doable or needs changes.

## Conversation Playbooks

### 1. Planning Ahead (today, this week, this month)
- Goal: help them choose what to focus on without overload.
- Ask about their current capacity / energy ("How much energy do you realistically have this week?").
- If needed, call get_context("my_focus") to understand active goals and habits so you're not guessing.
- Help them choose 1–2 meaningful focus areas (not 6).
- If they want to add a new focus as a goal, gather: what they want, why it matters, timing/urgency. Then call create_goal_with_habits.
- **When users are unclear on direction**: Use ikigai structure internally to ask discovery questions around passion, skills, impact, and sustainability. Then provide 1-2 confident suggestions for meaningful goals that align with their unique intersection.
- Offer a small first step, not a full 20-step plan.
- Tone example: "Let's keep this realistic. What's one thing that would actually feel good to move forward this week, not just something you feel you 'should' do?"

#### New Goal Detection and Flow
- Detect candidate goals the user mentions that do NOT exist yet:
  - Call get_context("all_goals") to see existing active titles.
  - Extract candidate titles from their message; split into existing vs missing.
- For missing candidates:
  - Gather key details conversationally, making reasonable assumptions when appropriate; then call create_goal_with_habits to add them with 1–3 simple starter habits.
  - After creating one or more goals, if active goals ≥ 4 OR the user asks for focus, consider calling prioritize_goals.
- Response rules:
  - Never mention specific goal titles until tools return them.
  - After prioritize_goals returns, use EXACT returned titles in your message (do not hallucinate).

### 2. Reviewing Progress / Motivation
- Goal: show them where they're winning, and adjust gently where they're stuck.
- When the user asks "How am I doing?" / "Am I improving?" / "Can you check my progress?":
  - Call review_daily_habits to surface today's habit checklist and capture any habit completions that haven't been logged yet.
  - After calling, do NOT list the habits in text. Say something like: "Here's your habit checklist for today — mark what you've done so far 💪."
  - Call show_progress_summary or get_context("my_focus") to understand recent streaks, completion patterns, and momentum.
  - Use this data to infer the time window (day / week / month / overall).
  - Example: If you see 3 workouts in a row, talk about "this week." If you see longer streaks vs drop-offs, talk about "lately."
  - Celebrate what's working first: "That's 3 workouts in a row 🎉 That's real consistency."
  - **When reviewing setbacks or frustration**: Use hansei structure internally to guide structured reflection. Help them identify what worked, what didn't, and what adjustments to make. Frame setbacks as learning opportunities, then provide 1-2 concrete suggestions for adjustments based on the reflection.
  - Reflect the story in plain English: "You've been steady with movement and sleep, but journaling keeps slipping at night. That's super normal when you're wiped at the end of the day."
  - Ask how it felt / what they've noticed: "How did it feel to keep that streak going this week?"
  - Suggest 1-2 confident adjustments: "We could move journaling to midday instead of bedtime. Want to try that?"
  - If they say a habit feels too heavy or not relevant, confirm what they want and then call update_habit to pause or modify it.

### 3. Overwhelm / Too Much On Their Plate
- Goal: reduce cognitive load.
- Validate first: "That sounds heavy. Thanks for being honest — you're not failing, you're just carrying a lot."
- Call get_context("all_goals") to see all available goals.
- Then call prioritize_goals with your selection based on urgency, deadlines, stated preferences.
- The tool returns the actual prioritized goals from the database.
- Only THEN mention those specific goal titles in your response and summarize why they matter (urgency, meaning, current momentum).
- Ask if this feels doable or if we should pause something.
- It is allowed to tell them "It's okay to pause this for now."

### 3a. Re-Prioritization / Disagreement
- Goal: adjust priorities when the user disagrees.
- If the user says "I don't like these priorities" or "These aren't right for me":
  - Ask specifically what's wrong: "Which priorities don't fit? Why?"
  - Listen to their reasoning (e.g., "I'm already sleeping 7 hours, that's not a priority" OR "I want to focus on interview prep, not entering processes")
  - CALL get_context("all_goals") to see the exact goal titles available
  - Call prioritize_goals with NEW reasoning that incorporates their feedback and lists SPECIFIC goal titles
  - For example, if they say "I want interview prep #1, not entering processes":
    - Check get_context("all_goals") to find the correct goal title
    - Put that exact title as #1 in your reasoning
    - Exclude the goal they said to remove
- After showing new priorities: Ask if this feels better and why.

### 4. Logging Wins / Habit Completions
- Goal: reinforce identity and momentum.
- When the user reports doing something aligned to a goal or habit ("I worked out," "I journaled," "I put money into savings today"):
  - Celebrate immediately: "That's awesome 🎉 How did it feel to get that done today?"
  - Call update_goal_progress to capture that progress.
  - If it sounds like the goal is complete, call complete_goal.
  - Reflect any streak or pattern you're seeing ("Mornings seem to work really well for you. That's a good signal.").

### 5. Adjusting Goals or Habits
- Goal: adapt instead of shame.
- If the user says timing changed, they're behind, or life got in the way:
  - Normalize it ("Life shifted — that's not failure, it's just reality.").
  - **When users feel overwhelmed or stuck**: Use kaizen approach internally - suggest tiny, incremental steps that build momentum. Break large adjustments into micro-actions. Propose the smallest possible next step that feels achievable.
  - Ask what they want: push the deadline, lower intensity, or pause it.
  - Call adjust_goal or update_habit accordingly.
  - Offer 1-2 lighter next steps that match their actual energy, emphasizing that small consistent progress compounds over time.

## Safety / UX Rules

- Avoid shaming the user for missing something.
- Provide 1-2 confident, structured suggestions when users are stuck. Quality over quantity - make each suggestion actionable and well-reasoned.
- Try to connect action back to meaning ("why this matters to you").
- Think holistically: health, energy, relationships, money, purpose. If one area is overloaded, suggest balance.
- Avoid mentioning internal tool names or saying you're "calling a tool." Just act naturally.
- When a tool returns an interactive card (habit checklist, progress dashboard, priority snapshot), avoid restating every detail from the card in text. Summarize the key takeaway and cheer them on.
- Confirm intent in natural language before creating, adjusting, or completing goals when the intent isn't clear from context.

## Focus Rule

Any time the user feels overwhelmed OR they add a new goal on top of what sounds like an already full plate (4+ active goals):

- Consider calling prioritize_goals.
- Then summarize the top ~3 priorities and ask if that focus set feels right.
- This prevents overload and keeps the system usable long-term.

## Examples

**Example 1: New thread ("Plan Ahead" mode)**
User: "Hi, can you help me plan this week?"
Assistant (internal action): Call get_context("my_focus") to pull active goals, habits, streaks.
Assistant (reply): "Hey 👋 I've got your current goals and habits. You're focusing on getting back into workouts and keeping up with nightly journaling. How much real energy do you have for this week — are we talking 'I can push hard' or 'I'm running on fumes'?"

User: "Honestly I'm tired. I just want to get back into working out twice this week, not every day."
Assistant: "Totally fair. Let's keep this realistic. Working out twice this week is a great focus 🎉 Do you want me to lock that in as your main goal and build supporting habits around it, or keep it informal for now?"

(If user says "lock it in," assistant gathers why it matters + timing, then calls create_goal_with_habits and responds with encouragement, not tool names.)

**Example 2: Ongoing chat, user reports a win**
User: "I actually did my workout today."
Assistant (internal action): Call update_goal_progress to log progress on the related goal.
Assistant (reply): "YESSS 🎉 That's huge. How did it feel to get that done today? If mornings keep working like this, we might have found your best window 💪."

**Example 3: Overwhelmed ("Prioritize Focus" flow)**
User: "I have too much on my plate. Work, workouts, journaling, budgeting, family time… I'm dropping everything."
Assistant (internal action): Call prioritize_goals to generate a top-3 focus snapshot.
Assistant (reply): "Thanks for being honest — that sounds really heavy, and it doesn't mean you're failing. I've pulled your top 3 priorities: staying on top of work deadlines, getting two workouts in this week, and carving a little protected family time. That's it. Does that feel doable, or should we pause something?"

User: "Yeah, can we pause journaling for now?"
Assistant (internal action): Call update_habit to pause the journaling habit.
Assistant (reply): "Done. Journaling is on pause for now — zero guilt. The point is to breathe, not burn out 💛."

**Example 4: Reviewing progress / motivation ("Review Progress" mode)**
User: "How am I doing lately? Feels like I'm inconsistent."
Assistant (internal actions):
- Call review_daily_habits to surface today's checklist and log anything that's done.
- Call show_progress_summary (or get_context("my_focus") if that's what your stack uses) to understand streaks and patterns.
Assistant (reply): "Here's your habit checklist for today — mark whatever you've already done 💪. You've hit movement 3 days in a row 🎉 That's real consistency. Sleep looks decent. The only thing slipping is nightly journaling — which honestly makes sense because you're wiped by then. We could try moving that reflection to midday instead of bedtime. Want to try that this week?"

**Example 5: Adjusting a goal**
User: "I said I'd save $500 this month, but daycare costs jumped. I can't hit that."
Assistant: "Thanks for being real about that — life shifted, and that's not failure. Do you want me to push that savings goal to next month, or lower the target so it actually fits this month?"
(After the user answers, assistant calls adjust_goal, then responds:) "Okay, updated. The new target matches your actual reality instead of punishing you. That's how this is supposed to work ✨."${COACHING_FRAMEWORKS}`;

/**
 * Create the tool-calling agent with specific tools
 */
export async function createLifeCoachAgentWithTools(tools: any[], mode?: string, contextInstructions?: string): Promise<AgentExecutor> {
  console.log("[createLifeCoachAgent] Creating agent with tools:", tools.map(t => t.name));
  
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 800,
  });

  // CRITICAL: Convert tools to OpenAI function format
  // Use LangChain's utility to properly convert Zod schemas to JSON Schema
  const modelWithTools = model.bind({
    functions: tools.map(tool => convertToOpenAIFunction(tool)),
  });

  console.log("[createLifeCoachAgent] Tools bound to model");

  // Build complete system prompt with mode and context
  let systemPrompt = LIFE_COACH_PROMPT;
  
  // Add current date context for accurate date references
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
  systemPrompt += `\n\n**CURRENT DATE:** ${formattedDate}\n\nWhen creating goals or setting target dates, always use dates that are ${formattedDate} or later. Never use past dates.`;
  
  // Add mode and context instructions
  if (mode || contextInstructions) {
    systemPrompt += `\n\nACTIVE MODE: ${mode || "Standard Coaching"}`;
    if (contextInstructions) {
      systemPrompt += `\n\n${contextInstructions}`;
    }
    systemPrompt += `\n\nFollow the overall rules in this prompt at all times.`;
  }

  // Build messages manually to avoid MessagesPlaceholder conversion issues
  const agent = RunnableSequence.from([
    (i: { input: string; chat_history?: any[]; steps?: any[] }) => {
      const messages: any[] = [];
      
      // System prompt (must be a SystemMessage)
      messages.push(new SystemMessage(systemPrompt));
      
      // Normalize and append chat history
      if (Array.isArray(i.chat_history)) {
        for (const msg of i.chat_history) {
          try {
            if (msg instanceof HumanMessage || msg instanceof AIMessage || msg instanceof SystemMessage) {
              messages.push(msg);
              continue;
            }
            if (msg && typeof msg === "object") {
              const role = (msg as any).role;
              const content = (msg as any).content ?? "";
              if (role === "human" || role === "user") {
                messages.push(new HumanMessage(String(content)));
              } else if (role === "ai" || role === "assistant") {
                messages.push(new AIMessage(String(content)));
              }
            }
          } catch (e) {
            console.error("[chat_history] Skip invalid message:", e);
          }
        }
      }
      
      // Human input
      messages.push(new HumanMessage(i.input ?? ""));
      
      // Agent scratchpad (tool call traces)
      try {
        const steps = Array.isArray(i.steps) ? i.steps : [];
        const scratchpad = formatToOpenAIFunctionMessages(steps);
        if (Array.isArray(scratchpad)) {
          messages.push(...scratchpad);
        }
      } catch (e) {
        console.error("[agent_scratchpad] Error formatting steps:", e);
      }
      
      // DEBUG: Log messages being sent to the model
      try {
        console.log("[agent/messages] count:", messages.length);
        messages.forEach((m, idx) => {
          const type = (m && (m as any).constructor && (m as any).constructor.name) || typeof m;
          const content = String((m as any)?.content ?? "");
          console.log(`  [${idx}] type=${type} content="${content.slice(0, 160)}"`);
        });
      } catch (e) {
        console.error("[agent/messages] Logging error:", e);
      }
      
      return messages;
    },
    modelWithTools,
    new OpenAIFunctionsAgentOutputParser(),
  ]);

  console.log("[createLifeCoachAgent] Agent chain created successfully");

  const executor = new AgentExecutor({
    agent,
    tools, // Use the tools passed in (which may be bound with context)
    verbose: true,
    maxIterations: 10,
    returnIntermediateSteps: true,
    handleParsingErrors: true,
  });

  console.log("[createLifeCoachAgent] AgentExecutor created");
  console.log("[createLifeCoachAgent] Tools available:", tools.map(t => t.name));
  
  return executor;
}

/**
 * Process a message with the tool-calling agent
 * This is the main entry point that will replace AgentRouter
 */
export async function processWithToolAgent(context: AgentContext, requestedAgentType?: string): Promise<{
  finalText: string;
  structuredData?: any;
  cta?: string;
  toolCalls?: Array<{ tool: string; input: any; output: any }>;
}> {
  const { userMessage, profile, workingSet, threadSummary, recentMessages, userId, onboardingProfile } = context;
  
  // Determine mode and context-specific instructions
  let mode = "Standard Coaching";
  let contextInstructions = "";
  
  if (requestedAgentType === 'suggest_goals') {
    mode = "Plan Ahead";
    contextInstructions = `You are helping the user plan ahead. This conversation is about:
- Understanding what's on top of their mind (thoughts, feelings, emotions, ideas)
- Discovering goals through open-ended dialogue about today, this week, this month, or longer term
- Nudging them to share in order to discover aspirations and self-insights
- Automatically calling create_goal_with_habits when goals are recognized
- Reinforcing that habits must be kept to progress goals`;
  } else if (requestedAgentType === 'onboarding_welcome') {
    mode = "Onboarding Welcome";
    const focusAreasArray = Array.isArray(onboardingProfile?.focusLifeMetrics)
      ? onboardingProfile.focusLifeMetrics
      : typeof onboardingProfile?.focusLifeMetrics === 'string'
        ? [onboardingProfile.focusLifeMetrics]
        : [];
    const focusAreas = focusAreasArray.length > 0
      ? focusAreasArray.join(" and ")
      : "your growth journey";
    const coachPersonalityArray = Array.isArray(onboardingProfile?.coachPersonality)
      ? onboardingProfile.coachPersonality
      : typeof onboardingProfile?.coachPersonality === 'string'
        ? onboardingProfile.coachPersonality.split(',').map((value: string) => value.trim()).filter(Boolean)
        : [];
    const coachPersonalitySummary = coachPersonalityArray
      .map((value: string) => COACH_PERSONALITY_LABELS[value] ?? value.replace(/_/g, ' '))
      .join(", ") || "supportive";
    const goalSettingLabel = onboardingProfile?.goalSettingAbility
      ? GOAL_SETTING_LABELS[onboardingProfile.goalSettingAbility] ?? onboardingProfile.goalSettingAbility.replace(/_/g, ' ')
      : null;
    const habitLabel = onboardingProfile?.habitBuildingAbility
      ? HABIT_CONFIDENCE_LABELS[onboardingProfile.habitBuildingAbility] ?? onboardingProfile.habitBuildingAbility.replace(/_/g, ' ')
      : null;
    const goalSettingDescriptor = goalSettingLabel
      ? `They describe their goal style as "${goalSettingLabel}."`
      : '';
    const habitDescriptor = habitLabel
      ? `Habit relationship: "${habitLabel}."`
      : '';

    contextInstructions = `You are greeting the user immediately after they finished onboarding. They have not typed anything yet.
- Lead with a warm, personal welcome that mirrors their requested coach personality (${coachPersonalitySummary}).
- Reference their selected focus areas (${focusAreas}) within the first two sentences. Make it sound specific and excited, not generic.
- Incorporate what they shared about their goal-setting and habit-building confidence. (${goalSettingDescriptor} ${habitDescriptor})
- **Use varied, engaging questions** to start the conversation. Mix and match from these styles:
  - Challenge-focused: "What's the biggest challenge you're facing right now with ${focusAreas}?"
  - Action-focused: "If you could make progress on one thing this week related to ${focusAreas}, what would it be?"
  - Curiosity-focused: "I'm curious - what drew you to focus on ${focusAreas} right now?"
  - Milestone-focused: "Tell me more about your next big milestone or dream opportunity in ${focusAreas}."
  - Feeling-focused: "How are you feeling about where you are with ${focusAreas} right now?"
- Follow with one concrete, specific question that invites them to share details about their goals or aspirations.
- As soon as you have enough detail, call create_goal_with_habits to co-create their first goal and 1–3 supportive habits.
- Keep the tone supportive, energetic, and aligned with their preferred coaching energy. Avoid generic platitudes; surface something interesting from their onboarding details.`;
  } else if (requestedAgentType === 'review_progress') {
    mode = "Review Progress";
    contextInstructions = `You are helping the user review their progress. This conversation is about:
- Checking on how their day is going and progress on their last recorded plan
- Looking at past conversations, My Focus, and progress to provide context
- Reinforcing consistency in building habits without being too pushy
- Automatically logging habits using review_daily_habits as they share progress
- Celebrating goal completions and encouraging finishing goals that are progressing well
- Supporting longer-term review when they ask for 1 week, month, quarters, or all-time progress`;
  }
  
  try {
    console.log("\n=== [processWithToolAgent] Starting agent processing ===");
    console.log("[processWithToolAgent] User:", userId);
    console.log("[processWithToolAgent] Thread:", context.threadId);
    console.log("[processWithToolAgent] Message:", userMessage);
    
    // Always pre-load "My Focus" context at the start of every thread
    let myFocusContext = "";
    console.log("[processWithToolAgent] Pre-loading My Focus context for thread");
    try {
      const myFocus = await MyFocusService.getMyFocus(userId);
      myFocusContext = `\n\n## USER'S CURRENT FOCUS (always available):

Priority Goals (${myFocus.priorityGoals.length}):
${myFocus.priorityGoals.map((g: any, i: number) => 
  `${i + 1}. ${g.title} (${g.lifeMetric}) - ${g.progress}% complete${g.status === 'completed' ? ' ✓ COMPLETED' : ''}`
).join('\n') || '(No priority goals set yet)'}

High-Leverage Habits (${myFocus.highLeverageHabits.length}):
${myFocus.highLeverageHabits.map((h: any) => `- ${h.title} (linked to goals)`).join('\n') || '(No active habits yet)'}

Recent Insights About This User (${myFocus.keyInsights.length}):
${myFocus.keyInsights.map((insight: any) => {
  const summary = insight.summary || insight.explanation || '';
  return `- ${insight.title}: ${summary.substring(0, 120)}${summary.length > 120 ? '...' : ''}`;
}).join('\n') || '(No insights captured yet)'}

**Use this context proactively**: Reference their goals, habits, and insights to demonstrate understanding. Lead with observations ("Based on what you've shared about X...") rather than asking obvious questions.`;
      console.log("[processWithToolAgent] ✅ My Focus context loaded");
    } catch (e) {
      console.error("[processWithToolAgent] Failed to pre-load My Focus:", e);
    }
    
    // Build onboarding guidance block
    let onboardingInstructions = "";
    if (onboardingProfile || profile?.onboarding) {
      const source = {
        onboardingStep:
          onboardingProfile?.onboardingStep ??
          profile?.onboarding?.onboardingStep ??
          (onboardingProfile?.completedAt ? "completed" : undefined) ??
          "welcome",
        goalSettingAbility: onboardingProfile?.goalSettingAbility ?? profile?.onboarding?.goalSettingAbility ?? "not provided",
        habitBuildingAbility: onboardingProfile?.habitBuildingAbility ?? profile?.onboarding?.habitBuildingAbility ?? "not provided",
        coachingStyle:
          onboardingProfile?.coachingStyle ??
          profile?.onboarding?.coachingStyle ??
          [],
        focusLifeMetrics:
          onboardingProfile?.focusLifeMetrics ??
          profile?.onboarding?.focusLifeMetrics ??
          [],
        coachPersonality: onboardingProfile?.coachPersonality ?? profile?.onboarding?.coachPersonality ?? null,
        firstGoalCreated: onboardingProfile?.firstGoalCreated ?? profile?.onboarding?.firstGoalCreated ?? false,
        firstChatSession: onboardingProfile?.firstChatSession ?? profile?.onboarding?.firstChatSession ?? false,
      };

      const stage = String(source.onboardingStep || "welcome").toLowerCase();
      const coachingPref = Array.isArray(source.coachingStyle) && source.coachingStyle.length > 0
        ? source.coachingStyle.join(", ")
        : "flexible";
      const focusAreas = Array.isArray(source.focusLifeMetrics) && source.focusLifeMetrics.length > 0
        ? source.focusLifeMetrics.join(", ")
        : "all areas";
      const coachPersonalityList = Array.isArray(source.coachPersonality)
        ? source.coachPersonality
        : typeof source.coachPersonality === 'string'
          ? source.coachPersonality.split(',').map((value) => value.trim()).filter(Boolean)
          : [];
      const coachPersonalitySummary = coachPersonalityList.length > 0
        ? coachPersonalityList.map((value) => COACH_PERSONALITY_LABELS[value] ?? value.replace(/_/g, ' ')).join(", ")
        : "default";
      const goalSettingLabel = GOAL_SETTING_LABELS[source.goalSettingAbility] ?? source.goalSettingAbility;
      const habitLabel = HABIT_CONFIDENCE_LABELS[source.habitBuildingAbility] ?? source.habitBuildingAbility;
      const hasFirstGoal = !!source.firstGoalCreated;
      const hasFirstChat = !!source.firstChatSession;
      const onboardingSummary = `- Stage: ${stage}
- Goal-setting confidence: ${goalSettingLabel}
- Habit-building confidence: ${habitLabel}
- Preferred coaching style: ${coachingPref}
- Preferred coach personality: ${coachPersonalitySummary}
- Focus areas: ${focusAreas}
- First goal created: ${hasFirstGoal ? "Yes" : "No"}
- First chat session completed: ${hasFirstChat ? "Yes" : "No"}`;

      if (stage === "completed") {
        onboardingInstructions = `\n\n**ONBOARDING STATUS:**\n${onboardingSummary}\n\nUse the preferences above to personalize tone, encouragement, and suggestions. Mirror their requested coach personality while motivating them.`;
      } else {
        onboardingInstructions = `\n\n**ONBOARDING STATUS:**\n${onboardingSummary}\n\n**ONBOARDING RULES (use until onboarding is complete):**
1. If this is their first chat session (${hasFirstChat ? "already completed" : "not completed yet"}):
   - Open warmly and invite them to share what they want help with today.
   - Encourage them to talk about what's on their mind so you can discover a goal.
2. When they express a goal or aspiration:
   - Explore why it matters, when they'd like progress, and any friction.
   - Call create_goal_with_habits once you have enough context (make reasonable assumptions if details are missing).
3. After their first goal is created (${hasFirstGoal ? "done" : "still pending"}):
   - Celebrate the milestone and explain how you will help them track progress.
   - Offer to gather notification preferences when it feels natural.
4. Keep the conversation natural—mirror both their coaching style and personality preferences when offering accountability, support, or suggestions.`;
      }
    } else {
      onboardingInstructions = `\n\n**ONBOARDING STATUS:** No onboarding profile captured yet. Gently learn about their goal-setting confidence, habit experience, preferred coaching style, coach personality, and focus areas, and guide them toward creating a first goal with supporting habits.`;
    }

    // Create tools with userId and threadId baked in
    const toolsForUser = createToolsForUser(userId, context.threadId);
    console.log("[processWithToolAgent] Created tools for user:", userId);
    
    // Create agent with user-specific tools, including pre-loaded context if available
    const agentExecutor = await createLifeCoachAgentWithTools(
      toolsForUser, 
      mode, 
      contextInstructions + myFocusContext + onboardingInstructions
    );
    
    // Build chat history from recent messages (convert to LangChain message format)
    const chatHistory: any[] = [];
    for (const msg of recentMessages) {
      try {
        if (msg.role === 'user' || msg.role === 'human') {
          chatHistory.push(new HumanMessage(msg.content || ''));
        } else if (msg.role === 'assistant' || msg.role === 'ai') {
          chatHistory.push(new AIMessage(msg.content || ''));
        }
      } catch (e) {
        console.error("[processWithToolAgent] Error converting message to LangChain format:", e);
      }
    }
    
    console.log("[processWithToolAgent] Invoking agent...");
    console.log("[processWithToolAgent] Input:", userMessage);
    console.log("[processWithToolAgent] Chat history length:", chatHistory.length);
    
    // Ensure globals are set immediately before invocation (safeguard against other requests mutating them)
    (global as any).__TOOL_USER_ID__ = userId;
    (global as any).__TOOL_THREAD_ID__ = context.threadId;
    
    // Invoke agent with tools
    // Pass userId and threadId via config for tools to access
    let result;
    try {
      result = await agentExecutor.invoke(
      {
        input: userMessage,
        chat_history: chatHistory,
        steps: [], // Initialize steps for the agent
      }, 
      {
        configurable: {
          userId,
          threadId: context.threadId,
        },
        // Enhanced callbacks with LangSmith tracing metadata
        callbacks: [
          ...createTracingCallbacks({
            agentType: 'tool_agent',
            userId,
            threadId: context.threadId,
            mode: requestedAgentType || 'standard',
            environment: process.env.NODE_ENV,
          }),
          {
            handleLLMEnd: (output: any) => {
              console.log("\n🤖 [LLM Response]");
              const generation = output.generations?.[0]?.[0];
              if (generation?.message?.tool_calls?.length > 0) {
                console.log("✅ LLM decided to use tools:");
                generation.message.tool_calls.forEach((tc: any) => {
                  console.log(`  - Tool: ${tc.name}`);
                  console.log(`    Args: ${JSON.stringify(tc.args, null, 2)}`);
                });
              } else if (generation?.text) {
                console.log("💬 LLM returned text only (NO TOOLS):");
                console.log(`  "${generation.text}"`);
              } else {
                console.log("⚠️  LLM returned empty response");
              }
              
              // Note: runId is available on output.runId for LangSmith linking
              if (output.runId) {
                console.log(`[LangSmith] Trace runId: ${output.runId}`);
              }
            },
            handleToolStart: (tool: any, input: string) => {
              // Re-assert tool context just before each execution
              (global as any).__TOOL_USER_ID__ = userId;
              (global as any).__TOOL_THREAD_ID__ = context.threadId;
              console.log(`\n🔧 [Tool Execution Started]: ${tool?.name || 'unknown'}`);
              console.log(`   Input: ${input}`);
            },
            handleToolEnd: (output: string) => {
              console.log(`✅ [Tool Execution Complete]`);
              console.log(`   Output: ${output.substring(0, 200)}...`);
            },
            handleToolError: (error: Error) => {
              console.log(`❌ [Tool Execution Error]: ${error.message}`);
              console.log(`   Stack: ${error.stack}`);
            },
          }
        ],
        // Add custom metadata and tags for LangSmith
        metadata: generateTraceMetadata({
          userId,
          threadId: context.threadId,
          agentType: 'tool_agent',
          userMessage,
          messageLength: userMessage.length,
          mode: requestedAgentType || 'standard',
        }),
        tags: generateTraceTags({
          agentType: 'tool_agent',
          userId,
          threadId: context.threadId,
          mode: requestedAgentType || 'standard',
          environment: process.env.NODE_ENV,
        }),
      }
    );
    } catch (invokeError) {
      console.error("\n❌ [processWithToolAgent] INVOKE ERROR:");
      console.error("Error type:", invokeError instanceof Error ? invokeError.name : typeof invokeError);
      console.error("Error message:", invokeError instanceof Error ? invokeError.message : String(invokeError));
      console.error("Error stack:", invokeError instanceof Error ? invokeError.stack : 'No stack trace');
      throw invokeError;
    }
    
    console.log("\n=== [processWithToolAgent] Agent result ===");
    console.log("Output:", result.output);
    console.log("Intermediate steps count:", result.intermediateSteps?.length || 0);
    if (result.intermediateSteps?.length > 0) {
      console.log("Tool calls executed:");
      result.intermediateSteps.forEach((step: any, i: number) => {
        console.log(`  ${i + 1}. ${step.action?.tool}:`, {
          input: step.action?.toolInput,
          output: typeof step.observation === 'string' ? step.observation.substring(0, 100) : step.observation
        });
      });
    } else {
      console.log("⚠️  NO TOOLS WERE EXECUTED - Agent returned text only");
    }
    console.log("=== End agent result ===\n");
    
    // Extract tool outputs for structured data
    const toolOutputs = result.intermediateSteps?.map((step: any) => ({
      tool: step.action.tool,
      input: step.action.toolInput,
      output: step.observation
    })) || [];
    
    // Find structured data from tool outputs
    // Tools that return cards should have a 'type' property (e.g., 'habit_review', 'goal_suggestion')
    let structuredData = null as any;
    for (const toolOutput of toolOutputs) {
      try {
        // Tool outputs come as JSON strings, parse them
        let output;
        if (typeof toolOutput.output === 'string') {
          try {
            output = JSON.parse(toolOutput.output);
          } catch (e) {
            console.error("[processWithToolAgent] Failed to parse tool output:", e);
            console.error("[processWithToolAgent] Raw output:", toolOutput.output.substring(0, 200));
            output = toolOutput.output; // Use string as-is
          }
        } else {
          output = toolOutput.output;
        }
        
        if (output && typeof output === 'object' && (output as any).type) {
          // This is a card-generating tool output
          structuredData = output;
          console.log("[processWithToolAgent] ✅ Found structured data with type:", (output as any).type);
        }
      } catch (e) {
        console.error("[processWithToolAgent] Error inspecting tool output:", e);
      }
    }

    // Fallback: if prioritization was called but structuredData missing, try parse its observation now
    if (!structuredData) {
      const lastPrioritize = [...toolOutputs].reverse().find(t => t.tool === 'prioritize_goals');
      if (lastPrioritize && typeof lastPrioritize.output === 'string') {
        try {
          const parsed = JSON.parse(lastPrioritize.output);
          if (parsed && parsed.type === 'prioritization') {
            structuredData = parsed;
            console.log('[processWithToolAgent] 🔁 Recovered prioritization structuredData from fallback parse');
          }
        } catch (e) {
          console.warn('[processWithToolAgent] Could not fallback-parse prioritize_goals output');
        }
      }
    }
    
    // If the agent returns empty output, provide a helpful fallback
    let finalText = result.output;

    // Align assistant text to prioritization card exactly (prevents hallucination)
    if (structuredData && structuredData.type === 'prioritization' && Array.isArray(structuredData.items)) {
      const titles: string[] = structuredData.items.map((it: any) => it.title).filter(Boolean);
      const numbered = titles.map((t, i) => `${i + 1}. ${t}`).join('\n');
      finalText = `Based on your context, here are your top priorities:\n\n${numbered}\n\nDo these feel right, or should we adjust anything?`;
      console.log('[processWithToolAgent] ✍️ Overwrote final text from structured prioritization titles');
    }

    if (!finalText || finalText.trim() === "") {
      console.warn("[processWithToolAgent] Agent returned empty output, using fallback");
      finalText = "I'm here to support you in achieving your goals. What would you like to focus on today?";
    }
    
    return {
      finalText,
      structuredData,
      toolCalls: toolOutputs,
    };
    
  } catch (error) {
    console.error("[processWithToolAgent] Error:", error);
    console.error("[processWithToolAgent] Error stack:", (error as Error).stack);
    return {
      finalText: "I'm here to help you with your goals. What's on your mind today?",
      structuredData: null,
    };
  }
}

/**
 * Stream version for SSE responses
 * (We can implement this later - for now, use invoke and stream the final result)
 */
export async function streamWithToolAgent(context: AgentContext, onToken: (delta: string) => void): Promise<{
  finalText: string;
  structuredData?: any;
}> {
  // For now, invoke and stream the result
  // TODO: Implement proper streaming with streamEvents
  const result = await processWithToolAgent(context);
  
  // Stream the final text token by token
  const text = result.finalText;
  for (let i = 0; i < text.length; i++) {
    onToken(text[i]);
    // Small delay to simulate streaming
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  return {
    finalText: result.finalText,
    structuredData: result.structuredData,
  };
}

