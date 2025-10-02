import { storage } from '../storage';
import { insightAgent } from '../ai/agent';
import { ContextBuilder } from './contextBuilder';
import type { JournalEntry, Insight, LifeMetricDefinition, GoalInstance } from '../../shared/schema';

export class InsightService {
  static async generateInsightsForJournal(journalEntry: JournalEntry) {
    try {
      console.log('Starting insight generation for journal:', {
        id: journalEntry.id,
        title: journalEntry.title
      });

      const userId = journalEntry.userId;

      // Get context data
      console.log('Fetching context data...');
      const [existingInsights, lifeMetrics, activeGoals, additionalContext] = await Promise.all([
        storage.getUserInsights(userId),
        storage.getUserLifeMetrics(userId),
        storage.getUserGoalInstances(userId),
        ContextBuilder.buildInsightContext(userId)
      ]);

      console.log('Context data fetched:', {
        existingInsightsCount: existingInsights.length,
        lifeMetricsCount: lifeMetrics.length,
        activeGoalsCount: activeGoals.length,
        currentDailyHabitCount: additionalContext.currentDailyHabitCount
      });

      // Create a mapping of life metric names to UUIDs
      const lifeMetricMapping = new Map(
        lifeMetrics.map(metric => [metric.name, metric.id])
      );

      // Build simple per-metric caps for new habits based on time availability
      const availabilityToMaxHabits: Record<string, number> = {
        none: 0,
        very_little: 1,
        some: 2,
        plenty: 2,
      };
      const maxNewHabitsPerMetric = new Map<string, number>(
        lifeMetrics.map(m => [m.id, availabilityToMaxHabits[(m as any).timeAvailability || 'some']])
      );

      // Format context for the AI agent
      const context = {
        journalEntry: journalEntry.content,
        existingInsights: this.formatInsights(existingInsights),
        activeGoals: this.formatGoals(activeGoals),
        recentHabits: '', // TODO: Implement habits
        lifeMetrics: this.formatLifeMetrics(lifeMetrics),
        lifeMetricMapping: JSON.stringify(Object.fromEntries(lifeMetricMapping)),
        timeBudgetMinutesPerWeek: 0, // legacy placeholder
        // NEW: Additional context for better AI suggestions
        recentAcceptedGoals: additionalContext.recentAcceptedGoals,
        recentAcceptedHabits: additionalContext.recentAcceptedHabits,
        upvotedInsights: additionalContext.upvotedInsights,
        currentDailyHabitCount: additionalContext.currentDailyHabitCount,
      };

      console.log('Calling AI agent with formatted context...');
      // Process with AI agent
      // Expose userId to retrieval tools during this call
      (global as any).__CURRENT_USER_ID__ = userId;
      const result = await insightAgent.processJournalEntry(context);
      delete (global as any).__CURRENT_USER_ID__;
      console.log('AI agent returned result:', result);

      // Save the insight
      if (result.action === 'create') {
        console.log('Creating new insight...');
        
        // Validate and clean life metric IDs - only accept actual UUIDs
        const validLifeMetricIds = result.lifeMetricIds?.filter((id: string) => 
          typeof id === 'string' && 
          id.length > 0 && 
          id !== 'metric-1' && 
          id !== 'metric-2' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ) || [];
        
        console.log('Life metric IDs:', result.lifeMetricIds);
        console.log('Valid life metric IDs:', validLifeMetricIds);
        
        const insight = await storage.createInsight({
          userId,
          title: result.title,
          explanation: result.explanation,
          confidence: result.confidence,
          themes: [], // No themes - only life metrics
          lifeMetricIds: validLifeMetricIds,
        });

        console.log('Creating suggested goals with nested habits...');
        
        // Validate goals with nested habits structure
        const validGoals = (result.suggestedGoals || []).filter((goal: any) => 
          goal.lifeMetricId && 
          goal.title && 
          goal.description &&
          goal.lifeMetricId !== 'metric-1' && 
          goal.lifeMetricId !== 'metric-2' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(goal.lifeMetricId)
        );
        
        console.log('Valid goals:', validGoals.length);
        
        // Create goals and their associated habits
        for (const goalData of validGoals) {
          try {
            // Create the suggested goal
            const createdGoal = await storage.createSuggestedGoal({
              insightId: insight.id,
              lifeMetricId: goalData.lifeMetricId,
              title: goalData.title,
              description: goalData.description,
            });
            
            console.log(`✓ Created goal: ${goalData.title}`);
            
            // Create and link habits for this goal
            if (goalData.habits && Array.isArray(goalData.habits)) {
              for (const habitData of goalData.habits) {
                // Validate habit has required fields
                if (
                  habitData.lifeMetricId && 
                  habitData.title && 
                  habitData.description &&
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(habitData.lifeMetricId)
                ) {
                  // Create suggested habit
                  const createdHabit = await storage.createSuggestedHabit({
                    insightId: insight.id,
                    lifeMetricId: habitData.lifeMetricId,
                    title: habitData.title,
                    description: habitData.description,
                    targetFrequency: habitData.frequency || 'daily',
                    targetCount: habitData.targetCount || 1,
                    isHighLeverage: habitData.isHighLeverage || false,
                    applicableGoalTypes: habitData.applicableGoalTypes || [],
                  });
                  
                  // Link habit to goal with priority
                  await storage.linkSuggestedGoalHabit({
                    suggestedGoalId: createdGoal.id,
                    suggestedHabitId: createdHabit.id,
                    priority: habitData.priority || 2,
                  });
                  
                  console.log(`  ✓ Created and linked habit: ${habitData.title} (priority: ${habitData.priority}, high-leverage: ${habitData.isHighLeverage})`);
                } else {
                  console.warn(`  ⚠ Skipped invalid habit for goal ${goalData.title}:`, habitData);
                }
              }
            }
          } catch (error) {
            console.error(`Error creating goal "${goalData.title}":`, error);
          }
        }

        console.log('New insight created successfully:', {
          id: insight.id,
          title: insight.title
        });
        return insight;
      } else if (result.action === 'update' && result.insightId) {
        console.log('Updating existing insight:', result.insightId);
        // Update existing insight
        const updatedInsight = await storage.updateInsightConfidence(
          result.insightId,
          result.confidence
        );

        console.log('Creating new suggested goals and habits...');
        // Create new suggested goals and habits (respecting caps)
        // Enforce habit caps again on update path
        let filteredUpdateHabits = result.suggestedHabits;
        if (Array.isArray(filteredUpdateHabits)) {
          const byMetric2 = new Map<string, { count: number; items: any[] }>();
          const tmp: any[] = [];
          for (const h of filteredUpdateHabits) {
            const cap = maxNewHabitsPerMetric.get(h.lifeMetricId) ?? 2;
            const bucket = byMetric2.get(h.lifeMetricId) || { count: 0, items: [] };
            if (bucket.count < cap) {
              bucket.count += 1;
              bucket.items.push(h);
              byMetric2.set(h.lifeMetricId, bucket);
              tmp.push(h);
            }
          }
          filteredUpdateHabits = tmp;
        }
        await Promise.all([
          ...result.suggestedGoals.map((goal: { lifeMetricId: string; title: string; description: string }) =>
            storage.createSuggestedGoal({
              insightId: result.insightId!,
              lifeMetricId: goal.lifeMetricId,
              title: goal.title,
              description: goal.description,
            })
          ),
          ...(filteredUpdateHabits as any[]).map((habit: { lifeMetricId: string; title: string; description: string }) =>
            storage.createSuggestedHabit({
              insightId: result.insightId!,
              lifeMetricId: habit.lifeMetricId,
              title: habit.title,
              description: habit.description,
            })
          ),
        ]);

        console.log('Insight updated successfully:', {
          id: updatedInsight.id,
          title: updatedInsight.title
        });
        return updatedInsight;
      } else if (result.action === 'skip') {
        console.log('No novel insight found - skipping insight creation');
        return null;
      }
    } catch (error) {
      console.error('Error in generateInsightsForJournal:', error);
      throw error;
    }
  }

  private static formatInsights(insights: Insight[]): string {
    return insights
      .map(
        insight => `
Title: ${insight.title}
Explanation: ${insight.explanation}
Confidence: ${insight.confidence}%
---`
      )
      .join('\n');
  }

  private static formatGoals(goals: GoalInstance[]): string {
    return goals
      .map(
        goal => `
Goal: ${goal.goalDefinitionId}
Progress: ${goal.currentValue}/${goal.targetValue}
Status: ${goal.status}
---`
      )
      .join('\n');
  }

  private static formatLifeMetrics(metrics: LifeMetricDefinition[]): string {
    return metrics
      .map(
        metric => `
Metric: ${metric.name}
Description: ${metric.description || 'No description'}
TimeAvailability: ${(metric as any).timeAvailability || 'some'}
---`
      )
      .join('\n');
  }
}

export const insightService = new InsightService(); 