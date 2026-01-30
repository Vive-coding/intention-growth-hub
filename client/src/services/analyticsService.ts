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
  totalChatThreads?: number;
  totalChatMessages?: number;
  longestHabitStreak?: number;
  currentHabitStreak?: number;
  goalsCompletedCount?: number;
  activeGoalsCount?: number;
  lastActiveDate?: string;
  daysSinceSignup?: number;
  daysSinceLastActive?: number;
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: string;
  onboardingStep?: string;
  firstGoalCreatedAt?: string;
  firstHabitLoggedAt?: string;
  firstGoalCompletedAt?: string;
  turnsToFirstGoal?: number;
  turnsToFirstHabit?: number;
  turnsToFirstGoalCompletion?: number;
  userSegment?: string;
  cohortMonth?: string;
  lifeMetricsFocus?: string[];
  coachingStyle?: string[];
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
  
  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_VIEWED: 'onboarding_step_viewed',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_STEP_ABANDONED: 'onboarding_step_abandoned',
  ONBOARDING_PROFILE_SAVED: 'onboarding_profile_saved',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  FIRST_CHAT_SESSION_STARTED: 'first_chat_session_started',
  FIRST_GOAL_CREATED: 'first_goal_created',
  FIRST_HABIT_LOGGED: 'first_habit_logged',
  FIRST_GOAL_COMPLETED: 'first_goal_completed',
  
  // Page navigation
  PAGE_VIEWED: 'page_viewed',
  
  // Chat/Conversation
  CHAT_THREAD_CREATED: 'chat_thread_created',
  CHAT_MESSAGE_SENT: 'chat_message_sent',
  CHAT_MESSAGE_RECEIVED: 'chat_message_received',
  CHAT_TOOL_USED: 'chat_tool_used',
  
  // Goals
  GOAL_CREATED: 'goal_created',
  GOAL_COMPLETED: 'goal_completed',
  GOAL_ARCHIVED: 'goal_archived',
  GOAL_EDITED: 'goal_edited',
  GOAL_DELETED: 'goal_deleted',
  GOAL_SUGGESTED: 'goal_suggested',
  GOAL_SUGGESTION_ACCEPTED: 'goal_suggestion_accepted',
  GOAL_SUGGESTION_REJECTED: 'goal_suggestion_rejected',
  
  // Habits
  HABIT_CREATED: 'habit_created',
  HABIT_COMPLETED: 'habit_completed',
  HABIT_EDITED: 'habit_edited',
  HABIT_DELETED: 'habit_deleted',
  HABIT_SUGGESTED: 'habit_suggested',
  HABIT_SUGGESTION_ACCEPTED: 'habit_suggestion_accepted',
  HABIT_STREAK_MILESTONE: 'habit_streak_milestone',
  
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
      setUserId: (userId: string | null) => void;
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

    // Disable analytics on localhost to avoid noisy CORS / replay errors during dev.
    // (Also makes it much easier to see our own debug logs.)
    const host = window.location?.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return;
    }
    
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

  // Onboarding events
  trackOnboardingStarted(properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.ONBOARDING_STARTED, properties);
  }

  trackOnboardingStepViewed(stepKey: string, stepNumber: number, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.ONBOARDING_STEP_VIEWED, {
      step_key: stepKey,
      step_number: stepNumber,
      ...properties,
    });
  }

  trackOnboardingStepCompleted(stepKey: string, stepNumber: number, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETED, {
      step_key: stepKey,
      step_number: stepNumber,
      ...properties,
    });
  }

  trackOnboardingStepAbandoned(stepKey: string, stepNumber: number, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.ONBOARDING_STEP_ABANDONED, {
      step_key: stepKey,
      step_number: stepNumber,
      ...properties,
    });
  }

  trackOnboardingProfileSaved(properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.ONBOARDING_PROFILE_SAVED, properties);
  }

  trackOnboardingCompleted(properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, properties);
  }

  trackFirstChatSessionStarted(threadId: string, isWelcome: boolean, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.FIRST_CHAT_SESSION_STARTED, {
      thread_id: threadId,
      is_welcome: isWelcome,
      ...properties,
    });
  }

  trackFirstGoalCreated(goalId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.FIRST_GOAL_CREATED, {
      goal_id: goalId,
      ...properties,
    });
  }

  trackFirstHabitLogged(habitId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.FIRST_HABIT_LOGGED, {
      habit_id: habitId,
      ...properties,
    });
  }

  trackFirstGoalCompleted(goalId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.FIRST_GOAL_COMPLETED, {
      goal_id: goalId,
      ...properties,
    });
  }

  // Chat events
  trackChatThreadCreated(threadId: string, isWelcome: boolean, isTest: boolean, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.CHAT_THREAD_CREATED, {
      thread_id: threadId,
      is_welcome: isWelcome,
      is_test: isTest,
      ...properties,
    });
  }

  trackChatMessageSent(threadId: string, messageLength: number, turnNumber: number, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.CHAT_MESSAGE_SENT, {
      thread_id: threadId,
      message_length: messageLength,
      turn_number: turnNumber,
      ...properties,
    });
  }

  trackChatMessageReceived(threadId: string, responseTimeMs: number, hasToolCalls: boolean, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.CHAT_MESSAGE_RECEIVED, {
      thread_id: threadId,
      response_time_ms: responseTimeMs,
      has_tool_calls: hasToolCalls,
      ...properties,
    });
  }

  trackChatToolUsed(toolName: string, threadId: string, success: boolean, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.CHAT_TOOL_USED, {
      tool_name: toolName,
      thread_id: threadId,
      success,
      ...properties,
    });
  }

  // Enhanced goal events
  trackGoalSuggested(goalId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.GOAL_SUGGESTED, {
      goal_id: goalId,
      ...properties,
    });
  }

  trackGoalSuggestionAccepted(goalId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.GOAL_SUGGESTION_ACCEPTED, {
      goal_id: goalId,
      ...properties,
    });
  }

  trackGoalSuggestionRejected(goalId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.GOAL_SUGGESTION_REJECTED, {
      goal_id: goalId,
      ...properties,
    });
  }

  // Enhanced habit events
  trackHabitSuggested(habitId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.HABIT_SUGGESTED, {
      habit_id: habitId,
      ...properties,
    });
  }

  trackHabitSuggestionAccepted(habitId: string, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.HABIT_SUGGESTION_ACCEPTED, {
      habit_id: habitId,
      ...properties,
    });
  }

  trackHabitStreakMilestone(habitId: string, streakDays: number, properties?: BaseEventProperties) {
    this.trackEvent(ANALYTICS_EVENTS.HABIT_STREAK_MILESTONE, {
      habit_id: habitId,
      streak_days: streakDays,
      ...properties,
    });
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();
export default analytics;
