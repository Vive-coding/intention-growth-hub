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

**Your conversation style:**
- Strategic and analytical
- Focus on high-leverage actions
- Ask clarifying questions about their priorities
- Provide clear reasoning for recommendations
- Help them see the bigger picture

**Context about the user:**
{profile}
{workingSet}
{currentGoals}
{currentHabits}

**Recent conversation:**
{recentMessages}

Your goal is to help them optimize their current goals and habits for maximum impact, then suggest new priorities if needed.`;

export class PrioritizeOptimizeAgent {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.6,
      maxTokens: 500,
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

    const finalText = response.content as string;

    // Generate optimization data for card rendering
    const optimizationData = this.generateOptimizationData(currentGoals, currentHabits);

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

  private generateOptimizationData(currentGoals: any[], currentHabits: any[]): OptimizationData {
    // Generate optimization recommendations based on current goals and habits
    const recommendations = [];

    // Example optimization logic - can be enhanced with more sophisticated analysis
    if (currentHabits.length > 8) {
      recommendations.push({
        type: 'archive' as const,
        title: 'Archive low-impact habits',
        description: 'You have many habits. Consider archiving 2-3 that have lower impact to focus on your most important ones.'
      });
    }

    if (currentGoals.length > 5) {
      recommendations.push({
        type: 'modify' as const,
        title: 'Consolidate similar goals',
        description: 'You have multiple goals in similar areas. Consider consolidating them into 2-3 focused objectives.'
      });
    }

    recommendations.push({
      type: 'add' as const,
      title: 'Add energy management habit',
      description: 'Consider adding a daily energy check-in to optimize your performance across all goals.'
    });

    return {
      type: 'optimization',
      summary: `Based on your ${currentGoals.length} goals and ${currentHabits.length} habits, here are strategic optimizations to maximize your impact:`,
      recommendations
    };
  }
}
