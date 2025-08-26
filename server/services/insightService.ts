import { storage } from '../storage';
import { insightAgent } from '../ai/agent';
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
      const [existingInsights, lifeMetrics, activeGoals] = await Promise.all([
        storage.getUserInsights(userId),
        storage.getUserLifeMetrics(userId),
        storage.getUserGoalInstances(userId)
      ]);

      console.log('Context data fetched:', {
        existingInsightsCount: existingInsights.length,
        lifeMetricsCount: lifeMetrics.length,
        activeGoalsCount: activeGoals.length
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

        console.log('Creating suggested goals and habits...');
        
        // Validate and create suggested goals - only accept actual UUIDs
        const validGoals = result.suggestedGoals?.filter((goal: { lifeMetricId: string; title: string; description: string }) => 
          goal.lifeMetricId && 
          goal.title && 
          goal.description &&
          goal.lifeMetricId !== 'metric-1' && 
          goal.lifeMetricId !== 'metric-2' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(goal.lifeMetricId)
        ) || [];
        
        // Validate suggested habits - only accept actual UUIDs
        let validHabits = result.suggestedHabits?.filter((habit: { lifeMetricId: string; title: string; description: string }) => 
          habit.lifeMetricId && 
          habit.title && 
          habit.description &&
          habit.lifeMetricId !== 'metric-1' && 
          habit.lifeMetricId !== 'metric-2' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(habit.lifeMetricId)
        ) || [];
        // Enforce per-metric cap on new habits (time availability)
        const byMetric = new Map<string, { count: number; items: any[] }>();
        for (const h of validHabits) {
          const cap = maxNewHabitsPerMetric.get(h.lifeMetricId) ?? 2;
          const bucket = byMetric.get(h.lifeMetricId) || { count: 0, items: [] };
          if (bucket.count < cap) {
            bucket.count += 1;
            bucket.items.push(h);
            byMetric.set(h.lifeMetricId, bucket);
          }
        }
        validHabits = Array.from(byMetric.values()).flatMap(b => b.items);
        
        console.log('Valid goals:', validGoals.length);
        console.log('Valid habits:', validHabits.length);
        
        // Create suggested goals and habits
        await Promise.all([
          ...validGoals.map((goal: { lifeMetricId: string; title: string; description: string }) =>
            storage.createSuggestedGoal({
              insightId: insight.id,
              lifeMetricId: goal.lifeMetricId,
              title: goal.title,
              description: goal.description,
            })
          ),
          ...validHabits.map((habit: { lifeMetricId: string; title: string; description: string }) =>
            storage.createSuggestedHabit({
              insightId: insight.id,
              lifeMetricId: habit.lifeMetricId,
              title: habit.title,
              description: habit.description,
            })
          ),
        ]);

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