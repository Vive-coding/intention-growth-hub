import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../db";
import { goalDefinitions, goalInstances, habitDefinitions, habitInstances, lifeMetricDefinitions } from "../../../shared/schema";
import { eq, and, desc, gte } from "drizzle-orm";

/**
 * Tool: Show progress summary
 */
export const showProgressSummaryTool = new DynamicStructuredTool({
  name: "show_progress_summary",
  description: `Shows visual progress dashboard card in chat.
  
  Args:
  - scope: "goals" | "habits" | "life_metric"
  - filters: {goal_ids: [], life_metric: str, timeframe: str}
  
  Examples:
  - show_progress_summary("goals", {goal_ids: ["uuid1", "uuid2"]})
  - show_progress_summary("life_metric", {life_metric: "Career"})
  - show_progress_summary("habits", {timeframe: "last_30_days"})
  
  Use when:
  - User asks "how am I doing?"
  - Celebrating progress
  - Reviewing specific area
  
  Returns: Visual dashboard card with stats, charts, wins`,
  
  schema: z.object({
    scope: z.enum(["goals", "habits", "life_metric"]),
    filters: z.record(z.any()).optional()
  }),
  
  func: async ({ scope, filters }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID required");
    }
    
    try {
      if (scope === "goals") {
        // Get specific goals or all active goals
        const goalIds = filters?.goal_ids || [];
        
        let query = db
          .select()
          .from(goalDefinitions)
          .where(
            and(
              eq(goalDefinitions.userId, userId),
              eq(goalDefinitions.isActive, true)
            )
          );
        
        const goals = await query;
        
        // Get instances and calculate progress
        const goalsWithProgress = await Promise.all(
          goals.map(async (goal) => {
            const instances = await db
              .select()
              .from(goalInstances)
              .where(
                and(
                  eq(goalInstances.goalDefinitionId, goal.id),
                  eq(goalInstances.status, "active")
                )
              );
            
            const totalProgress = instances.reduce((sum, inst) => {
              const progress = inst.targetValue > 0 
                ? (inst.currentValue / inst.targetValue) * 100 
                : 0;
              return sum + Math.min(progress, 100);
            }, 0);
            
            const avgProgress = instances.length > 0 ? totalProgress / instances.length : 0;
            
            return {
              id: goal.id,
              title: goal.title,
              progress: Math.round(avgProgress),
              instances: instances.length
            };
          })
        );
        
        // Filter if specific goal IDs provided
        const filtered = goalIds.length > 0
          ? goalsWithProgress.filter(g => goalIds.includes(g.id))
          : goalsWithProgress;
        
        const result = {
          type: "progress_summary",
          scope: "goals",
          summary: {
            total_goals: filtered.length,
            avg_progress: Math.round(filtered.reduce((sum, g) => sum + g.progress, 0) / filtered.length),
            on_track: filtered.filter(g => g.progress >= 60).length,
            needs_attention: filtered.filter(g => g.progress < 40).length
          },
          goals: filtered
        };
        
        return JSON.stringify(result);
      }
      
      if (scope === "habits") {
        const timeframe = filters?.timeframe || "last_30_days";
        const days = timeframe === "last_30_days" ? 30 : 7;
        
        // Get all active habits
        const habits = await db
          .select()
          .from(habitDefinitions)
          .where(
            and(
              eq(habitDefinitions.userId, userId),
              eq(habitDefinitions.isActive, true)
            )
          );
        
        const habitsWithStats = await Promise.all(
          habits.map(async (habit) => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            const instances = await db
              .select()
              .from(habitInstances)
              .where(
                and(
                  eq(habitInstances.habitDefinitionId, habit.id),
                  gte(habitInstances.date, cutoffDate.toISOString().split('T')[0])
                )
              )
              .orderBy(desc(habitInstances.date));
            
            const completed = instances.filter(i => i.completed).length;
            const completionRate = instances.length > 0 ? completed / instances.length : 0;
            const streak = instances[0]?.currentStreak || 0;
            
            return {
              id: habit.id,
              title: habit.name,
              completion_rate: Math.round(completionRate * 100),
              streak: streak,
              total_completions: completed
            };
          })
        );
        
        const result = {
          type: "progress_summary",
          scope: "habits",
          timeframe: timeframe,
          summary: {
            total_habits: habitsWithStats.length,
            avg_completion_rate: Math.round(
              habitsWithStats.reduce((sum, h) => sum + h.completion_rate, 0) / habitsWithStats.length
            ),
            strong_streaks: habitsWithStats.filter(h => h.streak >= 7).length,
            total_completions: habitsWithStats.reduce((sum, h) => sum + h.total_completions, 0)
          },
          habits: habitsWithStats
        };
        
        return JSON.stringify(result);
      }
      
      if (scope === "life_metric") {
        const lifeMetricName = filters?.life_metric;
        
        if (!lifeMetricName) {
          throw new Error("life_metric filter required for this scope");
        }
        
        // Get the life metric
        const [metric] = await db
          .select()
          .from(lifeMetricDefinitions)
          .where(
            and(
              eq(lifeMetricDefinitions.userId, userId),
              eq(lifeMetricDefinitions.name, lifeMetricName)
            )
          )
          .limit(1);
        
        if (!metric) {
          throw new Error(`Life metric not found: ${lifeMetricName}`);
        }
        
        // Get goals in this metric
        const goals = await db
          .select()
          .from(goalDefinitions)
          .where(
            and(
              eq(goalDefinitions.userId, userId),
              eq(goalDefinitions.lifeMetricId, metric.id),
              eq(goalDefinitions.isActive, true)
            )
          );
        
        const goalsWithProgress = await Promise.all(
          goals.map(async (goal) => {
            const instances = await db
              .select()
              .from(goalInstances)
              .where(eq(goalInstances.goalDefinitionId, goal.id));
            
            const avgProgress = instances.length > 0
              ? instances.reduce((sum, i) => sum + ((i.currentValue / i.targetValue) * 100), 0) / instances.length
              : 0;
            
            return {
              id: goal.id,
              title: goal.title,
              progress: Math.round(avgProgress)
            };
          })
        );
        
        const result = {
          type: "progress_summary",
          scope: "life_metric",
          life_metric: lifeMetricName,
          summary: {
            total_goals: goalsWithProgress.length,
            avg_progress: Math.round(
              goalsWithProgress.reduce((sum, g) => sum + g.progress, 0) / goalsWithProgress.length
            ),
            color: metric.color
          },
          goals: goalsWithProgress
        };
        
        return JSON.stringify(result);
      }
      
      throw new Error(`Unknown scope: ${scope}`);
    } catch (error) {
      console.error("[showProgressSummaryTool] Error:", error);
      throw error;
    }
  }
});

