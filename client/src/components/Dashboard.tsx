import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { MessageCircle, Smile, TrendingUp, Star, Trophy, Target, Plus, CheckCircle, ThumbsUp, ThumbsDown, BookOpen, Flame, X, MoreVertical, ExternalLink, Lightbulb, Bot, ChevronDown } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ChatGPTLogo } from "@/components/ui/chatgpt-icon";
import { LifeMetricsDashboard } from "./LifeMetricsDashboard";
import { InsightCard } from "./insights/InsightCard";
import { DetailedLifeOverview } from "./DetailedLifeOverview";
import { AuthModal } from "./AuthModal";
import { AddHabitModal } from "./AddHabitModal";
import { CreateGoalWizard } from "./CreateGoalWizard";
import { UnifiedHabitManager } from "./UnifiedHabitManager";
import { ReinforcementBadge } from "@/components/ui/ReinforcementBadge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { insightsService } from "@/services/insightsService";
import { toast } from "@/components/ui/sonner";
import { analytics } from "@/services/analyticsService";
import { HabitsSidePanel } from "@/components/chat/HabitsSidePanel";

// Custom pill color mapping for unique, meaningful colors
const getPillBackgroundColor = (metricName: string) => {
  if (metricName.includes('Health & Fitness')) return '#dcfce7'; // Light green
  if (metricName.includes('Career Growth')) return '#dbeafe'; // Light blue
  if (metricName.includes('Personal Development')) return '#f3e8ff'; // Light purple
  if (metricName.includes('Relationships')) return '#fed7aa'; // Light orange
  if (metricName.includes('Finance')) return '#fecaca'; // Light red
  if (metricName.includes('Mental Health')) return '#ccfbf1'; // Light teal
  return '#f3f4f6'; // Default light gray
};

const getPillTextColor = (metricName: string) => {
  if (metricName.includes('Health & Fitness')) return '#166534'; // Dark green
  if (metricName.includes('Career Growth')) return '#1e40af'; // Dark blue
  if (metricName.includes('Personal Development')) return '#7c3aed'; // Dark purple
  if (metricName.includes('Relationships')) return '#ea580c'; // Dark orange
  if (metricName.includes('Finance')) return '#dc2626'; // Dark red
  if (metricName.includes('Mental Health')) return '#0f766e'; // Dark teal
  return '#6b7280'; // Default dark gray
};

interface DashboardProps {
  onOpenGPT: () => void;
  onDetailedViewChange?: (isInDetailedView: boolean) => void;
  onClearDetailedView?: () => void;
}

export const Dashboard = ({ onOpenGPT, onDetailedViewChange, onClearDetailedView }: DashboardProps) => {
    const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  const [showHabitModal, setShowHabitModal] = useState(false);

  // Wrapper function to track detailed view opening
  const handleMetricClick = (metricName: string) => {
    analytics.trackDetailedViewOpened(metricName, {
      period: selectedPeriod,
      timestamp: new Date().toISOString(),
    });
    setSelectedMetric(metricName);
  };
 
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [journalContent, setJournalContent] = useState("");
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [prefillGoal, setPrefillGoal] = useState<any>(null);
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [prefillHabit, setPrefillHabit] = useState<any>(null);
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);
  const [showGoalWizard, setShowGoalWizard] = useState(false);
  const [selectedSuggestedGoal, setSelectedSuggestedGoal] = useState<any>(null);
  const [isCompletingSelected, setIsCompletingSelected] = useState(false);
  const { 
    user, 
    isLoading, 
    isAuthenticated, 
    shouldShowAuthButton
  } = useAuth();
  const [, setLocation] = useLocation();
  const typedUser = user as UserType | undefined;
  const queryClient = useQueryClient();
  const [showHabitsPanel, setShowHabitsPanel] = useState(false);
  
  const currentTime = new Date().getHours();
  const greeting = currentTime < 12 ? "Good morning" : currentTime < 18 ? "Good afternoon" : "Good evening";
  const userName = typedUser?.firstName || 
                  (typedUser?.email?.split('@')[0]) || "there";

  // Expose a global helper so the shared header habit pill can open this slideout
  useEffect(() => {
    (window as any).openHabitsPanel = () => setShowHabitsPanel(true);
    return () => {
      if ((window as any).openHabitsPanel) {
        (window as any).openHabitsPanel = undefined;
      }
    };
  }, []);

  // Save journal entry
  const handleSaveJournal = async () => {
    if (!journalContent.trim()) {
      alert('Please enter some content before saving.');
      return;
    }

    setIsSavingJournal(true);
    try {
      const response = await apiRequest('/api/journals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Journal Entry - ${new Date().toLocaleDateString()}`,
          content: journalContent,
          // Let the server detect mood automatically
          tags: [],
        }),
      });

      if (response) {
        // Track journal creation
        analytics.trackJournalEntryCreated(response.id, {
          content_length: journalContent.length,
          has_goals: prefillGoal !== null,
          has_habits: prefillHabit !== null,
        });
        
        setJournalContent('');
        toast.success('Journal saved');
        const t = toast.loading('Analyzing your entry to generate insights...');
        // Clear saving state immediately to avoid UI being stuck
        setIsSavingJournal(false);
        // Fire-and-forget: trigger agent and invalidate caches without blocking UI
        (async () => {
          try {
            await apiRequest('/api/insights/trigger-latest', { method: 'POST' });
          } catch (error) {
            console.error('Error triggering AI agent:', error);
          }
          try {
            // Poll for new content up to ~20s or until we see changes
            const start = Date.now();
            let updated = false;
            while (Date.now() - start < 20000) {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['/api/insights'] }),
                queryClient.invalidateQueries({ queryKey: ['/api/goals'] }),
                queryClient.invalidateQueries({ queryKey: ['/api/goals/habits/today'] }),
              ]);
              // Slight delay between polls
              await new Promise(r => setTimeout(r, 1200));
              // Basic heuristic: if insights list increased, mark updated
              // (We rely on SWR cache invalidation to refresh UI; toast still used for feedback.)
              updated = true; // we don't have previous count here, so show completion regardless
              if (updated) break;
            }
            toast.dismiss(t);
            if (updated) {
              toast.success('New insights added');
              // Show reinforcement summary toast (persistent until dismissed)
              try {
                const [goalResp, habitResp] = await Promise.all([
                  apiRequest('/api/goals/suggested', { method: 'GET' }),
                  apiRequest('/api/goals/habits/suggested', { method: 'GET' }),
                ]);
                const reinforcedGoals = (goalResp || []).filter((g: any) => g.kind === 'reinforce' && (g.relatedTitle || g.title));
                const reinforcedHabits = (habitResp || []).filter((h: any) => h.kind === 'reinforce' && (h.relatedTitle || h.title));
                const lines: string[] = [];
                for (const g of reinforcedGoals.slice(0, 3)) {
                  lines.push(`Goal: ${g.relatedTitle || g.title}`);
                }
                for (const h of reinforcedHabits.slice(0, 3)) {
                  lines.push(`Habit: ${h.relatedTitle || h.title}`);
                }
                const remaining = Math.max(0, (reinforcedGoals.length + reinforcedHabits.length) - lines.length);
                const description = lines.length > 0
                  ? `${lines.join(' \n')}${remaining > 0 ? `\n…and ${remaining} more` : ''}`
                  : '';
                if (description) {
                  toast.message("You're already addressing this", {
                    description,
                    duration: 0,
                  });
                }
              } catch (e) {
                console.warn('Reinforcement toast fetch failed', e);
              }
              // Reload to reflect fresh data everywhere
              window.location.reload();
            } else {
              toast.message('Still analyzing…');
            }
          } catch (e) {
            console.error('Polling error:', e);
            toast.dismiss(t);
          }
        })();
      }
    } catch (error) {
      console.error('Error saving journal:', error);
      setIsSavingJournal(false);
      toast.error('Failed to save journal');
    }
  };

  // Fetch recent insights
  const { data: insights = [], isLoading: insightsLoading, error: insightsError } = useQuery({
    queryKey: ['/api/insights'],
    queryFn: async () => {
      const response = await apiRequest('/api/insights', {
        method: 'GET',
      });
      return response;
    },
    retry: 1,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // Fetch feedback status for insights
  const { data: feedbackStatus = { voted: {}, lastAction: {} } } = useQuery({
    queryKey: ['/api/feedback/status', insights],
    queryFn: async () => {
      if (!insights || insights.length === 0) {
        return { voted: {}, lastAction: {} };
      }
      const ids = insights.map((i: any) => i.id).join(',');
      const response = await apiRequest(`/api/feedback/status?type=insight&ids=${ids}`);
      return response;
    },
    enabled: isAuthenticated && insights.length > 0,
  });

  // Fetch goals
  const { data: goals = [], isLoading: goalsLoading, error: goalsError } = useQuery({
    queryKey: ['/api/goals'],
    queryFn: async () => {
      const response = await apiRequest('/api/goals', {
        method: 'GET',
      });
      return response;
    },
    retry: 1,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // Fetch habits for today's completion modal (active goals only, not done today)
  const { data: todaysHabits = [], isLoading: habitsLoading, error: habitsError } = useQuery({
    queryKey: ['/api/goals/habits/today'],
    queryFn: async () => {
      const response = await apiRequest('/api/goals/habits/today', {
        method: 'GET',
      });
      return response;
    },
    retry: 1,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // Fetch completed habits for today
  const { data: completedHabits = [], isLoading: completedHabitsLoading, error: completedHabitsError } = useQuery({
    queryKey: ['/api/goals/habits/completed-today'],
    queryFn: async () => {
      console.log('🟣 Fetching completed habits...');
      const response = await apiRequest('/api/goals/habits/completed-today', {
        method: 'GET',
      });
      console.log('🟣 Completed habits response:', response);
      console.log('🟣 Completed habits count:', response?.length || 0);
      return response;
    },
    retry: 1,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // Fetch today's habit completion summary for header pill
  const { data: todayCompletions } = useQuery({
    queryKey: ["/api/habits/today-completions"],
    queryFn: async () => {
      try {
        const resp = await apiRequest("/api/habits/today-completions");
        return resp || { completed: 0, total: 0 };
      } catch {
        return { completed: 0, total: 0 };
      }
    },
    staleTime: 0,
    refetchInterval: 10_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !isLoading && isAuthenticated,
  });

  // Debug logging for habit data
  useEffect(() => {
    console.log('Dashboard habit data:', {
      todaysHabits: todaysHabits.length,
      completedHabits: completedHabits.length,
      completedHabitsLoading,
      completedHabitsError: completedHabitsError?.message,
      selectedHabitIds
    });
  }, [todaysHabits, completedHabits, completedHabitsLoading, completedHabitsError, selectedHabitIds]);

  // Debug logging for goals data
  useEffect(() => {
    console.log('Dashboard goals data:', {
      goalsCount: goals.length,
      goalsStructure: goals.map((g: any) => ({ 
        id: g.id, 
        goalInstanceId: g.goalInstance?.id, 
        status: g.status,
        title: g.title || g.goalDefinition?.title
      }))
    });
  }, [goals]);

  const toggleHabitSelection = (habitId: string) => {
    console.log('Dashboard: toggleHabitSelection called for:', habitId, 'current selectedHabitIds:', selectedHabitIds);
    setSelectedHabitIds((prev) => {
      const newSelection = prev.includes(habitId) ? prev.filter((id) => id !== habitId) : [...prev, habitId];
      console.log('Dashboard: new selection:', newSelection);
      return newSelection;
    });
  };

  const handleCompleteSelected = async () => {
    if (selectedHabitIds.length === 0) return;
    setIsCompletingSelected(true);
    try {
      const selectedHabits = todaysHabits.filter((h: any) => selectedHabitIds.includes(h.id));
      console.log('Completing habits:', selectedHabits.map((habit: any) => habit.name));
      
      // Call once per habit. Backend already fans-out progress updates to all associated goals.
      const results = await Promise.allSettled(selectedHabits.map(async (habit: any) => {
        // Send the first goalId to help backend update specific goal progress
        const goalId = habit.goalId || (habit.goalIds && habit.goalIds[0]);
        const result = await apiRequest(`/api/goals/habits/${habit.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goalId }),
        });
        console.log(`Habit ${habit.name} completion result:`, result);
        return { habit, result };
      }));
      
      // Process results and handle errors
      const successfulCompletions: any[] = [];
      const alreadyCompleted: any[] = [];
      const errors: any[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulCompletions.push(result.value);
        } else {
          const error = result.reason;
          const habit = selectedHabits[index];
          console.error(`Habit ${habit.name} completion failed:`, error);
          
          // Check if it's a duplicate completion error
          if (error.message && error.message.includes('already completed')) {
            alreadyCompleted.push(habit);
          } else {
            errors.push({ habit, error });
          }
        }
      });
      
      console.log('Completion results:', { successfulCompletions, alreadyCompleted, errors });
      
      // Clear selected habits
      setSelectedHabitIds([]);
      
      // Show appropriate messages
      if (successfulCompletions.length > 0) {
        toast.success(`Successfully completed ${successfulCompletions.length} habit${successfulCompletions.length > 1 ? 's' : ''}`);
      }
      
      if (alreadyCompleted.length > 0) {
        toast.message(`Already completed today: ${alreadyCompleted.map(h => h.name).join(', ')}`);
      }
      
      if (errors.length > 0) {
        toast.error(`Failed to complete: ${errors.map(e => e.habit.name).join(', ')}`);
      }
      
      // Immediately update local state to show completion
      console.log('🟣 Habit completion processed, updating UI...');
      
      // Add a small delay to ensure database updates have completed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh today + completed counts so the right panel numbers update immediately
      console.log('🟣 Invalidating habit queries...');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/goals/habits/today'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/goals/habits/completed-today'] }),
      ]);
      
      // Force an immediate refetch to avoid intermediary 304s
      console.log('🟣 Refetching completed habits...');
      const refetchResult = await queryClient.refetchQueries({ queryKey: ['/api/goals/habits/completed-today'], type: 'active' });
      console.log('🟣 Refetch result:', refetchResult);
      
      // Also refetch today's habits to remove completed ones
      console.log('🟣 Refetching today\'s habits...');
      const todayRefetchResult = await queryClient.refetchQueries({ queryKey: ['/api/goals/habits/today'], type: 'active' });
      console.log('🟣 Today habits refetch result:', todayRefetchResult);
      
      // Also refresh the specific goal data to show updated progress
      await queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      
      // Proactively upsert today's snapshots for all metrics so charts match ring values immediately
      try {
        await apiRequest('/api/admin/snapshots/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        await queryClient.invalidateQueries({ queryKey: ['/api/life-metrics/progress'] });
        await queryClient.invalidateQueries({ queryKey: ['metric-progress'] });
      } catch (e) {
        console.warn('Snapshot upsert after completion failed (non-fatal)', e);
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/life-metrics/progress'] });
      await queryClient.invalidateQueries({ queryKey: ['metric-progress'] });
      
      // Refresh smart suggestions based on new state
      try { 
        await refetchSmartSuggestions(); 
      } catch {}
      
      setShowHabitModal(false);
    } catch (error) {
      console.error('Error completing selected habits:', error);
      toast.error('Failed to complete habits. Please try again.');
    } finally {
      setIsCompletingSelected(false);
    }
  };

  // Fetch suggested goals
  const { data: suggestedGoals = [], isLoading: suggestedGoalsLoading, error: suggestedGoalsError } = useQuery({
    queryKey: ['/api/goals/suggested'],
    queryFn: async () => {
      const response = await apiRequest(`/api/goals/suggested?nocache=${Date.now()}`, {
        method: 'GET',
      });
      return response;
    },
    retry: 1,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // Fetch suggested habits
  const { data: suggestedHabits = [], isLoading: suggestedHabitsLoading, error: suggestedHabitsError } = useQuery({
    queryKey: ['/api/goals/habits/suggested'],
    queryFn: async () => {
      const response = await apiRequest(`/api/goals/habits/suggested?nocache=${Date.now()}`, {
        method: 'GET',
      });
      return response;
    },
    retry: 1,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // Fetch feedback status for suggested habits
  const { data: habitFeedbackStatus = { voted: {}, lastAction: {} } } = useQuery({
    queryKey: ['/api/feedback/status', suggestedHabits],
    queryFn: async () => {
      if (!suggestedHabits || suggestedHabits.length === 0) {
        console.log('🟣 No suggested habits, returning empty feedback status');
        return { voted: {}, lastAction: {} };
      }
      const ids = suggestedHabits.map((h: any) => h.id).join(',');
      console.log('🟣 Fetching feedback status for suggested habits:', ids);
      const response = await apiRequest(`/api/feedback/status?type=suggested_habit&ids=${ids}`);
      console.log('🟣 Feedback status response:', response);
      return response;
    },
    enabled: isAuthenticated && suggestedHabits.length > 0,
  });

  // Fetch feedback status for suggested goals
  const { data: goalFeedbackStatus = { voted: {}, lastAction: {} } } = useQuery({
    queryKey: ['/api/feedback/status', suggestedGoals],
    queryFn: async () => {
      if (!suggestedGoals || suggestedGoals.length === 0) {
        return { voted: {}, lastAction: {} };
      }
      const ids = suggestedGoals.map((g: any) => g.id).join(',');
      const response = await apiRequest(`/api/feedback/status?type=suggested_goal&ids=${ids}`);
      return response;
    },
    enabled: isAuthenticated && suggestedGoals.length > 0,
  });

  // Get recent insights (last 3) with local dismissal - insights dismiss after voting on homepage
  const [dismissedInsightIds, setDismissedInsightIds] = useState<string[]>(() => {
    // Load dismissed insights from localStorage on component mount
    const saved = localStorage.getItem('dashboard_dismissed_insights');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Function to dismiss insight and persist to localStorage
  const dismissInsight = (insightId: string) => {
    setDismissedInsightIds((prev) => {
      const newDismissed = Array.from(new Set([...prev, insightId]));
      localStorage.setItem('dashboard_dismissed_insights', JSON.stringify(newDismissed));
      return newDismissed;
    });
  };
  
  const recentInsights = insights
    .filter((i:any)=> !dismissedInsightIds.includes(i.id)) // Local dismissal
    .filter((i:any)=> !feedbackStatus?.voted?.[i.id]) // Also hide if already voted previously (persistent)
    .slice(0, 3);

  // Note: Insights dismiss from homepage after voting to keep it clean
  // Vote state persists on the insights detail page

  // Get suggested goals/habits (last 3) and whether there are any items/new items
  const recentSuggestedGoals = suggestedGoals.slice(0, 3);
  const recentSuggestedHabits = suggestedHabits.slice(0, 3);
  const hasNewSuggestions = (suggestedGoals || []).some((g: any) => g?.kind !== 'existing') || (suggestedHabits || []).some((h: any) => h?.kind !== 'existing');
  const hasAnySuggestions = (recentSuggestedGoals.length > 0) || (recentSuggestedHabits.length > 0);

  // Debug logging
  console.log('Dashboard data:', {
    insights: insights.length,
    goals: goals.length,
    todaysHabits: todaysHabits.length,
    suggestedGoals: suggestedGoals.length,
    suggestedHabits: suggestedHabits.length,
    recentInsights: recentInsights.length,
    recentSuggestedGoals: recentSuggestedGoals.length,
    recentSuggestedHabits: recentSuggestedHabits.length
  });

  // Feedback dialog state for suggested goal/habit dismissals
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<{ kind: 'suggested_goal' | 'suggested_habit'; id: string } | null>(null);
  const [feedbackReasons, setFeedbackReasons] = useState<string[]>([]);
  const [feedbackNotes, setFeedbackNotes] = useState<string>("");
  const FEEDBACK_REASON_OPTIONS: string[] = [
    'Not relevant',
    'Too generic',
    'Poorly timed',
    'Already doing this',
    'Not achievable',
    'Conflicts with priorities'
  ];

  const toggleReason = (r: string) => {
    setFeedbackReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const sendDismissFeedback = async () => {
    if (!feedbackTarget) {
      setFeedbackOpen(false);
      return;
    }
    try {
      await apiRequest('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackTarget.kind,
          itemId: feedbackTarget.id,
          action: 'dismiss',
          context: { surface: 'dashboard_suggestions' },
        }),
      });
      // Optional detailed reasons
      if (feedbackReasons.length > 0 || feedbackNotes.trim()) {
        await apiRequest('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: feedbackTarget.kind,
            itemId: feedbackTarget.id,
            action: 'dismiss_reason',
            context: { surface: 'dashboard_suggestions', reasons: feedbackReasons, notes: feedbackNotes },
          }),
        });
      }
      // Also archive the dismissed entity so it won't return again
      try {
        if (feedbackTarget.kind === 'suggested_goal') {
          await insightsService.archiveGoal(feedbackTarget.id);
        } else {
          await insightsService.archiveHabit(feedbackTarget.id);
        }
      } catch {}
    } catch (e) {
      console.error('Failed sending dismiss feedback', e);
    } finally {
      setFeedbackOpen(false);
      setFeedbackReasons([]);
      setFeedbackNotes("");
      setFeedbackTarget(null);
      // Remove dismissed card by refreshing suggestions quickly
      try { await refetchSmartSuggestions(); } catch {}
      // Soft reload to update lists shown
      window.location.reload();
    }
  };

  // Get celebration items (habit streaks and goal completions)
  interface CelebrationItem {
    type: 'habit_streak' | 'goal_completion';
    title: string;
    description: string;
    icon: any;
    color: string;
  }
  
  const celebrationItems: CelebrationItem[] = [];
  
  // Add habit streaks (if streak data exists)
  (todaysHabits || []).forEach((habit: any) => {
    if (habit && typeof habit.currentStreak === 'number' && habit.currentStreak >= 3) {
      celebrationItems.push({
        type: 'habit_streak',
        title: `${habit.currentStreak}-day ${habit.title} streak!`,
        description: `Keep up the great work!`,
        icon: Star,
        color: 'purple'
      });
    }
  });

  // Add goal completions
  goals.forEach((goal: any) => {
    if (goal.progress >= 100) {
      celebrationItems.push({
        type: 'goal_completion',
        title: `Completed: ${goal.title}!`,
        description: `Congratulations on achieving your goal!`,
        icon: Trophy,
        color: 'green'
      });
    }
  });

  // Smart Suggestions: fetched from API on-demand
  const { data: smartSuggestions = [], refetch: refetchSmartSuggestions } = useQuery({
    queryKey: ['/api/smart-suggestions'],
    queryFn: async () => apiRequest('/api/smart-suggestions'),
    staleTime: 60_000, // do not auto-refresh on mount per product decision
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: isAuthenticated,
  });

  // Fetch reinforcement (already in progress) items
  const { data: reinforceGoals = [] } = useQuery({
    queryKey: ['/api/goals/suggested', 'reinforcements'],
    queryFn: async () => apiRequest('/api/goals/suggested?mode=reinforcements'),
    enabled: isAuthenticated,
    retry: 1,
  });
  const { data: reinforceHabits = [] } = useQuery({
    queryKey: ['/api/goals/habits/suggested', 'reinforcements'],
    queryFn: async () => apiRequest('/api/goals/habits/suggested?mode=reinforcements'),
    enabled: isAuthenticated,
    retry: 1,
  });
  const [dismissedReinforcements, setDismissedReinforcements] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_reinforcements') || '[]'); } catch { return []; }
  });
  const dismissReinforcement = (key: string) => {
    const next = Array.from(new Set([...dismissedReinforcements, key]));
    setDismissedReinforcements(next);
    localStorage.setItem('dismissed_reinforcements', JSON.stringify(next));
  };

  // If a metric is selected, show the detailed view
  if (selectedMetric) {
    // Notify parent that we're in detailed view
    console.log('Setting detailed view to true for metric:', selectedMetric);
    onDetailedViewChange?.(true);
    
    return (
      <DetailedLifeOverview 
        metric={selectedMetric} 
        onBack={() => {
          console.log('Back button clicked');
          setSelectedMetric(null);
          setPrefillGoal(null);
          onDetailedViewChange?.(false);
        }}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        onNavigateHome={() => {
          console.log('Home navigation clicked from detailed view');
          setSelectedMetric(null);
          setPrefillGoal(null);
          onDetailedViewChange?.(false);
        }}
        onClearDetailedView={() => {
          console.log('Dashboard: Clearing detailed view via external call');
          setSelectedMetric(null);
          setPrefillGoal(null);
          onDetailedViewChange?.(false);
        }}
        onNavigateToMetric={(newMetric) => {
          console.log('Navigating to metric:', newMetric);
          setSelectedMetric(newMetric);
        }}
        prefillGoal={prefillGoal}
      />
    );
  }

  return (
    <div className="p-4 lg:px-6 lg:py-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Header - centered above journal box on all screen sizes */}
        <div className="mb-4 lg:mb-6">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
              {greeting}, {userName}
            </h1>
            <p className="text-sm lg:text-base text-gray-600">
              Ready to reflect and grow today?
            </p>
          </div>
        </div>

        {/* Mobile Layout: Single Column */}
        <div className="lg:hidden space-y-6">
          {/* Journal Chat Box - Mobile (Primary Action) */}
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-2">
            {/* Chat-like input box with buttons inside */}
            <div className="bg-white rounded-xl p-1">
              <div className="text-left mb-1.5">
                <textarea 
                  className="w-full h-24 p-1 border-0 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 text-gray-700 placeholder-gray-400 min-h-[6rem]"
                  placeholder="What's on your mind today? Share your thoughts, feelings, or experiences..."
                  style={{ minHeight: '6rem' }}
                  value={journalContent}
                  onChange={(e) => setJournalContent(e.target.value)}
                />
              </div>
              
              {/* Action button inside the chat box - right aligned and smaller */}
              <div className="flex gap-2 justify-end">
                <Button 
                  className="bg-purple-600 text-white hover:bg-purple-700 py-1 px-3 rounded-full font-semibold text-xs shadow-md transition-all duration-200 hover:shadow-lg"
                  onClick={handleSaveJournal}
                  disabled={isSavingJournal}
                >
                  <BookOpen className="w-3 h-3 mr-1" />
                  {isSavingJournal ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Recent Insights - Mobile */}
          {insightsLoading ? (
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Recent Insights</h3>
                  <p className="text-xs text-gray-600">Help improve AI recommendations</p>
                </div>
              </div>
              <div className="text-center py-4 text-sm text-gray-600">Loading insights...</div>
            </div>
          ) : insightsError ? (
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Recent Insights</h3>
                  <p className="text-xs text-gray-600">Help improve AI recommendations</p>
                </div>
              </div>
              <div className="text-center py-6">
                <div className="text-gray-500 text-sm">No insights yet</div>
                <p className="text-xs text-gray-500 mt-1">Create a journal entry or chat with life coach to see suggestions.</p>
              </div>
            </div>
          ) : recentInsights.length > 0 ? (
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Recent Insights</h3>
                  <p className="text-xs text-gray-600">Help improve AI recommendations</p>
                </div>
              </div>
              <div className="space-y-3">
                {recentInsights.map((insight: any) => (
                  <InsightCard
                    key={insight.id}
                    id={insight.id}
                    title={insight.title}
                    explanation={insight.explanation || insight.description || ''}
                    confidence={insight.confidence || 0}
                    lifeMetrics={insight.lifeMetrics || []}
                    suggestedGoals={insight.suggestedGoals || []}
                    suggestedHabits={insight.suggestedHabits || []}
                    onVote={(isUpvote) => {
                      console.log('Dashboard vote', insight.id, isUpvote);
                    }}
                    onFeedbackRecorded={() => {
                      console.log('Dashboard (mobile): onFeedbackRecorded for', insight.id);
                      dismissInsight(insight.id);
                    }}
                    feedbackContext={{ surface: 'dashboard_recent_mobile' }}
                    mode="compact"
                    initialVoted={feedbackStatus?.voted?.[insight.id] || false}
                    lastAction={feedbackStatus?.lastAction?.[insight.id] || null}
                    kind={insight.kind}
                    relatedTitle={insight.relatedTitle}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Recent Insights</h3>
                  <p className="text-xs text-gray-600">Help improve AI recommendations</p>
                </div>
              </div>
              <div className="text-center py-6">
                <div className="text-gray-500 text-sm">No insights yet</div>
                <p className="text-xs text-gray-500 mt-1">Create a journal entry or chat with life coach to see suggestions.</p>
              </div>
            </div>
          )}

          {/* Smart Suggestions removed on mobile (now integrated into habit priority) */}

          {/* Suggested Goals and Habits - Mobile */}
          {(suggestedGoalsLoading || suggestedHabitsLoading) ? (
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Target className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Suggested Goals & Habits</h3>
                  <p className="text-xs text-gray-600">AI-powered recommendations</p>
                </div>
              </div>
              <div className="text-center py-4">
                <div className="text-gray-600 text-sm">Loading suggestions...</div>
              </div>
            </div>
          ) : (suggestedGoalsError || suggestedHabitsError) ? (
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Target className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Suggested Goals & Habits</h3>
                  <p className="text-xs text-gray-600">AI-powered recommendations</p>
                </div>
              </div>
              <div className="text-center py-4">
                <div className="text-red-600 text-sm">Failed to load suggestions</div>
              </div>
            </div>
          ) : hasAnySuggestions && (
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Target className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Suggested Goals & Habits</h3>
                  <p className="text-xs text-gray-600">AI-powered recommendations</p>
                </div>
              </div>
              <div className="space-y-3">
                {/* Suggested Goals */}
                {recentSuggestedGoals.map((goal: any) => {
                  const isExisting = goal?.kind === 'existing';
                  const displayTitle = goal?.title || goal?.existingTitle || '';
                  const key = isExisting ? `goal-existing-${goal?.existingId || 'na'}-${goal?.sourceInsightId || 'na'}` : `goal-${goal?.id}`;
                  return (
                  <div key={key} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: getPillBackgroundColor(goal.lifeMetric?.name || 'General'),
                            color: getPillTextColor(goal.lifeMetric?.name || 'General')
                          }}
                        >
                          {goal.lifeMetric?.name || 'General'}
                        </div>
                        <span className="text-xs text-gray-500">
                          {goal.insight?.confidence || 85}% confident
                        </span>
                      </div>
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-1 text-sm">{displayTitle} {isExisting && (<span className="ml-2 text-[11px] text-green-700 bg-green-50 border border-green-200 px-1 py-0.5 rounded">Already in progress</span>)}</h4>
                    <p className="text-xs text-gray-600 mb-3">
                      {goal.description || "AI-generated goal suggestion based on your patterns."}
                    </p>
                    <div className="flex items-center justify-between">
                      {!isExisting ? (
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                            onClick={() => {
                              setSelectedSuggestedGoal({
                                id: goal.id,
                                title: goal.title,
                                description: goal.description,
                                lifeMetricId: goal.lifeMetric?.id,
                                lifeMetricName: goal.lifeMetric?.name,
                                lifeMetricColor: goal.lifeMetric?.color
                              });
                              setShowGoalWizard(true);
                            }}
                          >
                            Add to {goal.lifeMetric?.name || 'Life Metric'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs hover:bg-red-50 text-red-600"
                            onClick={() => {
                              setFeedbackTarget({ kind: 'suggested_goal', id: goal.id });
                              setFeedbackOpen(true);
                            }}
                            title="Dismiss suggestion"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs hover:bg-green-50 text-green-700 ml-auto"
                          onClick={async () => {
                            try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_goal', itemId: goal.existingId, action:'dismiss', context:{ sourceInsightId: goal.sourceInsightId } }) }); } catch {}
                          }}
                          title="Got it"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Got it
                        </Button>
                      )}
                    </div>
                  </div>
                )})}
                
                {/* Suggested Habits */}
                {recentSuggestedHabits
                  .filter((habit:any)=> {
                    // Filter out existing habits that are dismissed
                    if (habit?.kind === 'existing') {
                      const isDismissed = dismissedReinforcements.includes(`habit:${habit?.existingId || 'na'}:${habit?.sourceInsightId || 'na'}`);
                      console.log('🟣 Mobile - Existing habit filter:', { habitId: habit.id, isDismissed });
                      return !isDismissed;
                    }
                    // For new suggested habits, check if they've been dismissed via feedback
                    if (habit?.kind !== 'existing') {
                      const isVoted = habitFeedbackStatus?.voted?.[habit.id];
                      console.log('🟣 Mobile - New habit filter:', { habitId: habit.id, isVoted, feedbackStatus: habitFeedbackStatus });
                      return !isVoted;
                    }
                    return true;
                  })
                  .map((habit: any) => {
                  const isExistingH = habit?.kind === 'existing';
                  const displayTitleH = habit?.title || habit?.existingTitle || '';
                  const keyH = isExistingH ? `habit-existing-${habit?.existingId || 'na'}-${habit?.sourceInsightId || 'na'}` : `habit-${habit?.id}`;
                  return (
                  <div key={keyH} className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: getPillBackgroundColor(habit.lifeMetric?.name || 'General'),
                            color: getPillTextColor(habit.lifeMetric?.name || 'General')
                          }}
                        >
                          {habit.lifeMetric?.name || 'General'}
                        </div>
                        <span className="text-xs text-gray-500">
                          {habit.insight?.confidence || 85}% confident
                        </span>
                      </div>
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-1 text-sm">{displayTitleH} {isExistingH && (<span className="ml-2 text-[11px] text-green-700 bg-green-50 border border-green-200 px-1 py-0.5 rounded">Already in progress</span>)}</h4>
                    <p className="text-xs text-gray-600 mb-3">
                      {habit.description || "AI-generated habit suggestion based on your patterns."}
                    </p>
                    <div className="flex items-center justify-between">
                      {!isExistingH ? (
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => {
                              const metricId = habit.lifeMetric?.id;
                              const activeGoalsSameMetric = (goals || [])
                                .filter((g: any) => (g.status === 'active' || !g.status) && (metricId ? (g.lifeMetricId === metricId || g.lifeMetric?.id === metricId || (g.lifeMetric?.name && g.lifeMetric?.name === habit.lifeMetric?.name)) : true))
                                .map((g:any) => String(g.goalInstance?.id || g.id));
                              
                              console.log('🟣 Dashboard - Suggested habit clicked:', {
                                habitTitle: habit.title,
                                metricId,
                                goalsCount: goals?.length,
                                activeGoalsSameMetric,
                                goalsStructure: goals?.map((g: any) => ({ 
                                  id: g.id, 
                                  goalInstanceId: g.goalInstance?.id, 
                                  status: g.status,
                                  lifeMetricId: g.lifeMetricId,
                                  lifeMetricName: g.lifeMetric?.name
                                }))
                              });
                              
                              const prefill = {
                                title: habit.title,
                                description: habit.description,
                                lifeMetricId: metricId || '',
                                lifeMetricName: habit.lifeMetric?.name,
                                suggestedHabitId: habit.id,
                                recommendedGoalIds: activeGoalsSameMetric,
                                recommendedActiveGoalIds: activeGoalsSameMetric,
                                recommendedSuggestedGoalIds: Array.isArray(habit.recommendedSuggestedGoalIds) ? habit.recommendedSuggestedGoalIds : [],
                              };
                              setPrefillHabit(prefill);
                              setShowAddHabitModal(true);
                            }}
                          >
                            Add to Goals
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs hover:bg-red-50 text-red-600"
                            onClick={() => {
                              setFeedbackTarget({ kind: 'suggested_habit', id: habit.id });
                              setFeedbackOpen(true);
                            }}
                            title="Dismiss suggestion"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs hover:bg-green-50 text-green-700 ml-auto"
                          onClick={async () => {
                            try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_habit', itemId: habit.existingId, action:'dismiss', context:{ sourceInsightId: habit.sourceInsightId } }) }); } catch {}
                          }}
                          title="Got it"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Got it
                        </Button>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}

          {/* Removed legacy mobile habits panel; UnifiedHabitManager above handles mobile */}
        </div>

        {/* Desktop Layout: Centered single column */}
        <div className="hidden lg:block lg:px-0">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Journal Chat Box - Desktop (Primary Action) */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-3">
              {/* Chat-like input box with buttons inside */}
              <div className="bg-white rounded-xl p-1.5">
                <div className="text-left mb-2">
                  <textarea 
                    className="w-full h-32 p-1.5 border-0 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 text-gray-700 placeholder-gray-400 text-base min-h-[8rem]"
                    placeholder="What's on your mind today? Share your thoughts, feelings, or experiences..."
                    style={{ minHeight: '8rem' }}
                    value={journalContent}
                    onChange={(e) => setJournalContent(e.target.value)}
                  />
                </div>
                
                                {/* Action button inside the chat box - right aligned and smaller */}
                <div className="flex gap-2 justify-end">
                  <Button 
                    className="bg-purple-600 text-white hover:bg-purple-700 py-1.5 px-4 rounded-full font-semibold text-sm shadow-md transition-all duration-200 hover:shadow-lg"
                    onClick={handleSaveJournal}
                    disabled={isSavingJournal}
                  >
                    <BookOpen className="w-4 h-4 mr-1" />
                    {isSavingJournal ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Recent Insights - Moved here from right column */}
            {insightsLoading ? (
              <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Recent Insights</h3>
                      <p className="text-sm text-gray-600">Help improve AI recommendations</p>
                    </div>
                  </div>
                  <div className="text-center py-8">
                    <div className="text-gray-600">Loading insights...</div>
                  </div>
                </CardContent>
              </Card>
            ) : insightsError ? (
              <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Recent Insights</h3>
                      <p className="text-sm text-gray-600">Help improve AI recommendations</p>
                    </div>
                  </div>
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-4">
                      <TrendingUp className="mx-auto h-12 w-12 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No insights yet</h3>
                    <p className="text-gray-500 mb-4">
                      Create a journal entry or chat with life coach to see suggestions.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : recentInsights.length > 0 ? (
              <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Recent Insights</h3>
                      <p className="text-sm text-gray-600">Help improve AI recommendations</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {recentInsights.map((insight: any) => (
                      <InsightCard
                        key={insight.id}
                        id={insight.id}
                        title={insight.title}
                        explanation={insight.explanation || insight.description || ''}
                        confidence={insight.confidence || 0}
                        lifeMetrics={insight.lifeMetrics || []}
                        suggestedGoals={insight.suggestedGoals || []}
                        suggestedHabits={insight.suggestedHabits || []}
                        onVote={(isUpvote) => {
                          console.log('Dashboard vote', insight.id, isUpvote);
                        }}
                        onFeedbackRecorded={() => {
                          console.log('Dashboard: onFeedbackRecorded received for', insight.id);
                          // Dismiss insight from homepage after voting + feedback
                          dismissInsight(insight.id);
                        }}
                        feedbackContext={{ surface: 'dashboard_recent' }}
                        mode="compact"
                        initialVoted={feedbackStatus?.voted?.[insight.id] || false}
                        lastAction={feedbackStatus?.lastAction?.[insight.id] || null}
                        kind={insight.kind}
                        relatedTitle={insight.relatedTitle}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Recent Insights</h3>
                      <p className="text-sm text-gray-600">Help improve AI recommendations</p>
                    </div>
                  </div>
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-4">
                      <TrendingUp className="mx-auto h-12 w-12 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No insights yet</h3>
                    <p className="text-gray-500 mb-4">
                      Create a journal entry or chat with life coach to see suggestions.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suggested Goals and Habits - Moved here from middle column */}
            {(suggestedGoalsLoading || suggestedHabitsLoading) ? (
              <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Target className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Suggested Goals & Habits</h3>
                      <p className="text-sm text-gray-600">AI-powered recommendations</p>
                    </div>
                  </div>
                  <div className="text-center py-8">
                    <div className="text-gray-600">Loading suggestions...</div>
                  </div>
                </CardContent>
              </Card>
            ) : (suggestedGoalsError || suggestedHabitsError) ? (
              <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Target className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Suggested Goals & Habits</h3>
                      <p className="text-sm text-gray-600">AI-powered recommendations</p>
                    </div>
                  </div>
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-4">
                      <Target className="mx-auto h-12 w-12 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No suggestions yet</h3>
                    <p className="text-gray-500 mb-4">
                      Create a journal entry or chat with life coach to see suggestions.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : hasAnySuggestions ? (
              <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Target className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Suggested Goals & Habits</h3>
                      <p className="text-sm text-gray-600">AI-powered recommendations</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {(reinforceGoals.length > 0 || reinforceHabits.length > 0) && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Already in progress</h4>
                        <p className="text-xs text-gray-500 mb-3">These active items already support this journal.</p>
                        <div className="space-y-2">
                          {reinforceGoals
                            .filter((r:any)=> !dismissedReinforcements.includes(`goal:${r.existingId}:${r.sourceInsightId}`))
                            .slice(0,5)
                            .map((r:any) => (
                              <div key={`rg-${r.existingId}-${r.sourceInsightId}`} className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start justify-between">
                                <div>
                                  <div className="text-xs text-blue-700 mb-1">Goal • {r.lifeMetric?.name || 'General'}</div>
                                  <div className="text-sm font-medium text-gray-800">{r.existingTitle}</div>
                                  <div className="text-[11px] text-gray-600 mt-1">Reinforces this journal</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={async ()=>{
                                    try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_goal', itemId:r.existingId, action:'confirm_relevance', context:{ sourceInsightId:r.sourceInsightId } }) }); } catch {}
                                  }}>Confirm helps</Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600" onClick={async ()=>{
                                    try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_goal', itemId:r.existingId, action:'dismiss', context:{ sourceInsightId:r.sourceInsightId } }) }); } catch {}
                                    dismissReinforcement(`goal:${r.existingId}:${r.sourceInsightId}`);
                                  }}>Dismiss</Button>
                                </div>
                              </div>
                          ))}
                          {reinforceHabits
                            .filter((r:any)=> !dismissedReinforcements.includes(`habit:${r.existingId}:${r.sourceInsightId}`))
                            .slice(0,5)
                            .map((r:any) => (
                              <div key={`rh-${r.existingId}-${r.sourceInsightId}`} className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start justify-between">
                                <div>
                                  <div className="text-xs text-blue-700 mb-1">Habit • {r.lifeMetric?.name || 'General'}</div>
                                  <div className="text-sm font-medium text-gray-800">{r.existingTitle}</div>
                                  <div className="text-[11px] text-gray-600 mt-1">Reinforces this journal</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={async ()=>{
                                    try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_habit', itemId:r.existingId, action:'confirm_relevance', context:{ sourceInsightId:r.sourceInsightId } }) }); } catch {}
                                  }}>Confirm helps</Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600" onClick={async ()=>{
                                    try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_habit', itemId:r.existingId, action:'dismiss', context:{ sourceInsightId:r.sourceInsightId } }) }); } catch {}
                                    dismissReinforcement(`habit:${r.existingId}:${r.sourceInsightId}`);
                                  }}>Dismiss</Button>
                                </div>
                              </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Suggested Goals */}
                    {recentSuggestedGoals.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Suggested Goals</h4>
                        <div className="space-y-3">
                          {recentSuggestedGoals
                            .filter((goal:any)=> {
                              // Filter out existing goals that are dismissed
                              if (goal?.kind === 'existing') {
                                return !dismissedReinforcements.includes(`goal:${goal?.existingId || 'na'}:${goal?.sourceInsightId || 'na'}`);
                              }
                              // For new suggested goals, check if they've been dismissed via feedback
                              if (goal?.kind !== 'existing') {
                                return !goalFeedbackStatus?.voted?.[goal.id];
                              }
                              return true;
                            })
                            .slice(0, 3)
                            .map((goal: any) => {
                            const isExisting = goal?.kind === 'existing';
                            const displayTitle = goal?.title || goal?.existingTitle || '';
                            const key = isExisting
                              ? `goal-existing-${goal?.existingId || 'na'}-${goal?.sourceInsightId || 'na'}`
                              : `goal-${goal?.id}`;
                            return (
                            <div key={key} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                    style={{ 
                                      backgroundColor: getPillBackgroundColor(goal.lifeMetric?.name || 'General'),
                                      color: getPillTextColor(goal.lifeMetric?.name || 'General')
                                    }}
                                  >
                                    {goal.lifeMetric?.name || 'General'}
                                  </div>
                                  <h5 className="font-semibold text-gray-800 text-sm">{displayTitle} {isExisting && (<span className="ml-2 text-[11px] text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">You're already working on it</span>)}</h5>
                                </div>
                                <Target className="w-4 h-4 text-purple-600" />
                              </div>
                              {goal.description && (
                                <p className="text-xs text-gray-600 mb-3">{goal.description}</p>
                              )}
                              {!isExisting && (
                                <ReinforcementBadge 
                                  kind={goal.kind || 'new'} 
                                  relatedType="goal" 
                                  relatedTitle={goal.relatedTitle}
                                  className="mb-3"
                                />
                              )}
                              <div className="flex gap-2">
                                {!isExisting ? (
                                  <>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                                      onClick={() => {
                                        setSelectedSuggestedGoal({
                                          id: goal.id,
                                          title: goal.title,
                                          description: goal.description,
                                          lifeMetricId: goal.lifeMetric?.id,
                                          lifeMetricName: goal.lifeMetric?.name,
                                          lifeMetricColor: goal.lifeMetric?.color
                                        });
                                        setShowGoalWizard(true);
                                      }}
                                    >
                                      Add to {goal.lifeMetric?.name || 'Life Metric'}
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-xs hover:bg-red-50 text-red-600"
                                      onClick={() => {
                                        setFeedbackTarget({ kind: 'suggested_goal', id: goal.id });
                                        setFeedbackOpen(true);
                                      }}
                                      title="Dismiss suggestion"
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      Dismiss
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                                      onClick={() => {
                                        if (goal.lifeMetric?.name) setSelectedMetric(goal.lifeMetric.name);
                                      }}
                                    >
                                      View goal
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-xs hover:bg-green-50 text-green-700"
                                      onClick={async () => {
                                        try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_goal', itemId: goal.existingId, action:'dismiss', context:{ sourceInsightId: goal.sourceInsightId } }) }); } catch {}
                                        dismissReinforcement(`goal:${goal?.existingId || 'na'}:${goal?.sourceInsightId || 'na'}`);
                                      }}
                                      title="Got it"
                                    >
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Got it
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Suggested Habits */}
                    {recentSuggestedHabits.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Suggested Habits</h4>
                        <div className="space-y-3">
                          {recentSuggestedHabits
                            .filter((habit:any)=> {
                              // Filter out existing habits that are dismissed
                              if (habit?.kind === 'existing') {
                                const isDismissed = dismissedReinforcements.includes(`habit:${habit?.existingId || 'na'}:${habit?.sourceInsightId || 'na'}`);
                                console.log('🟣 Existing habit filter:', { habitId: habit.id, isDismissed });
                                return !isDismissed;
                              }
                              // For new suggested habits, check if they've been dismissed via feedback
                              if (habit?.kind !== 'existing') {
                                const isVoted = habitFeedbackStatus?.voted?.[habit.id];
                                console.log('🟣 New habit filter:', { habitId: habit.id, isVoted, feedbackStatus: habitFeedbackStatus });
                                return !isVoted;
                              }
                              return true;
                            })
                            .slice(0, 3)
                            .map((habit: any) => {
                            const isExistingH = habit?.kind === 'existing';
                            const displayTitleH = habit?.title || habit?.existingTitle || '';
                            const keyH = isExistingH
                              ? `habit-existing-${habit?.existingId || 'na'}-${habit?.sourceInsightId || 'na'}`
                              : `habit-${habit?.id}`;
                            return (
                            <div key={keyH} className="p-3 bg-green-50 rounded-lg border border-green-100">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 text-xs rounded-full bg-green-200 text-green-800">
                                    Habit
                                  </span>
                                  <h5 className="font-semibold text-gray-800 text-sm">{displayTitleH} {isExistingH && (<span className="ml-2 text-[11px] text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">You're already working on it</span>)}</h5>
                                </div>
                                <Flame className="w-4 h-4 text-green-600" />
                              </div>
                              {habit.description && (
                                <p className="text-xs text-gray-600 mb-3">{habit.description}</p>
                              )}
                              {!isExistingH && (
                                <ReinforcementBadge 
                                  kind={habit.kind || 'new'} 
                                  relatedType="habit" 
                                  relatedTitle={habit.relatedTitle}
                                  className="mb-3"
                                />
                              )}
                              <div className="flex gap-2">
                                {!isExistingH ? (
                                  <>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-xs border-green-200 text-green-700 hover:bg-green-50"
                                      onClick={() => {
                                        const metricId = habit.lifeMetric?.id;
                                        const activeGoalsSameMetric = (goals || [])
                                          .filter((g: any) => (g.status === 'active' || !g.status) && (metricId ? (g.lifeMetricId === metricId || g.lifeMetric?.id === metricId || (g.lifeMetric?.name && g.lifeMetric?.name === habit.lifeMetric?.name)) : true))
                                          .map((g:any) => String(g.goalInstance?.id || g.id));
                                        const prefill = {
                                          title: habit.title,
                                          description: habit.description,
                                          lifeMetricId: metricId || '',
                                          lifeMetricName: habit.lifeMetric?.name,
                                          suggestedHabitId: habit.id,
                                          recommendedGoalIds: activeGoalsSameMetric,
                                          recommendedActiveGoalIds: activeGoalsSameMetric,
                                          recommendedSuggestedGoalIds: Array.isArray(habit.recommendedSuggestedGoalIds) ? habit.recommendedSuggestedGoalIds : [],
                                        };
                                        setPrefillHabit(prefill);
                                        setShowAddHabitModal(true);
                                      }}
                                    >
                                      Add to Goals
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-xs hover:bg-red-50 text-red-600"
                                      onClick={() => {
                                        setFeedbackTarget({ kind: 'suggested_habit', id: habit.id });
                                        setFeedbackOpen(true);
                                      }}
                                      title="Dismiss suggestion"
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      Dismiss
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-xs hover:bg-green-50 text-green-700"
                                      onClick={async () => {
                                        try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_habit', itemId: habit.existingId, action:'dismiss', context:{ sourceInsightId: habit.sourceInsightId } }) }); } catch {}
                                        dismissReinforcement(`habit:${habit?.existingId || 'na'}:${habit?.sourceInsightId || 'na'}`);
                                      }}
                                      title="Got it"
                                    >
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Got it
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <Target className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Suggested Goals & Habits</h3>
                        <p className="text-sm text-gray-600">AI-powered recommendations</p>
                      </div>
                    </div>
                    <div className="text-center py-8">
                      <div className="text-gray-500 mb-4">
                        <Target className="mx-auto h-12 w-12 text-gray-300" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No new suggestions</h3>
                      <p className="text-gray-500 mb-4">
                        Create a journal entry or chat with life coach to see suggestions.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {(reinforceGoals.length > 0 || reinforceHabits.length > 0) && (
                  <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Target className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">Already in progress</h3>
                          <p className="text-sm text-gray-600">These active items already support this journal.</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {reinforceGoals
                          .filter((r:any)=> !dismissedReinforcements.includes(`goal:${r.existingId}:${r.sourceInsightId}`))
                          .slice(0,6)
                          .map((r:any) => (
                            <div key={`rg2-${r.existingId}-${r.sourceInsightId}`} className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start justify-between">
                              <div>
                                <div className="text-xs text-blue-700 mb-1">Goal • {r.lifeMetric?.name || 'General'}</div>
                                <div className="text-sm font-medium text-gray-800">{r.existingTitle}</div>
                                <div className="text-[11px] text-gray-600 mt-1">Reinforces this journal</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={async ()=>{
                                  try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_goal', itemId:r.existingId, action:'confirm_relevance', context:{ sourceInsightId:r.sourceInsightId } }) }); } catch {}
                                }}>Confirm helps</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600" onClick={async ()=>{
                                  try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_goal', itemId:r.existingId, action:'dismiss', context:{ sourceInsightId:r.sourceInsightId } }) }); } catch {}
                                  dismissReinforcement(`goal:${r.existingId}:${r.sourceInsightId}`);
                                }}>Dismiss</Button>
                              </div>
                            </div>
                        ))}
                        {reinforceHabits
                          .filter((r:any)=> !dismissedReinforcements.includes(`habit:${r.existingId}:${r.sourceInsightId}`))
                          .slice(0,6)
                          .map((r:any) => (
                            <div key={`rh2-${r.existingId}-${r.sourceInsightId}`} className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start justify-between">
                              <div>
                                <div className="text-xs text-blue-700 mb-1">Habit • {r.lifeMetric?.name || 'General'}</div>
                                <div className="text-sm font-medium text-gray-800">{r.existingTitle}</div>
                                <div className="text-[11px] text-gray-600 mt-1">Reinforces this journal</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={async ()=>{
                                  try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_habit', itemId:r.existingId, action:'confirm_relevance', context:{ sourceInsightId:r.sourceInsightId } }) }); } catch {}
                                }}>Confirm helps</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600" onClick={async ()=>{
                                  try { await apiRequest('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ type:'reinforcement_habit', itemId:r.existingId, action:'dismiss', context:{ sourceInsightId:r.sourceInsightId } }) }); } catch {}
                                  dismissReinforcement(`habit:${r.existingId}:${r.sourceInsightId}`);
                                }}>Dismiss</Button>
                              </div>
                            </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Floating Action Button removed */}
      </div>


      
      {/* Add Habit Modal */}
      <AddHabitModal
        isOpen={showAddHabitModal}
        onClose={() => {
          setShowAddHabitModal(false);
          setPrefillHabit(null);
        }}
        onHabitAdded={() => {
          setShowAddHabitModal(false);
          setPrefillHabit(null);
          // Refresh the page to show the new habit
          window.location.reload();
        }}
        onHabitAssociatedWithGoal={(goalId) => {
          setShowAddHabitModal(false);
          setPrefillHabit(null);
          // Navigate to goal detail view
          setSelectedMetric(null);
          // We could improve this by storing the goal's life metric and navigating there
          window.location.reload();
        }}
        prefillData={prefillHabit}
      />
      
      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
      
      {/* Dismiss Feedback Modal */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="max-w-md mx-4" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-sm">
              Help us improve these suggestions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-gray-600">Why are you dismissing this?</div>
            <div className="grid grid-cols-2 gap-2">
              {FEEDBACK_REASON_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`text-xs rounded-md border px-2 py-1 ${feedbackReasons.includes(r) ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-700'}`}
                  onClick={() => toggleReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <div>
              <textarea
                className="w-full text-xs border border-gray-200 rounded-md p-2"
                rows={3}
                placeholder="Optional notes"
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFeedbackOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" className="text-xs" onClick={sendDismissFeedback}>
                Save feedback & archive
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Goal Creation Wizard */}
      {showGoalWizard && selectedSuggestedGoal && (
        <CreateGoalWizard
          isOpen={showGoalWizard}
          onClose={() => {
            setShowGoalWizard(false);
            setSelectedSuggestedGoal(null);
          }}
          onGoalCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
            queryClient.invalidateQueries({ queryKey: ['/api/goals/suggested'] });
          }}
          suggestedGoalId={selectedSuggestedGoal.id}
          prefillData={selectedSuggestedGoal}
        />
      )}

      {/* Shared habits slideout used by journal & home header pill */}
      <HabitsSidePanel
        open={showHabitsPanel}
        onOpenChange={setShowHabitsPanel}
        todaySummary={
          todayCompletions
            ? { completed: todayCompletions.completed, total: todayCompletions.total }
            : undefined
        }
      />
    </div>
  );
};
