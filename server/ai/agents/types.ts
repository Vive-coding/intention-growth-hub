export type AgentType =
  | 'master'
  | 'review_progress'
  | 'suggest_goals'
  | 'prioritize_optimize'
  | 'surprise_me'
  | 'onboarding_welcome';

export interface AgentContext {
  userId: string;
  threadId: string;
  userMessage: string;
  recentMessages: Array<{ role: string; content: string }>;
  profile: any;
  workingSet: any;
  threadSummary: string | null;
  onboardingProfile?: any;
}

export interface AgentResponse {
  finalText: string;
  agentType?: AgentType;
  structuredData?: any;
  cta?: string;
}

export interface GoalSuggestionData {
  type: 'goal_suggestion';
  goal: {
    id?: string;
    title: string;
    description?: string;
    category?: string;
    priority?: string;
  };
  habits: Array<{
    id?: string;
    title: string;
    description?: string;
    frequency?: string;
    effortMinutes?: number;
    impact?: 'high' | 'medium' | 'low';
  }>;
}

export interface HabitReviewData {
  type: 'habit_review';
  habits: Array<{
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    streak: number;
    points: number;
  }>;
}

export interface OptimizationData {
  type: 'optimization';
  summary: string;
  recommendations: Array<{
    type: 'archive' | 'modify' | 'add';
    habitId?: string;
    title: string;
    description: string;
  }>;
}

export interface InsightData {
  type: 'insight';
  title: string;
  explanation: string;
  confidence: number;
  lifeMetricIds: string[];
}
