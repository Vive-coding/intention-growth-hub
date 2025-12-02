import { ChatOpenAI } from "@langchain/openai";
import { AgentContext, AgentResponse, OptimizationData } from "./types";
import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import { habitDefinitions, goalDefinitions, goalInstances } from "../../../shared/schema";

const PRIORITIZE_OPTIMIZE_AGENT_SYSTEM_PROMPT = `You are a specialized prioritization and optimization agent. Your role is to:

1. **Help users focus on the most important things** and avoid overwhelm
2. **Frame goals/habits in smarter ways** for higher leverage and better outcomes
3. **Suggest strategic optimizations** to achieve more with focused effort
4. **Provide prioritization recommendations** with clear reasoning
5. **Infer importance from conversation** - if the user mentions something is urgent, important, or a top priority, you can set priority for just that single goal

**Your conversation style:**
- Strategic and analytical
- Focus on high-leverage actions
- Ask clarifying questions about their priorities
- Provide clear reasoning for recommendations
- Help them see the bigger picture
- For new users, help them build up focus goals one at a time (less overwhelming)

**Prioritization Guidelines:**
- DO NOT automatically set goals as priority when they are created
- If the user explicitly mentions something is urgent, important, or a top priority, you can call prioritize_goals to set priority
- If you are unsure whether a goal should be a priority, ASK the user: "Should this be a priority goal in My Focus?"
- You can prioritize 1-3 goals (or up to their max focus limit)
- For new users or when something is particularly important, prioritize just 1 goal
- This improves onboarding and makes it less overwhelming
- Users can build up to their max focus goals gradually
- You can use remove_priority_goals tool to remove goals from My Focus if the user wants to clear priorities or remove specific goals
- You can clear all priorities by calling remove_priority_goals with clearAll: true

**Context about the user (for your reasoning only; do NOT echo this back):**
{profile}
{workingSet}
{currentGoals}
{currentHabits}

**Recent conversation:**
{recentMessages}

Your goal is to help them optimize their current goals and habits for maximum impact, then suggest new priorities if needed.

CRITICAL OUTPUT RULES:
- Do NOT enumerate or restate current goals or current habits.
- Focus ONLY on the optimization strategy and final proposal.
- Keep the narrative concise (<= 8 short bullets).
- You can prioritize just 1 goal if appropriate (especially for new users or urgent items).`;

export class PrioritizeOptimizeAgent {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      model: "gpt-5-mini",
      // Note: GPT-5-mini only supports default temperature (1)
      // LangChain doesn't support max_completion_tokens yet, so using defaults
    });
  }

  async processMessage(context: AgentContext): Promise<AgentResponse> {
    const { userId, userMessage, profile, workingSet, recentMessages } = context;

    // Get user's current goals and habits
    const [currentGoals, currentHabits] = await Promise.all([
      this.getCurrentGoals(userId),
      this.getCurrentHabits(userId)
    ]);

    // Format recent messages for context
    const recentMessagesText = recentMessages
      .slice(-6)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = PRIORITIZE_OPTIMIZE_AGENT_SYSTEM_PROMPT
      .replace('{profile}', JSON.stringify(profile, null, 2))
      .replace('{workingSet}', JSON.stringify(workingSet, null, 2))
      .replace('{currentGoals}', JSON.stringify(currentGoals, null, 2))
      .replace('{currentHabits}', JSON.stringify(currentHabits, null, 2))
      .replace('{recentMessages}', recentMessagesText);

    const response = await this.model.invoke([
      { role: 'system', content: prompt },
      { role: 'user', content: userMessage }
    ]);

    const finalText = (response.content as string) || '';

    // Gate: don't immediately produce a proposal on the very first optimize request
    const lower = userMessage.toLowerCase();
    const wantsImmediateProposal = /\b(show|proposal|ready|proceed|go ahead|generate|create)\b/.test(lower);
    const isInitialOptimizeAsk = /optimi[zs]e/.test(lower) && /prioriti[sz]e/.test(lower) && !wantsImmediateProposal && (recentMessages?.length ?? 0) < 2;

    // Build structured optimization proposal for card rendering only when user signals readiness
    const optimizationData = isInitialOptimizeAsk ? undefined : this.buildOptimizationProposal(currentGoals, currentHabits);

    // If we have optimization data, append it to the response for persistence
    let finalResponse = finalText;
    if (optimizationData) {
      finalResponse += `\n\n---json---\n${JSON.stringify(optimizationData)}`;
    }

    return {
      finalText: finalResponse,
      structuredData: optimizationData,
    };
  }

  private async getCurrentGoals(userId: string) {
    const goals = await db
      .select({
        goalDef: goalDefinitions,
        goalInst: goalInstances,
      })
      .from(goalDefinitions)
      .leftJoin(goalInstances, eq(goalInstances.goalDefinitionId, goalDefinitions.id))
      .where(eq(goalDefinitions.userId, userId))
      .orderBy(desc(goalDefinitions.createdAt))
      .limit(10);

    return goals.filter(g => g.goalDef.archived === false);
  }

  private async getCurrentHabits(userId: string) {
    const habitsData = await db
      .select()
      .from(habitDefinitions)
      .where(eq(habitDefinitions.userId, userId))
      .orderBy(desc(habitDefinitions.createdAt))
      .limit(15);
    
    return habitsData;
  }

  private buildOptimizationProposal(currentGoals: any[], currentHabits: any[]) {
    try {
      // Prioritization: top 3-4 by progress/momentum
      const rankedGoals = [...currentGoals]
        .filter((g: any) => g?.goalInst?.id && (g?.goalDef?.title || '').trim().length > 0)
        .sort((a: any, b: any) => (b.goalInst?.currentValue || 0) - (a.goalInst?.currentValue || 0))
        .slice(0, 3);

      const prioritization = rankedGoals.map((g: any, idx: number) => ({
        goalInstanceId: g.goalInst.id,
        rank: idx + 1,
        reason: `High leverage and momentum (progress: ${Math.round(g.goalInst?.currentValue || 0)}%)`
      }));

      // Optimized habits: pick up to 5 higher-impact habits (placeholder scoring)
      const topHabits = [...currentHabits].slice(0, 5);
      const optimizedHabits = topHabits.map((h: any, i: number) => ({
        goalInstanceId: prioritization[0]?.goalInstanceId || rankedGoals[0]?.goalInst?.id,
        action: 'replace',
        habitDefinitionId: h.id,
        rationale: 'Focus on fewer, higher-impact habits to maximize progress',
        newHabit: {
          title: h.name,
          description: h.description || '',
          targetValue: h.targetValue || 1,
          frequencySettings: h.frequencySettings || null
        }
      }));

      return { type: 'optimization', prioritization, optimizedHabits };
    } catch {
      return null;
    }
  }
}
