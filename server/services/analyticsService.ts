// Backend analytics service for Amplitude
// Use namespace import for CommonJS compatibility with ESM/esbuild
import * as amplitude from '@amplitude/analytics-node';
const { track, identify, setUserId, init, Identify } = amplitude;

// Types for analytics events
export interface UserProperties {
  email?: string;
  timezone?: string;
  createdAt?: string;
  totalGoals?: number;
  totalHabits?: number;
  totalJournals?: number;
}

export interface BaseEventProperties {
  [key: string]: any;
}

// Event names as constants for type safety
export const ANALYTICS_EVENTS = {
  // System events
  API_ENDPOINT_CALLED: 'api_endpoint_called',
  ERROR_OCCURRED: 'error_occurred',
  PERFORMANCE_METRIC: 'performance_metric',
  
  // User actions (server-side)
  GOAL_COMPLETED: 'goal_completed',
  HABIT_COMPLETED: 'habit_completed',
  JOURNAL_ENTRY_CREATED: 'journal_entry_created',
  PROGRESS_SNAPSHOT_CREATED: 'progress_snapshot_created',
  
  // AI events (if needed)
  INSIGHT_GENERATED: 'insight_generated',
  SUGGESTION_CREATED: 'suggestion_created',
} as const;

class BackendAnalyticsService {
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    const apiKey = process.env.AMPLITUDE_API_KEY;
    if (!apiKey) {
      console.warn('Amplitude API key not found. Backend analytics will be disabled.');
      return;
    }

    init(apiKey, {
      serverUrl: 'https://api2.amplitude.com/2/httpapi',
    });

    this.isInitialized = true;
    console.log('Backend analytics service initialized');
  }

  // Set user ID and properties
  setUser(userId: string, properties?: UserProperties) {
    if (!this.isInitialized) return;
    
    try {
      setUserId(userId);
      
      if (properties) {
        // Use modern identify method with Identify object
        const identifyObj = new Identify();
        
        // Set each property using the identify object
        Object.entries(properties).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            identifyObj.set(key, value);
          }
        });
        
        // Send the identify event
        identify(identifyObj);
      }
    } catch (error) {
      console.error('Failed to set user in analytics:', error);
    }
  }

  // Track events
  trackEvent(eventName: string, properties?: BaseEventProperties) {
    if (!this.isInitialized) {
      console.log('Backend analytics not initialized, skipping event:', eventName);
      return;
    }

    try {
      track(eventName, {
        ...properties,
        timestamp: new Date().toISOString(),
        source: 'backend',
      });
    } catch (error) {
      console.error('Failed to track backend event:', eventName, error);
    }
  }

  // Convenience methods for common events
  trackApiEndpoint(endpoint: string, method: string, statusCode: number, responseTime?: number) {
    this.trackEvent(ANALYTICS_EVENTS.API_ENDPOINT_CALLED, {
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTime,
    });
  }

  trackError(error: string, context?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.ERROR_OCCURRED, {
      error_message: error,
      ...context,
    });
  }

  trackGoalCompleted(goalId: string, userId: string, properties?: BaseEventProperties) {
    this.setUser(userId);
    this.trackEvent(ANALYTICS_EVENTS.GOAL_COMPLETED, {
      goal_id: goalId,
      user_id: userId,
      ...properties,
    });
  }

  trackHabitCompleted(habitId: string, userId: string, properties?: BaseEventProperties) {
    this.setUser(userId);
    this.trackEvent(ANALYTICS_EVENTS.HABIT_COMPLETED, {
      habit_id: habitId,
      user_id: userId,
      ...properties,
    });
  }

  trackJournalEntryCreated(journalId: string, userId: string, properties?: BaseEventProperties) {
    this.setUser(userId);
    this.trackEvent(ANALYTICS_EVENTS.JOURNAL_ENTRY_CREATED, {
      journal_id: journalId,
      user_id: userId,
      ...properties,
    });
  }

  trackProgressSnapshotCreated(userId: string, metricName: string, properties?: BaseEventProperties) {
    this.setUser(userId);
    this.trackEvent(ANALYTICS_EVENTS.PROGRESS_SNAPSHOT_CREATED, {
      metric_name: metricName,
      user_id: userId,
      ...properties,
    });
  }

  trackInsightGenerated(insightId: string, userId: string, properties?: BaseEventProperties) {
    this.setUser(userId);
    this.trackEvent(ANALYTICS_EVENTS.INSIGHT_GENERATED, {
      insight_id: insightId,
      user_id: userId,
      ...properties,
    });
  }
}

// Export singleton instance
export const backendAnalytics = new BackendAnalyticsService();
export default backendAnalytics;
