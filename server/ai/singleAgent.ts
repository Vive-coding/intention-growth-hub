/**
 * Single Tool-Calling Life Coach Agent
 * 
 * Replaces the multi-agent architecture with one intelligent agent
 * that has access to 11 specialized tools for goal/habit management.
 */

import { createModel, type ModelName } from "./modelFactory";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { createToolsForUser } from "./tools/index";
import type { AgentContext } from "./agents/types";
import { RunnableSequence } from "@langchain/core/runnables";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MyFocusService } from "../services/myFocusService";
import { ChatContextService } from "../services/chatContextService";
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

const BASE_SYSTEM_PROMPT = `You're a warm, present life coach helping users build meaningful habits and achieve goals through consistent action and self-awareness.

## Identity
You help users think through challenges, set clear goals, build sustainable habits, and stay accountable. You're a coach, not an assistant—you don't access external apps, set reminders, draft emails, or perform tasks outside this conversation. For reminders: "You can enable email check-ins in Preferences."

## Voice & Tone
Conversational, encouraging, never judgmental. Ask max 1 question per turn. Keep responses 2-4 sentences unless deeper reflection is invited. Celebrate wins naturally with emojis (🎉💪✨). Adapt tone to user preferences when provided.

## Listening Modes

**REFLECTION MODE** (user is processing, not ready for action):
- Signals: "just thinking", "feeling emotions", "having a day", "not sure", venting, questions about themselves
- Your role: Validate → Ask ONE open question → Wait
- Avoid: Action plans, checklists, "want me to..." offers, solutions
- Stay here until user explicitly signals readiness ("what should I do", "help me plan")

**ACTION MODE** (user wants concrete next steps):
- Signals: "what should I do", "help me plan", "I want to start", direct requests for guidance
- Your role: Give 1 confident suggestion with specifics (what, when, how long)

**When unsure**: Default to reflection mode. You can always offer action later, but you can't un-rush someone.

**If user redirects** ("just talk first", "not ready for action"): Honor that for at least 2-3 exchanges. Never add action hooks to reflective responses—it undermines presence.

## Core Principles
1. Validate emotions before problem-solving
2. Specific outcomes > vague intentions ("Save $500/month" not "be better with money")
3. Effective habits = specific action + frequency + realistic scope + trigger ("20-min workout after work, 3x/week")
4. Habits must directly support goal outcomes
5. When user is stuck and ready for action: 1 confident suggestion, not 5 options
6. Look for patterns: what keeps showing up, contradictions, what's working they don't see
7. Most conversations are just conversations—not everything needs tracking or tools

## Tool Usage

**Context Tools:**
- \`get_context("all_goals")\`: Check BEFORE creating goals to avoid duplicates
- \`get_context("life_metrics")\`: Get exact metric names (use with emojis)
- \`get_context("habits")\`: Fallback for matching completions
- \`get_context("insights")\`: Surface when relevant patterns emerge

**Goal & Habit Creation:**
- Check all_goals first—avoid duplicates by title + term (≤30d=short, 31-90=mid, >90=long)
- \`create_goal_with_habits\`: Suggest goal + max 3 habits per response
  - Gather: specific outcome, timeline, why it matters
  - Say "Here's a goal suggestion 👇" (NOT "I created"—user must accept)
  - After acceptance, continue conversation—don't immediately suggest more habits
- Use EXACT life_metrics with emojis

**Progress Tracking:**
- \`log_habit_completion\`: For today's specific actions ("worked out", "journaled")
  - Match to my_focus habits first, propose matches before logging
  - Celebrate + highlight streaks
  - NEVER call update_goal_progress after—it auto-updates
- \`update_goal_progress\`: For percentage reports ("I'm 40% done") or retroactive updates ("kept habit 3 of last 5 days")
  - NEVER for today's specific actions
  - NEVER after log_habit_completion
- \`complete_goal\`: Mark achieved—celebrate + ask how it feels

**Modification:**
- \`adjust_goal\` / \`update_habit\`: Frame as adaptation, not failure
- \`prioritize_goals\`: Pick top 3 focus
  - ALWAYS call get_context("all_goals") first
  - Listen for user's stated preferences—use their exact goals
  - Include EXACT 3 titles in reasoning parameter

**Review:**
- \`review_daily_habits\`: Show checklist—keep response brief
- \`show_progress_summary\`: Tell the story—wins first, slips in context, 1 adjustment

**Insights:**
- \`create_insight\`: Capture meaningful patterns proactively
  - Good: "Morning momentum predicts whole-day success", "Starts strong but abandons at 60%"
  - Bad: Generic observations ("user wants to be healthier")
  - Use when you notice: recurring blockers, behavior patterns, say/do contradictions, hidden strengths

## Critical Rules
- Honor reflection mode—don't rush to action when user is processing
- Check all_goals before creating new goals  
- Use EXACT life_metrics with emojis
- log_habit_completion for actions, update_goal_progress for percentages/retroactive ONLY
- NEVER use both tools on same update
- NEVER promise reminders/notifications
- NEVER draft external content`;

// Mode-specific instructions
const MODE_PLAN_AHEAD = `## Mode: Plan Ahead
User wants help planning (today/week/month/year).

End of year: Lean into reflection and fresh starts. "What do you want to carry forward or finally commit to?"

Flow:
1. Ask about capacity and what matters: "What worked this year? What do you want different?"
2. Call get_context("my_focus") for current state
3. Distill into 1-3 meaningful goals (not 10 resolutions that fade by February)
4. Check all_goals for duplicates, gather outcome/timeline/why, call create_goal_with_habits
5. Design habits small enough to survive January motivation dips

Frame as identity: "You're becoming someone who..." not just tasks.

If 4+ active goals: call prioritize_goals. Fewer focused goals beat a long wishlist.`;

const MODE_REVIEW_PROGRESS = `## Mode: Review Progress
User wants to check in on how they're doing.

Flow:
1. Call get_context("my_focus") first
2. When they share updates, match to existing habits by title/description
3. Propose matches before logging: "Sounds like you completed: Morning run, Job apps?"
4. For confirmed matches: call log_habit_completion with description
5. Call show_progress_summary for patterns
6. Tell the story: celebrate wins first, reflect on slips in context, suggest 1 adjustment

For setbacks: Normalize ("Life shifted"), ask what adjustment would help (push deadline, lower intensity, pause), then call adjust_goal or update_habit.

CRITICAL: Use log_habit_completion for actions. NEVER also call update_goal_progress—it auto-updates.`;

const MODE_OPTIMIZE_FOCUS = `## Mode: Optimize Focus
User feels overwhelmed or wants to reprioritize.

Flow:
1. Validate: "That sounds heavy. You're not failing—you're carrying a lot."
2. Call get_context("all_goals") to see all available goals
3. Listen for which goals they mention—use those preferences
4. Call prioritize_goals with EXACT goal titles in reasoning
5. Summarize why these 3 matter (urgency, meaning, momentum)
6. Ask: "Does this feel doable, or should we pause something?"

If they disagree with priorities: Ask what's wrong, listen, then call prioritize_goals again with adjusted selection.`;

const MODE_SURPRISE_ME = `## Mode: Surprise Me
User wants open-ended coaching without a specific agenda.

Approach:
- Be curious and present
- Ask what's on their mind or how they're feeling today
- Follow their energy—don't push toward tracking
- If something meaningful emerges, explore it conversationally before suggesting goals
- Sometimes the best coaching is just listening`;

const LIFE_COACH_PROMPT = BASE_SYSTEM_PROMPT; // Keep for backward compatibility during transition


/**
 * Create the tool-calling agent with specific tools
 */
export async function createLifeCoachAgentWithTools(
  tools: any[], 
  mode?: string, 
  modeInstructions?: string,
  modelName: ModelName = "gpt-5-mini"
): Promise<AgentExecutor> {
  console.log("[createLifeCoachAgent] Creating agent with tools:", tools.map(t => t.name), "model:", modelName);
  
  const model = createModel(modelName);

  // Build complete system prompt with mode and context
  let systemPrompt = LIFE_COACH_PROMPT;
  
  // Add current date context for accurate date references
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
  systemPrompt += `\n\n**CURRENT DATE:** ${formattedDate}\n\nWhen creating goals or setting target dates, always use dates that are ${formattedDate} or later. Never use past dates.`;
  
  // Add mode instructions if provided
  if (modeInstructions) {
    systemPrompt += `\n\n${modeInstructions}`;
  }

  // Use LangChain's tool-calling agent (works with both OpenAI + Anthropic chat models)
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agent = createToolCallingAgent({
    llm: model as any,
    tools,
    prompt,
  });

  console.log("[createLifeCoachAgent] Tool-calling agent created successfully");

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
export async function processWithToolAgent(
  context: AgentContext, 
  requestedAgentType?: string,
  modelName: ModelName = "gpt-5-mini"
): Promise<{
  finalText: string;
  structuredData?: any;
  cta?: string;
  toolCalls?: Array<{ tool: string; input: any; output: any }>;
}> {
  const { userMessage, profile, workingSet, threadSummary, recentMessages, userId, onboardingProfile } = context;
  
  // Derive a simple time-of-day bucket from the user's timezone (if available)
  const timezone =
    profile?.timezone ||
    profile?.onboarding?.timezone ||
    process.env.DEFAULT_TZ ||
    "UTC";
  let timeOfDayForCoach: "morning" | "afternoon" | "evening" | "anytime" = "anytime";
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour")?.value;
    if (hourPart) {
      const hour = parseInt(hourPart, 10);
      if (!Number.isNaN(hour)) {
        if (hour >= 8 && hour < 12) {
          timeOfDayForCoach = "morning";
        } else if (hour >= 14 && hour < 18) {
          timeOfDayForCoach = "afternoon";
        } else if (hour >= 18 && hour < 22) {
          timeOfDayForCoach = "evening";
        }
      }
    }
  } catch {
    // Fall back to UTC-based hour if timezone parsing fails
    const now = new Date();
    const hour = now.getUTCHours();
    if (hour >= 8 && hour < 12) {
      timeOfDayForCoach = "morning";
    } else if (hour >= 14 && hour < 18) {
      timeOfDayForCoach = "afternoon";
    } else if (hour >= 18 && hour < 22) {
      timeOfDayForCoach = "evening";
    }
  }
  
  // Determine mode and context-specific instructions
  let mode = "Standard Coaching";
  let modeInstructions = "";
  let contextInstructions = ""; // For onboarding_welcome mode only
  
  if (requestedAgentType === 'suggest_goals') {
    mode = "Plan Ahead";
    modeInstructions = MODE_PLAN_AHEAD;
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
    modeInstructions = MODE_REVIEW_PROGRESS;
  } else if (requestedAgentType === 'prioritize_optimize') {
    mode = "Optimize Focus";
    modeInstructions = MODE_OPTIMIZE_FOCUS;
  } else if (requestedAgentType === 'surprise_me') {
    mode = "Surprise Me";
    modeInstructions = MODE_SURPRISE_ME;
  }
  
  try {
    console.log("\n=== [processWithToolAgent] Starting agent processing ===");
    console.log("[processWithToolAgent] User:", userId);
    console.log("[processWithToolAgent] Thread:", context.threadId);
    console.log("[processWithToolAgent] Message:", userMessage);
    
    // Load My Focus context (only priority goals + their habits)
    // Load My Focus context and onboarding profile in parallel
    let myFocusContext = "";
    let onboardingProfile = null;
    console.log("[processWithToolAgent] Loading My Focus context and onboarding profile");
    try {
      const [myFocusData, onboardingProfileData] = await Promise.all([
        ChatContextService.getMyFocusContext(userId),
        ChatContextService.getOnboardingProfile(userId)
      ]);
      onboardingProfile = onboardingProfileData;
      
      myFocusContext = `\n\n## My Focus\n${myFocusData.priorityGoals.length > 0 ? 
        myFocusData.priorityGoals.map((g: { title: string; currentValue: number; targetValue: number; targetDate: string | null }) => 
          `  • ${g.title} (${Math.round((g.currentValue / g.targetValue) * 100)}%, target: ${g.targetDate ? new Date(g.targetDate).toLocaleDateString() : 'not set'})`
        ).join('\n') : 
        '  No priority goals set'
      }\n**Active Habits**:\n${myFocusData.focusHabits.length > 0 ?
        myFocusData.focusHabits.map((h: { name: string; frequency: string; streak: number; goalTitle: string }) => 
          `  • ${h.name} - ${h.frequency} (${h.streak} day streak) for ${h.goalTitle}`
        ).join('\n') :
        '  No habits set'
      }`;
      console.log("[processWithToolAgent] ✅ My Focus context loaded");
    } catch (e) {
      console.error("[processWithToolAgent] Failed to load My Focus context:", e);
      // Try to load onboarding profile separately if My Focus fails
      try {
        onboardingProfile = await ChatContextService.getOnboardingProfile(userId);
      } catch (e2) {
        console.error("[processWithToolAgent] Failed to load onboarding profile:", e2);
      }
    }
    
    // Build condensed personality context (replaces full onboarding instructions)
    let personalityContext = "";
    if (onboardingProfile || profile?.onboarding) {
      const source = {
        onboardingStep:
          onboardingProfile?.onboardingStep ??
          profile?.onboarding?.onboardingStep ??
          (onboardingProfile?.completedAt ? "completed" : undefined) ??
          "welcome",
        goalSettingAbility: onboardingProfile?.goalSettingAbility ?? profile?.onboarding?.goalSettingAbility ?? null,
        habitBuildingAbility: onboardingProfile?.habitBuildingAbility ?? profile?.onboarding?.habitBuildingAbility ?? null,
        coachPersonality: onboardingProfile?.coachPersonality ?? profile?.onboarding?.coachPersonality ?? null,
      };

      const stage = String(source.onboardingStep || "welcome").toLowerCase();
      const coachPersonalityList = Array.isArray(source.coachPersonality)
        ? source.coachPersonality
        : typeof source.coachPersonality === 'string'
          ? source.coachPersonality.split(',').map((value) => value.trim()).filter(Boolean)
          : [];
      const coachPersonalitySummary = coachPersonalityList.length > 0
        ? coachPersonalityList.map((value) => COACH_PERSONALITY_LABELS[value] ?? value.replace(/_/g, ' ')).join(", ")
        : "warm and encouraging";
      
      const goalSettingLabel = source.goalSettingAbility ? (GOAL_SETTING_LABELS[source.goalSettingAbility] ?? source.goalSettingAbility.replace(/_/g, ' ')) : null;
      const habitLabel = source.habitBuildingAbility ? (HABIT_CONFIDENCE_LABELS[source.habitBuildingAbility] ?? source.habitBuildingAbility.replace(/_/g, ' ')) : null;
      const onboardingComplete = stage === "completed" || onboardingProfile?.completedAt;
      
      // Build condensed personality context
      const parts: string[] = [];
      if (profile?.firstName) {
        parts.push(`## About ${profile.firstName}`);
        if (profile.timezone) {
          parts[parts.length - 1] += ` (${profile.timezone})`;
        }
      }
      parts.push(`Preferred coaching style: ${coachPersonalitySummary}`);
      if (goalSettingLabel && habitLabel) {
        parts.push(`Goal style: ${goalSettingLabel} | Habit confidence: ${habitLabel}`);
      }
      if (!onboardingComplete) {
        parts.push(`Onboarding stage: ${stage}`);
      }
      
      personalityContext = parts.length > 0 ? `\n${parts.join('\n')}\n` : '';
    } else if (profile?.firstName) {
      // Minimal context if no onboarding profile but we have name
      personalityContext = `\n## About ${profile.firstName}${profile.timezone ? ` (${profile.timezone})` : ''}\nPreferred coaching style: warm and encouraging\n`;
    }
    
    // Add thread summary context (if available)
    const threadSummaryContext = context.threadSummary 
      ? `\n## This Conversation\n${context.threadSummary}\n`
      : '';
    
    // Fetch recent insights
    let insightsContext = "";
    try {
      const recentInsights = await ChatContextService.getRecentInsights(userId, 5);
      if (recentInsights.length > 0) {
        insightsContext = `\n\n## Recent Patterns About This User\n${recentInsights.map(i => `- ${i.title}: ${i.explanation}`).join('\n')}\n\nUse these insights to personalize your coaching—they capture non-obvious patterns about how this user operates.`;
      }
    } catch (e) {
      console.error("[processWithToolAgent] Failed to load insights:", e);
    }

    // Create tools with userId and threadId baked in
    const toolsForUser = createToolsForUser(userId, context.threadId);
    console.log("[processWithToolAgent] Created tools for user:", userId);
    
    // Combine context in order: mode instructions → personality → thread summary → my focus → insights
    const combinedInstructions = 
      (modeInstructions || contextInstructions || '') + 
      personalityContext + 
      threadSummaryContext + 
      myFocusContext + 
      insightsContext;
    
    // Create agent with user-specific tools, including pre-loaded context if available
    const agentExecutor = await createLifeCoachAgentWithTools(
      toolsForUser, 
      mode, 
      combinedInstructions,
      modelName
    );
    
    // Build chat history from recent messages (convert to LangChain message format)
    const chatHistory: any[] = [];
    for (const msg of recentMessages) {
      try {
        // Skip messages with null/undefined content or invalid role
        if (!msg || !msg.role) {
          console.warn("[processWithToolAgent] Skipping message with missing role:", msg);
          continue;
        }
        
        // Ensure content is a non-null string
        const content = typeof msg.content === 'string' ? msg.content : String(msg.content || '');
        
        if (!content) {
          console.warn("[processWithToolAgent] Skipping message with empty content:", { role: msg.role, id: (msg as any).id });
          continue;
        }
        
        if (msg.role === 'user' || msg.role === 'human') {
          chatHistory.push(new HumanMessage(content));
        } else if (msg.role === 'assistant' || msg.role === 'ai') {
          chatHistory.push(new AIMessage(content));
        }
      } catch (e) {
        console.error("[processWithToolAgent] Error converting message to LangChain format:", e, "Message:", msg);
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
    // Prepare messages for tracing/evaluators (LangSmith expects top-level `messages`)
    const messagesForTrace = Array.isArray(chatHistory) ? [...chatHistory] : [];
    const lastMsg = messagesForTrace[messagesForTrace.length - 1];
    const lastRole =
      (lastMsg as any)?.role ??
      (lastMsg as any)?._getType?.() ??
      (lastMsg as any)?.kwargs?.role;
    const lastContent =
      (lastMsg as any)?.content ??
      (lastMsg as any)?.kwargs?.content ??
      "";

    // Avoid double-adding the current user message if it's already in chat_history
    if (
      !(
        (lastRole === "human" || lastRole === "user") &&
        String(lastContent).trim() === String(userMessage).trim()
      )
    ) {
      messagesForTrace.push({ role: "user", content: userMessage });
    }

    let result;
    try {
      result = await agentExecutor.invoke(
      {
        input: userMessage,
        chat_history: chatHistory,
        messages: messagesForTrace,
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
    const goalSuggestions: any[] = []; // Collect all goal_suggestion outputs
    
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
          const outputType = (output as any).type;
          
          // Special handling: collect multiple goal_suggestion outputs
          if (outputType === 'goal_suggestion') {
            goalSuggestions.push({
              goal: output.goal,
              habits: output.habits || []
            });
            console.log("[processWithToolAgent] ✅ Collected goal suggestion:", output.goal?.title);
          } else {
            // For other card types, use the last one (existing behavior)
            structuredData = output;
            console.log("[processWithToolAgent] ✅ Found structured data with type:", outputType);
          }
        }
      } catch (e) {
        console.error("[processWithToolAgent] Error inspecting tool output:", e);
      }
    }
    
    // If we collected multiple goal suggestions, combine them into goal_suggestions format
    if (goalSuggestions.length > 0) {
      if (goalSuggestions.length === 1) {
        // Single goal: use goal_suggestion format
        structuredData = {
          type: 'goal_suggestion',
          goal: goalSuggestions[0].goal,
          habits: goalSuggestions[0].habits
        };
        console.log("[processWithToolAgent] ✅ Single goal suggestion formatted");
      } else {
        // Multiple goals: use goal_suggestions format (plural)
        structuredData = {
          type: 'goal_suggestions',
          items: goalSuggestions
        };
        console.log(`[processWithToolAgent] ✅ Combined ${goalSuggestions.length} goal suggestions into goal_suggestions array`);
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
    const normalizeOutputToText = (output: any): string => {
      if (typeof output === "string") return output;
      if (Array.isArray(output)) {
        // Anthropic (and some other chat models) can return content blocks:
        // [{ type: "text", text: "..." }, ...]
        const parts: string[] = [];
        for (const part of output) {
          if (!part) continue;
          if (typeof part === "string") {
            parts.push(part);
            continue;
          }
          if (typeof part?.text === "string") {
            parts.push(part.text);
            continue;
          }
          if (typeof part?.content === "string") {
            parts.push(part.content);
            continue;
          }
          // Last resort: stringify unknown block
          try {
            parts.push(JSON.stringify(part));
          } catch {}
        }
        return parts.join("");
      }
      // Some LangChain message objects carry content on .content
      if (output && typeof output === "object") {
        const content = (output as any).content;
        if (typeof content === "string") return content;
        if (Array.isArray(content)) return normalizeOutputToText(content);
      }
      return "";
    };

    let finalText = normalizeOutputToText((result as any).output);

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

