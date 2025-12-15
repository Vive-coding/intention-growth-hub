import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { MyFocusService } from "../../services/myFocusService";
import { db } from "../../db";
import { goalDefinitions, goalInstances, habitDefinitions, habitInstances, habitCompletions, insights, insightLifeMetrics, insightVotes, lifeMetricDefinitions } from "../../../shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";

/**
 * Universal context retrieval tool
 * Replaces: get_my_focus, get_all_goals, get_habit_history, get_insights, get_life_metrics
 */
export const getContextTool = new DynamicStructuredTool({
  name: "get_context",
  description: `Retrieves user context for coaching conversations.
  
  Scopes available:
  - "my_focus" → top 3 goals, active habits, key insights
  - "all_goals" → all goals (with optional status filter)
  - "habits" → habit history (with optional days filter)
  - "insights" → insights (with optional life_metric filter)
  - "life_metrics" → life categories and distribution
  
  Optional filters: {status, life_metric, timeframe, goal_ids, days}
  
  Call this when you need current information about the user's goals, habits, or progress. In ongoing conversations, you can rely on conversation history unless the user explicitly asks for updates or you need to verify current state.`,
  
  schema: z.object({
    scope: z.enum(["my_focus", "all_goals", "habits", "insights", "life_metrics"]),
    filters: z.record(z.any()).optional()
  }),
  
  func: async ({ scope, filters }, config) => {
    console.log("\n🔧 [get_context] Tool function CALLED!");
    console.log("[get_context] Scope:", scope);
    console.log("[get_context] Filters:", filters);
    
    // Try to get userId from config first, then fallback to global variable
    let userId = (config as any)?.configurable?.userId;
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
                term: def.term || undefined,
                instances: instances.map(i => ({
                  id: i.id,
                  status: i.status,
                  targetValue: i.targetValue,
                  currentValue: i.currentValue ?? 0,
                  targetDate: i.targetDate,
                  progress: i.targetValue > 0 ? Math.round(((i.currentValue ?? 0) / i.targetValue) * 100) : 0
                }))
              };
            })
          );
          
          // Filter out goals that have no instances for the requested status
          // (prevents the agent from selecting archived/empty goals that can't be updated)
          const activeGoals = goalsWithInstances.filter(g => Array.isArray(g.instances) && g.instances.length > 0);
          
          return JSON.stringify({
            success: true,
            data: activeGoals,
            summary: `Found ${activeGoals.length} goals with status: ${status}`
          });
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
          
                    // Calculate cutoff date for last N days
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - days);
          
          const habitsWithHistory = await Promise.all(
            habitDefs.map(async (def) => {
              // Get habit instances to find frequency settings
              const instances = await db
                .select()
                .from(habitInstances)
                .where(eq(habitInstances.habitDefinitionId, def.id))
                .limit(1);
              
              // Get completions for this habit in the date range
              const completions = await db
                .select()
                .from(habitCompletions)
                .where(
                  and(
                    eq(habitCompletions.habitDefinitionId, def.id),
                    eq(habitCompletions.userId, userId),
                    gte(habitCompletions.completedAt, cutoffDate)
                  )
                )
                .orderBy(desc(habitCompletions.completedAt))
                .limit(days);
              
              // Get frequency from first instance's frequencySettings, or default to 'daily'
              const frequencySettings = instances[0]?.frequencySettings as any;
              const frequency = frequencySettings?.frequency || 'daily';
              
              // Get streak from first instance's goalSpecificStreak, or from completions
              let streak = instances[0]?.goalSpecificStreak || def.globalStreak || 0;
              
              // Calculate completion rate based on completions
              const completionRate = completions.length > 0 ? Math.min(100, (completions.length / days) * 100) : 0;
              
              return {
                id: def.id,
                title: def.name,
                frequency: frequency,
                currentStreak: streak,
                completionRate: completionRate,
                recentCompletions: completions.slice(0, 7).map(c => ({
                  date: c.completedAt,
                  completed: true
                }))
              };
            })
          );
          
          return JSON.stringify({
            success: true,
            data: habitsWithHistory,
            summary: `${habitsWithHistory.length} active habits over last ${days} days`
          });
        }
        
        case "insights": {
          const lifeMetric = filters?.life_metric;
          
          // Get all insights for the user
          const allInsights = await db
            .select()
            .from(insights)
            .where(eq(insights.userId, userId))
            .orderBy(desc(insights.confidence), desc(insights.createdAt))
            .limit(20);
          
          // For each insight, get associated life metrics and votes
          const insightsWithRelations = await Promise.all(
            allInsights.map(async (insight) => {
              // Get life metrics for this insight
              const metrics = await db
                .select({ lifeMetricId: insightLifeMetrics.lifeMetricId })
                .from(insightLifeMetrics)
                .where(eq(insightLifeMetrics.insightId, insight.id));
              
              const lifeMetricIds = metrics.map(m => m.lifeMetricId);
              
              // Get votes count for this insight
              const votes = await db
                .select()
                .from(insightVotes)
                .where(eq(insightVotes.insightId, insight.id));
              
              const voteCount = votes.filter(v => v.isUpvote).length - votes.filter(v => !v.isUpvote).length;
              
              return {
                id: insight.id,
                title: insight.title,
                explanation: insight.explanation,
                confidence: insight.confidence,
                themes: insight.themes,
                createdAt: insight.createdAt,
                updatedAt: insight.updatedAt,
                lifeMetricIds,
                voteCount
              };
            })
          );
          
          // Filter by life metric if specified
          const filtered = lifeMetric
            ? insightsWithRelations.filter(i => i.lifeMetricIds.includes(lifeMetric))
            : insightsWithRelations;
          
          return JSON.stringify({
            success: true,
            data: filtered.map(i => ({
              id: i.id,
              title: i.title,
              explanation: i.explanation,
              confidence: i.confidence,
              lifeMetrics: i.lifeMetricIds,
              votes: i.voteCount || 0
            })),
            summary: `${filtered.length} insights${lifeMetric ? ` for ${lifeMetric}` : ""}`
          });
        }
        
        case "life_metrics": {
          let metrics = await db
            .select()
            .from(lifeMetricDefinitions)
            .where(
              and(
                eq(lifeMetricDefinitions.userId, userId),
                eq(lifeMetricDefinitions.isActive, true)
              )
            );
          
          // Create default life metrics if user has none (should always exist)
          if (metrics.length === 0) {
            console.log(`[contextTool] Creating default life metrics for user ${userId}`);
            const defaultMetrics = [
              { name: "Career Growth 🚀", color: "#6366F1" },
              { name: "Health & Fitness 🏃‍♀️", color: "#10B981" },
              { name: "Personal Development 🧠", color: "#8B5CF6" },
              { name: "Finance 💰", color: "#F59E0B" },
              { name: "Relationships ❤️", color: "#EC4899" },
              { name: "Mental Health 🧘‍♂️", color: "#0EA5E9" },
            ];
            
            for (const metric of defaultMetrics) {
              const [created] = await db
                .insert(lifeMetricDefinitions)
                .values({
                  userId,
                  name: metric.name,
                  description: null,
                  color: metric.color,
                })
                .returning();
              metrics.push(created);
            }
          }
          
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
          
          return JSON.stringify({
            success: true,
            data: metricsWithCounts,
            summary: `${metricsWithCounts.length} life metric categories`
          });
        }
        
        default:
          throw new Error(`Unknown scope: ${scope}`);
      }
    } catch (error) {
      console.error(`[getContextTool] Error fetching ${scope}:`, error);
      return JSON.stringify({
        success: false,
        error: (error as any).message,
        summary: `Failed to fetch ${scope}`
      });
    }
  }
});

