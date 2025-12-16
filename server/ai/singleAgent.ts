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
import { HumanMessage, AIMessage, SystemMessage, FunctionMessage } from "@langchain/core/messages";
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

const BASE_SYSTEM_PROMPT = `You're a warm, present life coach helping users achieve meaningful progress through clear goals and consistent habits.

## Voice
Conversational, encouraging, never judgmental. Be present first—not every interaction needs tracking or action items. Ask max 1 question per turn. Keep responses 2-4 sentences unless deeper reflection is invited. Celebrate wins with emojis (🎉💪✨). Respect stop signals ("gotta run", "that's all") without pushing.

Adapt tone to user preferences when provided.

## Capabilities
CAN: Manage goals/habits, log progress, surface insights, provide accountability and emotional support
CANNOT: Access external apps, set reminders/notifications, draft emails/documents, perform external tasks

You're a coach, not a assistant. Help users think through challenges—don't do work for them.

For reminders: "You can enable email check-ins in Preferences."

## Memory & Context
You have conversation history + user preferences + current focus + recent insights. Use proactively but don't restate everything each turn.

## Tools (use silently)

**get_context(type)**: Fetch current state
- "my_focus": active goals, habits, streaks
- "all_goals": full list with terms (check before creating goals)
- "habits": all habits (fallback for matching completions)
- "life_metrics": exact metric names—use EXACTLY with emojis

**create_goal_with_habits**: Suggest goal + habits (max 3 per response)
- Check all_goals first—avoid duplicates by title + term (≤30d=short, 31-90=mid, >90=long)
- Gather: specific outcome, timeline, why it matters
- Design 1-3 habits that directly ladder to goal (specific action, frequency, trigger)
- Use EXACT life_metrics
- Say "Here's a goal suggestion 👇" (NOT "I created"—user must accept)
- After acceptance, continue exploring—don't immediately suggest more habits

**create_insight**: Capture a meaningful pattern about the user
- Use when you notice: recurring blockers, behavior patterns, motivation drivers, say/do contradictions, hidden strengths
- NOT for generic observations ("user wants to be healthier")
- Good insights are specific, non-obvious, actionable: "Morning momentum predicts whole-day success", "Starts strong but abandons at 60%", "Thrives with accountability but resists asking for help"
- Call proactively when patterns emerge in any conversation

**log_habit_completion**: Log today's habit action
- Use for specific actions: "worked out", "journaled", "applied to jobs"
- Match to my_focus habits first, propose matches before logging
- Celebrate + highlight streaks
- NEVER call update_goal_progress after—it auto-updates

**update_goal_progress**: Update goal % manually
- Use for percentage reports: "I'm 40% done", "finished half"
- Use for retroactive progress: "I kept the habit 3 of the last 5 days" (log_habit_completion only works for today)
- NEVER for today's specific actions (use log_habit_completion)
- NEVER after log_habit_completion

**adjust_goal / update_habit**: Modify timeline, pause, change frequency
- Frame as adaptation, not failure: "Life shifted—that's not failure"

**complete_goal**: Mark achieved — celebrate + ask how it feels

**review_daily_habits**: Show today's checklist — keep response brief, card shows details

**show_progress_summary**: Progress dashboard — tell the story: wins first, slips in context, 1 adjustment. Don't copy metrics.

**prioritize_goals**: Pick top 3 focus
- ALWAYS call get_context("all_goals") first
- Listen for user's stated preferences—use their exact goals
- Include EXACT 3 titles in reasoning parameter
- Base on: user preference > urgency > momentum > balance

## Core Principles
1. Specific outcomes, not vague intentions ("Save $500/month" not "be better with money")
2. Habits need: specific action, frequency, realistic scope, trigger ("20-min workout after work, 3x/week")
3. Habits must directly support the goal outcome
4. Validate emotions before problem-solving
5. 1 confident suggestion when stuck (not 5 options)
6. Small first step = exactly what, when, how long
7. Look for patterns: what keeps showing up, what contradicts, what's working that they don't see
8. Not everything needs tracking—most conversations are just conversations

## Critical Rules
- Check all_goals before creating new goals
- Use EXACT life_metrics with emojis
- Max 3 goal suggestions per response
- log_habit_completion for actions, update_goal_progress for percentages/retroactive only
- NEVER both tools on same update
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
export async function createLifeCoachAgentWithTools(tools: any[], mode?: string, modeInstructions?: string): Promise<AgentExecutor> {
  console.log("[createLifeCoachAgent] Creating agent with tools:", tools.map(t => t.name));
  
  const model = new ChatOpenAI({
    model: "gpt-5-mini",
    // LangChain doesn't support these parameters yet, so using defaults
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
  
  // Add mode instructions if provided
  if (modeInstructions) {
    systemPrompt += `\n\n${modeInstructions}`;
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
            // If already a LangChain message, use it directly
            if (msg instanceof HumanMessage || msg instanceof AIMessage || msg instanceof SystemMessage) {
              // Validate that the message has content
              if (msg.content && (typeof msg.content === 'string' || Array.isArray(msg.content))) {
                messages.push(msg);
              } else {
                console.warn("[chat_history] Skipping LangChain message with invalid content:", msg.constructor.name);
              }
              continue;
            }
            // Convert plain objects to LangChain messages
            if (msg && typeof msg === "object") {
              const role = (msg as any).role;
              const rawContent = (msg as any).content;
              
              // Ensure content is valid
              if (rawContent === null || rawContent === undefined) {
                console.warn("[chat_history] Skipping message with null/undefined content:", { role });
                continue;
              }
              
              const content = String(rawContent);
              if (!content) {
                console.warn("[chat_history] Skipping message with empty content:", { role });
                continue;
              }
              
              if (role === "human" || role === "user") {
                messages.push(new HumanMessage(content));
              } else if (role === "ai" || role === "assistant") {
                messages.push(new AIMessage(content));
              }
            }
          } catch (e) {
            console.error("[chat_history] Skip invalid message:", e, "Message:", msg);
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
          // Validate each message in scratchpad before adding
          for (const msg of scratchpad) {
            // GPT-5-mini doesn't support 'function' role - filter out FunctionMessage objects
            // Convert function results to AIMessage format instead
            const msgType = msg instanceof FunctionMessage 
              ? 'function' 
              : (msg as any)?.getType?.() || (msg as any)?._getType?.() || (msg as any)?.role;
            
            if (msg instanceof FunctionMessage || msgType === 'function' || (msg as any)?.role === 'function') {
              // Convert function message to AIMessage with function result in content
              const functionResult = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
              const functionName = (msg as any).name || 'function';
              messages.push(new AIMessage(`[Function ${functionName} result]: ${functionResult}`));
              continue;
            }
            
            // Ensure the message has valid content (string or array, not undefined/null)
            if (msg && (msg.content !== undefined && msg.content !== null)) {
              // If content is empty string, that's fine - but ensure it's a string
              if (typeof msg.content !== 'string' && !Array.isArray(msg.content)) {
                console.warn("[agent_scratchpad] Skipping message with invalid content type:", typeof msg.content, msg);
                continue;
              }
              messages.push(msg);
            } else {
              console.warn("[agent_scratchpad] Skipping message with undefined/null content:", msg?.constructor?.name);
            }
          }
        }
      } catch (e) {
        console.error("[agent_scratchpad] Error formatting steps:", e);
        console.error("[agent_scratchpad] Steps causing error:", JSON.stringify(i.steps, null, 2).substring(0, 500));
      }
      
      // Final filter: Convert any messages with 'function' role to AIMessage (GPT-5-mini compatibility)
      // This is a safety net in case any FunctionMessage objects slipped through earlier filters
      const filteredMessages = messages.map((msg) => {
        // Check multiple ways the role might be stored
        const msgRole = (msg as any)?._getType?.() 
          || (msg as any)?.getType?.() 
          || (msg as any)?.role
          || (msg instanceof FunctionMessage ? 'function' : null);
        
        if (msgRole === 'function' || msg instanceof FunctionMessage) {
          console.warn("[agent/messages] Converting FunctionMessage to AIMessage:", {
            type: msg?.constructor?.name,
            role: msgRole,
            content: String((msg as any)?.content ?? '').substring(0, 100)
          });
          // Convert to AIMessage instead of filtering out
          const functionResult = typeof (msg as any).content === 'string' 
            ? (msg as any).content 
            : JSON.stringify((msg as any).content || {});
          const functionName = (msg as any).name || 'function';
          return new AIMessage(`[Function ${functionName} result]: ${functionResult}`);
        }
        return msg;
      });
      
      // DEBUG: Log messages being sent to the model
      try {
        console.log("[agent/messages] count:", filteredMessages.length, "(filtered from", messages.length, ")");
        filteredMessages.forEach((m, idx) => {
          const type = (m && (m as any).constructor && (m as any).constructor.name) || typeof m;
          const content = String((m as any)?.content ?? "");
          const role = (m as any)?._getType?.() || (m as any)?.getType?.() || (m as any)?.role || 'unknown';
          console.log(`  [${idx}] type=${type} role=${role} content="${content.slice(0, 160)}"`);
          
          // Validate content is not undefined/null
          if ((m as any)?.content === undefined || (m as any)?.content === null) {
            console.error(`  ⚠️  [${idx}] INVALID: content is ${(m as any)?.content === undefined ? 'undefined' : 'null'}`);
          }
          
          // Warn if we still see function role
          if (role === 'function') {
            console.error(`  ❌ [${idx}] ERROR: Function role still present after filtering!`);
          }
        });
      } catch (e) {
        console.error("[agent/messages] Logging error:", e);
      }
      
      return filteredMessages;
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
    let myFocusContext = "";
    console.log("[processWithToolAgent] Loading My Focus context");
    try {
      const myFocusData = await ChatContextService.getMyFocusContext(userId);
      const onboardingProfile = await ChatContextService.getOnboardingProfile(userId);
      
      // Format onboarding summary
      const formatOnboardingSummary = (profile: any): string => {
        const parts = [];
        if (profile?.goalSettingAbility) parts.push(`Goal style: ${profile.goalSettingAbility}`);
        if (profile?.habitBuildingAbility) parts.push(`Habit confidence: ${profile.habitBuildingAbility}`);
        if (profile?.coachPersonality) {
          const personality = Array.isArray(profile.coachPersonality) 
            ? profile.coachPersonality.join(', ')
            : profile.coachPersonality;
          parts.push(`Coach style: ${personality}`);
        }
        if (profile?.focusLifeMetrics?.length) {
          const metrics = Array.isArray(profile.focusLifeMetrics)
            ? profile.focusLifeMetrics.join(', ')
            : profile.focusLifeMetrics;
          parts.push(`Focus areas: ${metrics}`);
        }
        return parts.join(' | ') || 'Not set';
      };
      
      myFocusContext = `\n\n**CONTEXT:**\n**User**: ${profile?.firstName || 'User'}\n**Preferences**: ${onboardingProfile ? formatOnboardingSummary(onboardingProfile) : 'Not set'}\n**My Focus**:\n${myFocusData.priorityGoals.length > 0 ? 
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
    
    // Combine mode instructions with other context
    const combinedInstructions = (modeInstructions || contextInstructions || '') + myFocusContext + onboardingInstructions;
    
    // Create agent with user-specific tools, including pre-loaded context if available
    const agentExecutor = await createLifeCoachAgentWithTools(
      toolsForUser, 
      mode, 
      combinedInstructions
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

