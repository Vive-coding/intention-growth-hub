
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Plus, 
  Target, 
  Calendar, 
  TrendingUp, 
  CheckCircle, 
  X, 
  Edit, 
  Trash2,
  Flame,
  Clock,
  Star,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  Brain
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { getLifeMetricColors } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMetricProgress } from "@/hooks/useMetricProgress";
import { GoalDetailModal } from "./GoalDetailModal";
import { CreateGoalModal } from "./CreateGoalModal";
import { useToast } from "@/hooks/use-toast";
import { analytics } from "@/services/analyticsService";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { InsightCard } from "./insights/InsightCard";

interface DetailedLifeOverviewProps {
  metric: string;
  onBack: () => void;
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
  onNavigateHome?: () => void;
  onClearDetailedView?: () => void;
  onNavigateToMetric?: (metric: string) => void;
  prefillGoal?: {
    title: string;
    description?: string;
    lifeMetricId?: string;
  };
}

interface Goal {
  id: string;
  title: string;
  description?: string;
  lifeMetricId: string;
  lifeMetric: {
    name: string;
    color: string;
  };
  progress: number;
  currentValue?: number;
  targetValue?: number;
  createdAt: string;
  completedAt?: string;
  targetDate?: string;
  status: 'active' | 'completed' | 'paused';
  habits: Array<{
    id: string;
    title: string;
    description?: string;
    category?: string;
    targetValue: number;
    currentValue: number;
    goalSpecificStreak: number;
  }>;
  goalInstance?: {
    id: string;
    currentValue: number;
    targetValue: number;
  };
  goalDefinition?: {
    title: string;
    description: string;
    category: string;
  };
}

interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: string;
  targetCompletions: number;
  currentCompletions: number;
  status: 'active' | 'completed' | 'overdue';
  lastCompleted?: string;
  streak: number;
}

interface LifeMetric {
  id: string;
  name: string;
  color: string;
}

export const DetailedLifeOverview = ({ 
  metric, 
  onBack, 
  selectedPeriod: externalPeriod, 
  onPeriodChange, 
  onNavigateHome, 
  onClearDetailedView,
  onNavigateToMetric,
  prefillGoal
}: DetailedLifeOverviewProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState(externalPeriod || "This Month");
  const [selectedView, setSelectedView] = useState<'daily' | 'weekly'>('daily');
  const [showGoalDetailModal, setShowGoalDetailModal] = useState(false);
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);
  const [selectedGoalDetails, setSelectedGoalDetails] = useState<Goal | null>(null);
  // Removed showCompleted state - no longer needed
  
  // Auto-open goal creation modal if prefillGoal is provided
  useEffect(() => {
    console.log('🎯 DetailedLifeOverview prefillGoal changed:', prefillGoal);
    if (prefillGoal) {
      console.log('📂 Opening CreateGoalModal with prefillGoal:', prefillGoal);
      setShowCreateGoalModal(true);
    }
  }, [prefillGoal]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const periods = ["This Month", "Last 3 Months", "Last 6 Months", "This Year", "All Time"];

  // Use shared hook for consistent progress calculations
  const { data: progressData, isLoading: progressLoading } = useMetricProgress(metric, selectedPeriod);
  
  // Fetch available life metrics for navigation
  const { data: availableMetrics = [] } = useQuery({
    queryKey: ['/api/life-metrics'],
    queryFn: async () => {
      const response = await apiRequest('/api/life-metrics');
      return response;
    },
    retry: 1,
  });

  // Navigation logic
  const currentMetricIndex = availableMetrics.findIndex((m: any) => m.name === metric);
  const canNavigateLeft = currentMetricIndex > 0;
  const canNavigateRight = currentMetricIndex < availableMetrics.length - 1;
  
  const navigateToPrevious = () => {
    if (canNavigateLeft && onNavigateToMetric) {
      const previousMetric = availableMetrics[currentMetricIndex - 1];
      onNavigateToMetric(previousMetric.name);
    }
  };
  
  const navigateToNext = () => {
    if (canNavigateRight && onNavigateToMetric) {
      const nextMetric = availableMetrics[currentMetricIndex + 1];
      onNavigateToMetric(nextMetric.name);
    }
  };

  // Fetch goals for this specific metric
  const { data: goals = [], isLoading: goalsLoading, error: goalsError } = useQuery({
    queryKey: ['/api/goals', metric, selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('metric', metric);
      // Server will return goals relevant to the selected time period
      
      const response = await apiRequest(`/api/goals?${params.toString()}`);
      return response;
    },
    retry: 1,
  });

  // Filter goals based on selected time period
  const filteredGoals = goals.filter((goal: Goal) => {
    const now = new Date();
    
    switch (selectedPeriod) {
      case "This Month":
        // Show goals that are:
        // 1. Active (not completed)
        // 2. Created this month
        // 3. Completed this month
        if (goal.status === 'active') {
          return true; // Always show active goals
        }
        
        if (goal.status === 'completed' && goal.completedAt) {
          const completedDate = new Date(goal.completedAt);
          const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          return completedDate >= currentMonthStart;
        }
        
        // For goals without completion date, check if created this month
        if (goal.createdAt) {
          const createdDate = new Date(goal.createdAt);
          const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          return createdDate >= currentMonthStart;
        }
        
        return false;
        
      case "Last 3 Months":
        // Show goals that are:
        // 1. Active (not completed)
        // 2. Created in the last 3 months
        // 3. Completed in the last 3 months
        if (goal.status === 'active') {
          return true; // Always show active goals
        }
        
        if (goal.status === 'completed' && goal.completedAt) {
          const completedDate = new Date(goal.completedAt);
          // Last 3 months should include current month + 2 previous months
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
          return completedDate >= threeMonthsAgo;
        }
        
        // For goals without completion date, check if created in last 3 months
        if (goal.createdAt) {
          const createdDate = new Date(goal.createdAt);
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
          return createdDate >= threeMonthsAgo;
        }
        
        return false;
        
      case "Last 6 Months":
        // Show goals that are:
        // 1. Active (not completed)
        // 2. Created in the last 6 months
        // 3. Completed in the last 6 months
        if (goal.status === 'active') {
          return true; // Always show active goals
        }
        
        if (goal.status === 'completed' && goal.completedAt) {
          const completedDate = new Date(goal.completedAt);
          // Last 6 months should include current month + 5 previous months
          const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
          return completedDate >= sixMonthsAgo;
        }
        
        // For goals without completion date, check if created in last 6 months
        if (goal.createdAt) {
          const createdDate = new Date(goal.createdAt);
          const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
          return createdDate >= sixMonthsAgo;
        }
        
        return false;
        
      case "This Year":
        // Show goals that are:
        // 1. Active (not completed)
        // 2. Created this year
        // 3. Completed this year
        if (goal.status === 'active') {
          return true; // Always show active goals
        }
        
        if (goal.status === 'completed' && goal.completedAt) {
          const completedDate = new Date(goal.completedAt);
          const yearStart = new Date(now.getFullYear(), 0, 1);
          return completedDate >= yearStart;
        }
        
        // For goals without completion date, check if created this year
        if (goal.createdAt) {
          const createdDate = new Date(goal.createdAt);
          const yearStart = new Date(now.getFullYear(), 0, 1);
          return createdDate >= yearStart;
        }
        
        return false;
        
      case "All Time":
        // Show all goals
        return true;
        
      default:
        return true;
    }
  });

  // Handlers for goal interactions
  const handleGoalClick = async (goal: Goal) => {
    try {
      const response = await apiRequest(`/api/goals/${goal.id}`);
      setSelectedGoalDetails(response);
      setShowGoalDetailModal(true);
    } catch (error) {
      console.error('Error fetching goal details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load goal details.',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteHabit = async (habitId: string, goalId?: string) => {
    try {
      const requestBody: any = {
        completedAt: new Date().toISOString(),
      };
      
      // Include goalId if provided for progress tracking
      if (goalId) {
        requestBody.goalId = goalId;
      }
      
      const response = await apiRequest(`/api/goals/habits/${habitId}/complete`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      
      if (response) {
        // Track habit completion
        analytics.trackHabitCompleted(habitId, {
          goal_id: goalId,
          metric_name: metric,
          completion_time: new Date().toISOString(),
        });
        
        // Invalidate all goal-related queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        queryClient.invalidateQueries({ queryKey: ['/api/goal-instances'] });
        queryClient.invalidateQueries({ queryKey: ['/api/life-metrics/progress'] });
        try { await queryClient.invalidateQueries({ queryKey: ['/api/smart-suggestions'] }); } catch {}
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        
        toast({
          title: 'Habit completed!',
          description: 'Great job staying consistent.',
        });
      }
    } catch (error) {
      console.error('Error completing habit:', error);
      
      // Check if it's a duplicate completion error
      if (error instanceof Error && error.message && error.message.includes('already completed today')) {
        toast({
          title: 'Already completed!',
          description: 'You have already completed this habit today.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to complete habit.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleAddHabit = async (goalId: string, habit: any) => {
    try {
      const response = await apiRequest(`/api/goals/${goalId}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(habit),
      });
      if (response) {
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        toast({
          title: 'Habit added!',
          description: 'New habit has been added to your goal.',
        });
      }
    } catch (error) {
      console.error('Error adding habit:', error);
      toast({
        title: 'Error',
        description: 'Failed to add habit to goal.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveHabit = async (goalId: string, habitId: string) => {
    try {
      const response = await apiRequest(`/api/goals/${goalId}/habits/${habitId}`, {
        method: 'DELETE',
      });
      if (response) {
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        toast({
          title: 'Habit removed',
          description: 'Habit has been removed from your goal.',
        });
      }
    } catch (error) {
      console.error('Error removing habit:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove habit from goal.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateProgress = async (goalId: string, progress: number) => {
    try {
      const response = await apiRequest(`/api/goals/${goalId}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ currentValue: progress }),
      });
      if (response) {
        // Invalidate all goal-related queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        queryClient.invalidateQueries({ queryKey: ['/api/goal-instances'] });
        queryClient.invalidateQueries({ queryKey: ['/api/life-metrics/progress'] });
        
        toast({
          title: 'Progress updated',
          description: 'Goal progress has been updated.',
        });
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      toast({
        title: 'Error',
        description: 'Failed to update goal progress.',
        variant: 'destructive',
      });
    }
  };

  // Fetch additional data for detailed view
  const { data: additionalData, isLoading: additionalLoading } = useQuery({
    queryKey: ['metric-details', metric],
    queryFn: async () => {
      try {
        // Fetch goals for this metric
        const goalsResponse = await apiRequest(`/api/goals?metric=${encodeURIComponent(metric)}`);
        const goals = goalsResponse;

        // Fetch insights filtered by this life metric
        const insightsResponse = await apiRequest(`/api/insights?metric=${encodeURIComponent(metric)}`);
        const insights = insightsResponse;

        return { goals, insights };
      } catch (error) {
        console.error('Error fetching additional data:', error);
        return { goals: [], insights: [] };
      }
    }
  });

  const isLoading = progressLoading || additionalLoading;
  const metricData = {
    periodProgress: { progress: progressData?.progress || 0 },
    progressSnapshots: progressData?.progressSnapshots || [],
    goals: additionalData?.goals || [],
    insights: additionalData?.insights || []
  };

  // Ensure insights are filtered by the current life metric name
  const filteredInsights = Array.isArray(metricData.insights)
    ? metricData.insights.filter((insight: any) =>
        Array.isArray(insight?.lifeMetrics) && insight.lifeMetrics.some((m: any) => m?.name === metric)
      )
    : [];

  // Sort insights by confidence desc and fetch feedback status for them
  const sortedInsightsByConfidence = [...filteredInsights].sort(
    (a: any, b: any) => (b?.confidence || 0) - (a?.confidence || 0)
  );

  const { data: feedbackStatus = { voted: {}, lastAction: {} } } = useQuery({
    queryKey: ['/api/feedback/status', sortedInsightsByConfidence],
    queryFn: async () => {
      if (!sortedInsightsByConfidence || sortedInsightsByConfidence.length === 0) {
        return { voted: {}, lastAction: {} };
      }
      const ids = sortedInsightsByConfidence.map((i: any) => i.id).join(',');
      const response = await apiRequest(`/api/feedback/status?type=insight&ids=${ids}`);
      return response;
    },
    enabled: sortedInsightsByConfidence.length > 0,
  });

  // Only show unvoted or upvoted insights
  const displayInsights = sortedInsightsByConfidence.filter((i: any) => {
    const voted = feedbackStatus?.voted?.[i.id];
    const last = feedbackStatus?.lastAction?.[i.id];
    return !voted || last === 'upvote';
  });

  // Helper function to deduplicate snapshots by monthYear, keeping the latest one
  const deduplicateSnapshots = (snapshots: any[]) => {
    const monthGroups: { [key: string]: any[] } = {};
    
    // Group snapshots by monthYear
    snapshots.forEach((snapshot: any) => {
      if (!monthGroups[snapshot.monthYear]) {
        monthGroups[snapshot.monthYear] = [];
      }
      monthGroups[snapshot.monthYear].push(snapshot);
    });
    
    // For each month, keep the snapshot with the latest createdAt date
    const deduplicated: any[] = [];
    Object.keys(monthGroups).forEach((monthYear: string) => {
      const monthSnapshots = monthGroups[monthYear];
      const latestSnapshot = monthSnapshots.reduce((latest: any, current: any) => {
        return new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest;
      });
      deduplicated.push(latestSnapshot);
    });
    
    // Sort by monthYear to maintain chronological order
    return deduplicated.sort((a: any, b: any) => a.monthYear.localeCompare(b.monthYear));
  };

  // Format month labels to "Aug '25" format
  const formatMonthLabel = (monthString: string) => {
    const [year, month] = monthString.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[parseInt(month) - 1];
    const shortYear = year.slice(-2);
    return `${monthName} '${shortYear}`;
  };

  // Helper function to normalize names by stripping emojis for consistent grouping
  const normalizeName = (name: string) => {
    // Simple emoji removal - remove common emoji characters
    return name.replace(/[🚀🏃‍♀️🧠❤️💰🧘‍♂️]/g, '').trim();
  };

  // Generate chart data based on selected period - using exact same logic as dashboard
  const getGraphData = () => {
    if (!metricData || typeof metricData !== 'object') return [];

    // Use progress snapshots for all periods - no mock data
    const snapshots = metricData.progressSnapshots || [];
    
    // Normalize snapshot names for consistent grouping
    const normalizedSnapshots = snapshots.map((s: any) => ({
      ...s,
      normalizedName: normalizeName(s.lifeMetricName || s.name || ''),
      originalName: s.lifeMetricName || s.name || ''
    }));
    
    if (selectedPeriod === "This Month") {
      // For "This Month", show daily or weekly snapshots based on selectedView
      const dailySnapshots = (normalizedSnapshots || []).map((s: any) => ({
        date: new Date(s.snapshotDate || s.createdAt || Date.now()),
        progress: s.progressPercentage,
        completions: s.goalsCompleted,
      })).sort((a,b) => a.date.getTime() - b.date.getTime());

      // Calculate today's live progress from filtered goals (same as ring calculation)
      const currentProgress = filteredGoals && filteredGoals.length > 0
        ? Math.round(filteredGoals.reduce((sum: number, goal: Goal) => sum + (goal.progress || 0), 0) / filteredGoals.length)
        : 0;
      
      const currentCompletions = filteredGoals ? filteredGoals.filter((g: Goal) => g.status === 'completed').length : 0;

      if (selectedView === 'daily') {
        // Daily view: show all daily snapshots + today's live value
        const chartData = [];
        const today = new Date();
        const todayDateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Add daily snapshots for this month with unique labels (excluding today)
        dailySnapshots.forEach((snapshot: any, index: number) => {
          const date = snapshot.date;
          const snapshotDateStr = date.toISOString().split('T')[0];
          
          // Skip today's snapshots - we'll use live data instead
          if (snapshotDateStr === todayDateStr) {
            return;
          }
          
          const dayOfMonth = date.getDate();
          const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
          
          // Create unique label: "Mon 2" instead of just "Mon"
          const label = `${weekday} ${dayOfMonth}`;
          
          chartData.push({
            period: label,
            progressValue: snapshot.progress,
            completionValue: snapshot.completions,
            isCurrent: false,
            isFuture: false,
            isHistorical: true,
          });
        });
        
        // Always add today's live value as the last point
        const todayDayOfMonth = today.getDate();
        const todayWeekday = today.toLocaleDateString('en-US', { weekday: 'short' });
        const todayLabel = `${todayWeekday} ${todayDayOfMonth}`;
        
        chartData.push({
          period: todayLabel,
          progressValue: currentProgress,
          completionValue: currentCompletions,
          isCurrent: true,
          isFuture: false,
          isHistorical: false,
        });

        return chartData;
      } else {
        // Weekly view: group snapshots by week and show last snapshot per week
        const weeklyData: { [key: string]: any } = {};
        
        // Group snapshots by week
        dailySnapshots.forEach((snapshot: any) => {
          const date = snapshot.date;
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
          const weekKey = weekStart.toISOString().split('T')[0];
          
          // Keep the latest snapshot for each week
          if (!weeklyData[weekKey] || date > new Date(weeklyData[weekKey].date)) {
            weeklyData[weekKey] = {
              date,
              progress: snapshot.progress,
              completions: snapshot.completions,
              weekStart
            };
          }
        });
        
        // Convert to chart data
        const chartData = Object.values(weeklyData)
          .sort((a: any, b: any) => a.date.getTime() - b.date.getTime())
          .map((weekData: any, index: number) => {
            const weekNumber = Math.ceil(weekData.date.getDate() / 7);
            const weekLabel = `Week ${weekNumber}`;
            
            return {
              period: weekLabel,
              progressValue: weekData.progress,
              completionValue: weekData.completions,
              isCurrent: false,
              isFuture: false,
              isHistorical: true,
            };
          });
        
        // Add current week if it's not in the data
        const today = new Date();
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - today.getDay());
        const currentWeekKey = currentWeekStart.toISOString().split('T')[0];
        
        if (!weeklyData[currentWeekKey]) {
          const currentWeekNumber = Math.ceil(today.getDate() / 7);
          chartData.push({
            period: `Week ${currentWeekNumber}`,
            progressValue: currentProgress,
            completionValue: currentCompletions,
            isCurrent: true,
            isFuture: false,
            isHistorical: false,
          });
        }
        
        return chartData;
      }
    } else {
      // For historical periods, use last snapshot per period
      const now = new Date();
      let periodSnapshots: any[] = [];
      
      switch (selectedPeriod) {
        case "Last 3 Months": {
          // Get last snapshot for each of the last 3 months
          for (let i = 2; i >= 0; i--) {
            const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthYear = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
            
            // Find the last snapshot for this month
            const monthSnapshots = normalizedSnapshots.filter((s: any) => s.monthYear === monthYear);
            if (monthSnapshots.length > 0) {
              const lastSnapshot = monthSnapshots.reduce((latest: any, current: any) => {
                const latestDate = new Date(latest.snapshotDate || latest.createdAt);
                const currentDate = new Date(current.snapshotDate || current.createdAt);
                return currentDate > latestDate ? current : latest;
              });
              periodSnapshots.push(lastSnapshot);
            }
          }
          break;
        }
        case "Last 6 Months": {
          // Get last snapshot for each of the last 6 months
          for (let i = 5; i >= 0; i--) {
            const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthYear = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
            
            // Find the last snapshot for this month
            const monthSnapshots = normalizedSnapshots.filter((s: any) => s.monthYear === monthYear);
            if (monthSnapshots.length > 0) {
              const lastSnapshot = monthSnapshots.reduce((latest: any, current: any) => {
                const latestDate = new Date(latest.snapshotDate || latest.createdAt);
                const currentDate = new Date(current.snapshotDate || current.createdAt);
                return currentDate > latestDate ? current : latest;
              });
              periodSnapshots.push(lastSnapshot);
            }
          }
          break;
        }
        case "This Year": {
          // Get last snapshot for each month of this year
          const currentYear = now.getFullYear();
          for (let month = 0; month < 12; month++) {
            const monthYear = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
            
            // Find the last snapshot for this month
            const monthSnapshots = normalizedSnapshots.filter((s: any) => s.monthYear === monthYear);
            if (monthSnapshots.length > 0) {
              const lastSnapshot = monthSnapshots.reduce((latest: any, current: any) => {
                const latestDate = new Date(latest.snapshotDate || latest.createdAt);
                const currentDate = new Date(current.snapshotDate || current.createdAt);
                return currentDate > latestDate ? current : latest;
              });
              periodSnapshots.push(lastSnapshot);
            }
          }
          break;
        }
        case "All Time": {
          // Get last snapshot for each month that has data
          const monthGroups: { [key: string]: any[] } = {};
          normalizedSnapshots.forEach((snapshot: any) => {
            if (!monthGroups[snapshot.monthYear]) {
              monthGroups[snapshot.monthYear] = [];
            }
            monthGroups[snapshot.monthYear].push(snapshot);
          });
          
          // Get last snapshot for each month
          Object.keys(monthGroups).sort().forEach(monthYear => {
            const monthSnapshots = monthGroups[monthYear];
            const lastSnapshot = monthSnapshots.reduce((latest: any, current: any) => {
              const latestDate = new Date(latest.snapshotDate || latest.createdAt);
              const currentDate = new Date(current.snapshotDate || current.createdAt);
              return currentDate > latestDate ? current : latest;
            });
            periodSnapshots.push(lastSnapshot);
          });
          break;
        }
        default:
          periodSnapshots = normalizedSnapshots.slice(-6);
      }
      
      // Convert to chart data
      const chartData = periodSnapshots.map((snapshot: any, index: number) => {
        const monthLabel = formatMonthLabel(snapshot.monthYear);
        const isCurrentMonth = snapshot.monthYear === (new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'));
        
        return {
          period: monthLabel,
          progressValue: snapshot.progressPercentage,
          completionValue: snapshot.goalsCompleted,
          isCurrent: isCurrentMonth,
          isFuture: false,
          isHistorical: !isCurrentMonth,
        };
      });
      
      // For current month, update with live data if available
      const currentMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
      const currentMonthIndex = chartData.findIndex((item: any) => item.isCurrent);
      
      if (currentMonthIndex !== -1) {
        // Calculate current progress from live goals
        const currentProgress = filteredGoals && filteredGoals.length > 0
          ? Math.round(filteredGoals.reduce((sum: number, goal: Goal) => sum + (goal.progress || 0), 0) / filteredGoals.length)
          : 0;
        
        const currentCompletions = filteredGoals ? filteredGoals.filter((g: Goal) => g.status === 'completed').length : 0;
        
        chartData[currentMonthIndex] = {
          ...chartData[currentMonthIndex],
          progressValue: currentProgress,
          completionValue: currentCompletions,
        };
      }
      
      return chartData;
    }
  };

  // Calculate circular progress value based on goal progress for the selected time period
  const getCircularProgressValue = () => {
    // Use filtered goals based on selected time period for the ring calculation
    // This ensures the ring reflects only goals relevant to the current view
    if (!filteredGoals || filteredGoals.length === 0) return 0;
    
    const totalProgress = filteredGoals.reduce((sum: number, goal: Goal) => {
      return sum + (goal.progress || 0);
    }, 0);
    
    return Math.round(totalProgress / filteredGoals.length);
  };

  const graphData = getGraphData();
  const circularProgressValue = getCircularProgressValue();

  // Debug logging
  console.log('DetailedLifeOverview graph debug', {
    metric,
    selectedPeriod,
    snapshots: metricData?.progressSnapshots?.map((s:any)=>({date:s.snapshotDate||s.createdAt, progress:s.progressPercentage}))?.slice(-10),
    graphData,
    ring: circularProgressValue,
  });

  // Validate graphData to ensure no objects are being rendered
  const validatedGraphData = graphData.map((item: any, index: number) => {
    if (typeof item !== 'object' || item === null) {
      console.error('Invalid graph data item:', item);
      return {
        period: `Period ${index}`,
        progressValue: 0,
        completionValue: 0,
        isCurrent: false,
        isFuture: false,
        isHistorical: false
      };
    }
    
    // Ensure all values are strings or numbers
    return {
      period: String(item.period || `Period ${index}`),
      progressValue: Number(item.progressValue || 0),
      completionValue: Number(item.completionValue || 0),
      isCurrent: Boolean(item.isCurrent),
      isFuture: Boolean(item.isFuture),
      isHistorical: Boolean(item.isHistorical)
    };
  });

  // Get metric colors
  const getMetricColors = (name: string) => getLifeMetricColors(name);

  const colors = getMetricColors(metric);

  // Time availability local state
  const [timeAvailability, setTimeAvailability] = useState<'none' | 'very_little' | 'some' | 'plenty'>('some');
  const availabilityLabel = {
    none: 'No time',
    very_little: 'Very little',
    some: 'Some',
    plenty: 'Plenty',
  } as const;
  const sliderMarks: Array<{value:number; key: 'none'|'very_little'|'some'|'plenty'}> = [
    { value: 0, key: 'none' },
    { value: 1, key: 'very_little' },
    { value: 2, key: 'some' },
    { value: 3, key: 'plenty' },
  ];

  // Initialize from cached life metrics; update whenever list or metric changes
  useEffect(() => {
    const m = (availableMetrics || []).find((x: any) => x.name === metric);
    setTimeAvailability((m && (m.timeAvailability as any)) ?? 'some');
  }, [metric, availableMetrics]);

  const updateTimeAvailability = async (value: 'none' | 'very_little' | 'some' | 'plenty') => {
    try {
      const m = (availableMetrics || []).find((x: any) => x.name === metric);
      if (!m) return;
      await apiRequest(`/api/life-metrics/${m.id}/time-availability`, {
        method: 'PATCH',
        body: JSON.stringify({ timeAvailability: value }),
      });
      // Update cache so other views stay in sync
      queryClient.setQueryData(['/api/life-metrics'], (prev: any) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((x: any) => x.id === m.id ? { ...x, timeAvailability: value } : x);
      });
    } catch (e) {
      console.error('Failed to update time availability', e);
    }
  };

  const CircularProgress = ({ progress, color, bgColor, hasGoals }: { progress: number; color: string; bgColor: string; hasGoals: boolean }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20">
        <svg className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 transform -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-gray-200"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className={color}
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold ${color}`}>
            {hasGoals ? `${progress}%` : 'No goals'}
          </span>
        </div>
      </div>
    );
  };

  const suggestGoals = () => {
    console.log(`Opening create goal modal for ${metric}`);
    console.log('Current showCreateGoalModal state:', showCreateGoalModal);
    setShowCreateGoalModal(true);
    console.log('After setting showCreateGoalModal to true');
  };

  const handleGoalCreated = () => {
    console.log('Goal created successfully, refreshing data...');
    // Refresh the goals data and suggested goals
    queryClient.invalidateQueries({ queryKey: ['metric-details', metric] });
    queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
    queryClient.invalidateQueries({ queryKey: ['/api/goals/suggested'] });
    setShowCreateGoalModal(false);
    
    // Clear prefill data after successful creation
    // This will be passed up to the parent (Dashboard) to clear the prefillGoal state
    if (onClearDetailedView) {
      onClearDetailedView();
    }
    console.log('Modal closed after goal creation');
  };

  if (isLoading) {
    return (
      <div className="p-6 pb-24 max-w-md mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Safety check - ensure metricData exists and is an object
  if (!metricData || typeof metricData !== 'object') {
    return (
      <div className="p-6 pb-24 max-w-md mx-auto">
        <div className="text-center text-gray-600">
          <p>Loading metric data...</p>
        </div>
      </div>
    );
  }

  console.log('DetailedLifeOverview - Rendering with showCreateGoalModal:', showCreateGoalModal, 'metric:', metric);
  
  return (
    <div className="p-6 pb-24 max-w-4xl mx-auto">
      {/* Header with Ring Progress */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-4 text-green-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Overview
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Navigation buttons */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={navigateToPrevious}
                disabled={!canNavigateLeft}
                className="p-2 h-8 w-8"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={navigateToNext}
                disabled={!canNavigateRight}
                className="p-2 h-8 w-8"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Metric title and description */}
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">{metric}</h1>
              <p className="text-gray-600">
                Detailed view and progress tracking
              </p>
            </div>
          </div>
          
          {/* Progress ring */}
          <CircularProgress progress={circularProgressValue} color={colors.text} bgColor={colors.bg} hasGoals={true} />
        </div>
      </div>

      {/* Period Selector */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 overflow-x-auto">
          {periods.map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedPeriod(period);
                onPeriodChange?.(period);
              }}
              className="whitespace-nowrap"
            >
              {period}
            </Button>
          ))}
        </div>
        
      </div>

      {/* Debug Tool - Only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <h3 className="text-sm font-medium text-orange-800 mb-2">Snapshot Debug Tool</h3>
          <p className="text-xs text-orange-600">Debug tools are only available in development mode.</p>
        </div>
      )}

      {/* Time Availability (compact) */}
      <Card className="mb-4 shadow-sm border bg-white/70">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Clock className="w-4 h-4" />
              <span>Time availability</span>
              <span className="font-medium text-gray-900">{availabilityLabel[timeAvailability]}</span>
            </div>
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                {sliderMarks.map(m => (
                  <span key={m.key}>{availabilityLabel[m.key]}</span>
                ))}
              </div>
              <Slider
                className="h-4"
                value={[sliderMarks.findIndex(m => m.key === timeAvailability)]}
                max={3}
                step={1}
                onValueChange={(v) => {
                  const idx = Math.min(3, Math.max(0, v[0] ?? 0));
                  const selected = sliderMarks[idx].key;
                  // Optimistic update for responsiveness
                  setTimeAvailability(selected);
                }}
                onValueCommit={(v) => {
                  const idx = Math.min(3, Math.max(0, v[0] ?? 0));
                  const selected = sliderMarks[idx].key;
                  void updateTimeAvailability(selected);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goal Progress and Completions Chart */}
      <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span>Goal Progress and Completions</span>
              </CardTitle>
              
              {/* View Toggle for This Month - moved to chart header */}
              {selectedPeriod === "This Month" && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">View:</span>
                  <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={selectedView === 'daily' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setSelectedView('daily')}
                      className="h-7 px-2 text-xs"
                    >
                      Daily
                    </Button>
                    <Button
                      variant={selectedView === 'weekly' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setSelectedView('weekly')}
                      className="h-7 px-2 text-xs"
                    >
                      Weekly
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={validatedGraphData}>
              <XAxis 
                dataKey="period" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis 
                yAxisId="left"
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => Number.isInteger(value) ? `${value}` : ''}
                domain={[0, 'dataMax + 1']}
              />
              <Tooltip />
                <Line 
                yAxisId="left"
                  type="monotone" 
                dataKey="progressValue" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                name="Progress %"
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="completionValue" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                name="Completions"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Goals and Insights Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Your Goals */}
          <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <span>Your Goals</span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {goalsLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-600">Loading your goals...</div>
                </div>
              ) : goalsError ? (
                <div className="text-center py-8">
                  <div className="text-red-600">Failed to load goals. Please try again.</div>
                </div>
              ) : filteredGoals.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-600">No goals found for this life metric in the selected time period.</div>
                  <Button 
                    onClick={suggestGoals}
                    className="mt-4 bg-gradient-to-r from-green-500 to-green-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Goal for {metric}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {[...filteredGoals]
                    .sort((a: Goal, b: Goal) => (b.progress || 0) - (a.progress || 0)).map((goal: Goal) => {
                    const isCompleted = goal.status === 'completed';
                    
                    return (
                      <Card 
                        key={goal.id} 
                        className={`shadow-md border-0 backdrop-blur-sm cursor-pointer hover:shadow-lg transition-shadow ${
                          isCompleted
                            ? 'bg-green-50/80 border-green-200' 
                            : 'bg-white/80'
                        }`}
                        onClick={() => handleGoalClick(goal)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h3 className={`font-semibold ${isCompleted ? 'text-green-800' : 'text-gray-800'}`}>
                                  {goal.title}
                                </h3>
                                {isCompleted && (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                )}
                              </div>
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                style={{ backgroundColor: goal.lifeMetric.color + "20", color: goal.lifeMetric.color }}
                              >
                                {goal.lifeMetric.name}
                              </Badge>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                          
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Progress</span>
                            <span className={`text-sm font-bold ${isCompleted ? 'text-green-600' : 'text-green-600'}`}>
                              {goal.progress}%
                            </span>
                          </div>
                          <Progress value={goal.progress} className={isCompleted ? 'bg-green-100' : ''} />
                          
                          <div className="flex items-center justify-between mt-2">
                            {goal.targetDate && (
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500">
                                  Target: {new Date(goal.targetDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            
                            {isCompleted && goal.completedAt && (
                              <div className="flex items-center space-x-1">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                <span className="text-xs text-green-600">
                                  Completed: {new Date(goal.completedAt).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  
                  <Button 
                    onClick={suggestGoals}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Goal for {metric}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card className="shadow-md border-0 bg-gradient-to-r from-purple-50 to-pink-50">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <span>AI Insights</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {displayInsights.length > 0 ? (
                displayInsights.map((insight: any) => (
                  <InsightCard
                    key={insight.id}
                    id={insight.id}
                    title={insight.title}
                    explanation={insight.explanation || insight.description || ''}
                    confidence={insight.confidence || 0}
                    lifeMetrics={insight.lifeMetrics || []}
                    suggestedGoals={insight.suggestedGoals || []}
                    suggestedHabits={insight.suggestedHabits || []}
                    onVote={() => {}}
                    onFeedbackRecorded={() => {
                      try { queryClient.invalidateQueries({ queryKey: ['/api/feedback/status'] }); } catch {}
                    }}
                    feedbackContext={{ surface: 'metric_detail' }}
                    mode="compact"
                    initialVoted={feedbackStatus?.voted?.[insight.id] || false}
                    lastAction={feedbackStatus?.lastAction?.[insight.id] || null}
                    kind={insight.kind}
                    relatedTitle={insight.relatedTitle}
                  />
                ))
              ) : (
                <div className="text-sm text-gray-600">No insights for this metric.</div>
              )}
            </CardContent>
          </Card>
        </div>

    {/* Goal Detail Modal */}
    {selectedGoalDetails && (
      <GoalDetailModal
        isOpen={showGoalDetailModal}
        onClose={() => {
          setShowGoalDetailModal(false);
          setSelectedGoalDetails(null);
        }}
        goal={selectedGoalDetails}
        onUpdateProgress={handleUpdateProgress}
        onCompleteHabit={handleCompleteHabit}
        onAddHabit={handleAddHabit}
        onRemoveHabit={handleRemoveHabit}
      />
    )}

    {/* Create Goal Modal */}
    <CreateGoalModal
      isOpen={showCreateGoalModal}
      onClose={() => setShowCreateGoalModal(false)}
      onGoalCreated={handleGoalCreated}
      defaultLifeMetric={metric}
      prefillData={prefillGoal}
    />
  </div>
  );
};
