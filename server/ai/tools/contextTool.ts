import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { MyFocusService } from "../../services/myFocusService";
import { db } from "../../db";
import { goalDefinitions, goalInstances, habitDefinitions, habitInstances, insights, lifeMetricDefinitions } from "../../../shared/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * Universal context retrieval tool
 * Replaces: get_my_focus, get_all_goals, get_habit_history, get_insights, get_life_metrics
 */
export const getContextTool = new DynamicStructuredTool({
  name: "get_context",
  description: `Gets user context for coaching conversations.
  
  Args:
  - scope: "my_focus" | "all_goals" | "habits" | "insights" | "life_metrics"
  - filters: Optional {status, life_metric, timeframe, goal_ids, days}
  
  Examples:
  - get_context("my_focus") → top 3 goals, active habits, key insights
  - get_context("all_goals", {status: "completed"}) → completed goals
  - get_context("habits", {days: 30}) → habit history last 30 days
  - get_context("insights", {life_metric: "Career"}) → career insights
  - get_context("life_metrics") → life categories and distribution
  
  Use this to understand user's current state before making suggestions.
  Always call this at the start of conversations to avoid duplicate goals/habits.`,
  
  schema: z.object({
    scope: z.enum(["my_focus", "all_goals", "habits", "insights", "life_metrics"]),
    filters: z.record(z.any()).optional()
  }),
  
  func: async ({ scope, filters }, config) => {
    console.log("\n🔧 [get_context] Tool function CALLED!");
    console.log("[get_context] Scope:", scope);
    console.log("[get_context] Filters:", filters);
    
    // Try to get userId from config first, then fallback to global variable
    let userId = config?.configurable?.userId;
    if (!userId) {
      userId = (global as any).__TOOL_USER_ID__;
      console.log("[get_context] Using global userId:", userId);
    } else {
      console.log("[get_context] Using config userId:", userId);
    }
    
    if (!userId) {
      console.error("[get_context] ❌ No userId found in config or global!");
      return JSON.stringify({ error: "User ID required" });
    }
    
    try {
      console.log("[get_context] Processing scope:", scope);
      
      switch (scope) {
        case "my_focus": {
          console.log("[get_context] Fetching My Focus for user:", userId);
          const myFocus = await MyFocusService.getMyFocus(userId);
          console.log("[get_context] ✅ My Focus retrieved:", {
            goals: myFocus.priorityGoals.length,
            habits: myFocus.highLeverageHabits.length,
            insights: myFocus.keyInsights.length
          });
          
          // Return a simplified summary for the agent, NOT the full data
          // The agent can use this info to respond naturally
          const summary = `USER'S CURRENT FOCUS:

Priority Goals (${myFocus.priorityGoals.length}):
${myFocus.priorityGoals.map((g: any, i: number) => 
  `${i + 1}. ${g.title} (${g.lifeMetric}) - ${g.progress}% complete${g.status === 'completed' ? ' ✓ COMPLETED' : ''}`
).join('\n')}

Active Habits (${myFocus.highLeverageHabits.length}):
${myFocus.highLeverageHabits.map((h: any) => `- ${h.title}`).join('\n')}

Key Insights (${myFocus.keyInsights.length}):
${myFocus.keyInsights.map((i: any) => `- ${i.title}: ${i.explanation.substring(0, 100)}...`).join('\n')}`;
          
          console.log("[get_context] ✅ Returning summary to agent");
          return summary;
        }
        
        case "all_goals": {
          const status = filters?.status || "active";
          
          // Get goal definitions with instances
          const goalDefs = await db
            .select()
            .from(goalDefinitions)
            .where(
              and(
                eq(goalDefinitions.userId, userId),
                eq(goalDefinitions.isActive, true),
                eq(goalDefinitions.archived, false)
              )
            )
            .orderBy(desc(goalDefinitions.createdAt));
          
          const goalsWithInstances = await Promise.all(
            goalDefs.map(async (def) => {
              const instances = await db
                .select()
                .from(goalInstances)
                .where(
                  and(
                    eq(goalInstances.goalDefinitionId, def.id),
                    status !== "all" ? eq(goalInstances.status, status) : undefined
                  )
                )
                .orderBy(desc(goalInstances.createdAt));
              
              return {
                id: def.id,
                title: def.title,
                description: def.description,
                category: def.category,
                instances: instances.map(i => ({
                  id: i.id,
                  status: i.status,
                  targetValue: i.targetValue,
                  currentValue: i.currentValue,
                  targetDate: i.targetDate,
                  progress: i.targetValue > 0 ? Math.round((i.currentValue / i.targetValue) * 100) : 0
                }))
              };
            })
          );
          
          return {
            success: true,
            data: goalsWithInstances,
            summary: `Found ${goalsWithInstances.length} goals with status: ${status}`
          };
        }
        
        case "habits": {
          const days = filters?.days || 30;
          
          // Get active habit definitions
          const habitDefs = await db
            .select()
            .from(habitDefinitions)
            .where(
              and(
                eq(habitDefinitions.userId, userId),
                eq(habitDefinitions.isActive, true)
              )
            )
            .orderBy(desc(habitDefinitions.createdAt));
          
          const habitsWithHistory = await Promise.all(
            habitDefs.map(async (def) => {
              const instances = await db
                .select()
                .from(habitInstances)
                .where(eq(habitInstances.habitDefinitionId, def.id))
                .orderBy(desc(habitInstances.completedAt))
                .limit(days);
              
              const completedCount = instances.filter(i => i.completed).length;
              const streak = instances[0]?.currentStreak || 0;
              
              return {
                id: def.id,
                title: def.name,
                frequency: def.frequency,
                currentStreak: streak,
                completionRate: instances.length > 0 ? completedCount / instances.length : 0,
                recentCompletions: instances.slice(0, 7).map(i => ({
                  date: i.date,
                  completed: i.completed
                }))
              };
            })
          );
          
          return {
            success: true,
            data: habitsWithHistory,
            summary: `${habitsWithHistory.length} active habits over last ${days} days`
          };
        }
        
        case "insights": {
          const lifeMetric = filters?.life_metric;
          
          let query = db
            .select()
            .from(insights)
            .where(eq(insights.userId, userId))
            .orderBy(desc(insights.confidence), desc(insights.createdAt));
          
          const allInsights = await query.limit(20);
          
          const filtered = lifeMetric
            ? allInsights.filter(i => i.lifeMetricIds?.includes(lifeMetric))
            : allInsights;
          
          return {
            success: true,
            data: filtered.map(i => ({
              id: i.id,
              title: i.title,
              explanation: i.explanation,
              confidence: i.confidence,
              lifeMetrics: i.lifeMetricIds,
              votes: i.votes || 0
            })),
            summary: `${filtered.length} insights${lifeMetric ? ` for ${lifeMetric}` : ""}`
          };
        }
        
        case "life_metrics": {
          const metrics = await db
            .select()
            .from(lifeMetricDefinitions)
            .where(
              and(
                eq(lifeMetricDefinitions.userId, userId),
                eq(lifeMetricDefinitions.isActive, true)
              )
            );
          
          // Get goal/habit counts per metric
          const metricsWithCounts = await Promise.all(
            metrics.map(async (metric) => {
              const goalCount = await db
                .select()
                .from(goalDefinitions)
                .where(
                  and(
                    eq(goalDefinitions.userId, userId),
                    eq(goalDefinitions.lifeMetricId, metric.id),
                    eq(goalDefinitions.isActive, true)
                  )
                );
              
              return {
                id: metric.id,
                name: metric.name,
                description: metric.description,
                color: metric.color,
                timeAvailability: metric.timeAvailability,
                goalCount: goalCount.length
              };
            })
          );
          
          return {
            success: true,
            data: metricsWithCounts,
            summary: `${metricsWithCounts.length} life metric categories`
          };
        }
        
        default:
          throw new Error(`Unknown scope: ${scope}`);
      }
    } catch (error) {
      console.error(`[getContextTool] Error fetching ${scope}:`, error);
      return {
        success: false,
        error: error.message,
        summary: `Failed to fetch ${scope}`
      };
    }
  }
});

