// Centralized analytics service for Amplitude (CDN version)
// Uses global window.amplitude from CDN

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
  // User lifecycle
  USER_SIGNED_UP: 'user_signed_up',
  USER_LOGGED_IN: 'user_logged_in',
  USER_LOGGED_OUT: 'user_logged_out',
  
  // Page navigation
  PAGE_VIEWED: 'page_viewed',
  
  // Goals
  GOAL_CREATED: 'goal_created',
  GOAL_COMPLETED: 'goal_completed',
  GOAL_ARCHIVED: 'goal_archived',
  GOAL_EDITED: 'goal_edited',
  GOAL_DELETED: 'goal_deleted',
  
  // Habits
  HABIT_CREATED: 'habit_created',
  HABIT_COMPLETED: 'habit_completed',
  HABIT_EDITED: 'habit_edited',
  HABIT_DELETED: 'habit_deleted',
  
  // Journals
  JOURNAL_ENTRY_CREATED: 'journal_entry_created',
  JOURNAL_ENTRY_EDITED: 'journal_entry_edited',
  JOURNAL_ENTRY_DELETED: 'journal_entry_deleted',
  
  // Insights
  INSIGHT_VIEWED: 'insight_viewed',
  INSIGHT_UPVOTED: 'insight_upvoted',
  INSIGHT_DOWNVOTED: 'insight_downvoted',
  INSIGHT_DISMISSED: 'insight_dismissed',
  
  // Life metrics
  LIFE_METRIC_CLICKED: 'life_metric_clicked',
  DETAILED_VIEW_OPENED: 'detailed_view_opened',
  DETAILED_VIEW_CLOSED: 'detailed_view_closed',
  
  // Feature usage
  HABIT_MODAL_OPENED: 'habit_modal_opened',
  HABIT_MODAL_CLOSED: 'habit_modal_clOSED',
  GOAL_MODAL_OPENED: 'goal_modal_opened',
  GOAL_MODAL_CLOSED: 'goal_modal_closed',
  
  // Errors
  ERROR_OCCURRED: 'error_occurred',
} as const;

// Declare global amplitude types for Browser SDK 2.0+
declare global {
  interface Window {
    amplitude: {
      track: (eventName: string, properties?: any) => void;
      identify: (identify: any) => void;
      setUserId: (userId: string) => void;
      init: (apiKey: string, options?: any) => void;
      add: (plugin: any) => void;
      Identify: new () => {
        set: (property: string, value: any) => any;
        setOnce: (property: string, value: any) => any;
        append: (property: string, value: any) => any;
        prepend: (property: string, value: any) => any;
        unset: (property: string) => any;
        add: (property: string, value: number) => any;
      };
    };
    sessionReplay: {
      plugin: (options: any) => any;
    };
  }
}

class AnalyticsService {
  private isInitialized = false;
  private userId: string | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;
    
    // Wait for Amplitude to load from CDN
    const checkAmplitude = () => {
      if (window.amplitude) {
        this.isInitialized = true;
        console.log('Analytics service initialized with CDN');
      } else {
        // Retry after 100ms if not loaded yet
        setTimeout(checkAmplitude, 100);
      }
    };
    
    checkAmplitude();
  }

  // Set user ID and properties
  setUser(userId: string, properties?: UserProperties) {
    if (!this.isInitialized) return;
    
    this.userId = userId;
    window.amplitude.setUserId(userId);
    
    if (properties) {
      // Use Amplitude 2.0+ identify method with Identify object
      const identify = new window.amplitude.Identify();
      
      // Set each property using the identify object
      Object.entries(properties).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          identify.set(key, value);
        }
      });
      
      // Send the identify event
      window.amplitude.identify(identify);
    }
  }

  // Clear user data
  clearUser() {
    if (!this.isInitialized) return;
    
    this.userId = null;
    window.amplitude.setUserId(null);
    
    // Clear user properties using identify
    const identify = new window.amplitude.Identify();
    // Clear common user properties
    identify.unset('email');
    identify.unset('timezone');
    identify.unset('createdAt');
    identify.unset('totalGoals');
    identify.unset('totalHabits');
    identify.unset('totalJournals');
    
    window.amplitude.identify(identify);
  }

  // Track events
  trackEvent(eventName: string, properties?: BaseEventProperties) {
    if (!this.isInitialized) {
      console.log('Analytics not initialized, skipping event:', eventName);
      return;
    }

    try {
      window.amplitude.track(eventName, {
        ...properties,
        timestamp: new Date().toISOString(),
        userId: this.userId,
      });
    } catch (error) {
      console.error('Failed to track event:', eventName, error);
    }
  }

  // Convenience methods for common events
  trackPageView(pageName: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.PAGE_VIEWED, {
      page_name: pageName,
      ...properties,
    });
  }

  trackUserSignup(properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.USER_SIGNED_UP, properties);
  }

  trackUserLogin(properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.USER_LOGGED_IN, properties);
  }

  trackUserLogout() {
    this.trackEvent(ANALYTICS_EVENTS.USER_LOGGED_OUT);
  }

  trackGoalCreated(goalId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.GOAL_CREATED, {
      goal_id: goalId,
      ...properties,
    });
  }

  trackGoalCompleted(goalId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.GOAL_COMPLETED, {
      goal_id: goalId,
      ...properties,
    });
  }

  trackHabitCreated(habitId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.HABIT_CREATED, {
      habit_id: habitId,
      ...properties,
    });
  }

  trackHabitCompleted(habitId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.HABIT_COMPLETED, {
      habit_id: habitId,
      ...properties,
    });
  }

  trackJournalEntryCreated(journalId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.JOURNAL_ENTRY_CREATED, {
      journal_id: journalId,
      ...properties,
    });
  }

  trackInsightViewed(insightId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.INSIGHT_VIEWED, {
      insight_id: insightId,
      ...properties,
    });
  }

  trackInsightUpvoted(insightId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.INSIGHT_UPVOTED, {
      insight_id: insightId,
      ...properties,
    });
  }

  trackInsightDownvoted(insightId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.INSIGHT_DOWNVOTED, {
      insight_id: insightId,
      ...properties,
    });
  }

  trackLifeMetricClicked(metricName: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.LIFE_METRIC_CLICKED, {
      metric_name: metricName,
      ...properties,
    });
  }

  trackDetailedViewOpened(metricName: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.DETAILED_VIEW_OPENED, {
      metric_name: metricName,
      ...properties,
    });
  }

  trackError(error: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.ERROR_OCCURRED, {
      error_message: error,
      ...properties,
    });
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();
export default analytics;
