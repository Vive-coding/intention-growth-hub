
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
  const [showGoalDetailModal, setShowGoalDetailModal] = useState(false);
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);
  const [selectedGoalDetails, setSelectedGoalDetails] = useState<Goal | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  
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
    queryKey: ['/api/goals', metric, showCompleted],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('metric', metric);
      if (showCompleted) params.append('status', 'completed');
      
      const response = await apiRequest(`/api/goals?${params.toString()}`);
      return response;
    },
    retry: 1,
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
      // Build daily series from the start of the current week → today, filling gaps with 0s
      const dailyAll = (normalizedSnapshots || []).map((s: any) => ({
        date: new Date(s.snapshotDate || s.createdAt || Date.now()),
        progress: s.progressPercentage,
        completions: s.goalsCompleted,
      })).sort((a,b) => a.date.getTime() - b.date.getTime());

      const today = new Date();
      today.setHours(0,0,0,0);
      const weekdayMon0 = (today.getDay() + 6) % 7; // Mon=0..Sun=6
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - weekdayMon0);

      const isSameDay = (a: Date, b: Date) => {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
      };

      const latestRingLike = goals && goals.length > 0
        ? Math.round(goals.reduce((sum: number, goal: Goal) => sum + (goal.progress || 0), 0) / goals.length)
        : (metricData?.periodProgress?.progress || 0);

      const filledDaily: Array<{period:string;progressValue:number;completionValue:number;isCurrent:boolean;isFuture:boolean;isHistorical:boolean;}> = [];
      // Use today's ring only for today when there is no snapshot; do not backfill prior days
      const todayLocal = new Date();
      todayLocal.setHours(0,0,0,0);
      const dayCursor = new Date(weekStart);
      while (dayCursor.getTime() <= todayLocal.getTime()) {
        const found = dailyAll.find(d => isSameDay(d.date, dayCursor));
        const isToday = isSameDay(dayCursor, todayLocal);
        // For historical days: only show snapshot value; for today: show snapshot or ring
        let progressVal = 0;
        if (found) progressVal = found.progress;
        else if (isToday) progressVal = latestRingLike;
        const completionVal = found ? (found.completions || 0) : 0;
        filledDaily.push({
          period: dayCursor.toLocaleDateString('en-US', { weekday: 'short' }),
          progressValue: progressVal,
          completionValue: completionVal,
          isCurrent: isToday,
          isFuture: false,
          isHistorical: !isToday,
        });
        dayCursor.setDate(dayCursor.getDate() + 1);
      }

      // Build weekly aggregation for prior weeks (keep current week as daily)
      const weekKey = (d: Date) => {
        const tmp = new Date(d);
        const day = (tmp.getDay() + 6) % 7; // Mon=0..Sun=6
        tmp.setDate(tmp.getDate() - day);
        return `${tmp.getFullYear()}-${tmp.getMonth()+1}-${tmp.getDate()}`;
      };
      const byWeek = new Map<string, {sum:number,count:number,maxDate:Date,completions:number}>();
      dailyAll.forEach(d => {
        const key = weekKey(d.date);
        const cur = byWeek.get(key) || {sum:0,count:0,maxDate:d.date,completions:0};
        cur.sum += d.progress; cur.count += 1;
        if (d.date > cur.maxDate) cur.maxDate = d.date;
        cur.completions = Math.max(cur.completions, d.completions || 0);
        byWeek.set(key, cur);
      });
      const sortedWeeks = Array.from(byWeek.entries()).sort((a,b)=> new Date(a[0]).getTime() - new Date(b[0]).getTime());
      const weeklyExceptCurrent = sortedWeeks.slice(0, Math.max(0, sortedWeeks.length - 1)).map(([key, v]) => ({
        period: `W${new Date(key).getDate() <=7 ? 1 : new Date(key).getDate()<=14 ? 2 : new Date(key).getDate()<=21 ? 3 : 4}`,
        progressValue: Math.round(v.sum / v.count),
        completionValue: v.completions,
        isCurrent: false,
        isFuture:false,
        isHistorical: true,
      }));

      // If there are no prior weeks or no snapshots at all, just show the current week daily series
      if (weeklyExceptCurrent.length === 0) {
        return filledDaily;
      }

      // There are prior weeks: show weekly for history and a projected point for the current week
      const lastWeekKey = sortedWeeks[sortedWeeks.length - 1][0];
      const isSameWeek = (d: Date) => weekKey(d) === lastWeekKey;
      const currentWeekDays = dailyAll.filter(d => isSameWeek(d.date));
      const maxCompletionsWeek = currentWeekDays.reduce((acc, d) => Math.max(acc, d.completions || 0), 0);
      // Current week should reflect the live value (ring), not an average
      const projectedCurrentWeek = latestRingLike;
      const currentWeekPoint = {
        period: 'This Week',
        progressValue: projectedCurrentWeek,
        completionValue: maxCompletionsWeek,
        isCurrent: true,
        isFuture: false,
        isHistorical: false,
      };
      return [...weeklyExceptCurrent, currentWeekPoint];
    } else {
      // For historical periods, use progress snapshots - same logic as dashboard
      let relevantSnapshots;
      switch (selectedPeriod) {
        case "Last 3 Months":
          relevantSnapshots = normalizedSnapshots.slice(-3);
          break;
        case "Last 6 Months":
          relevantSnapshots = normalizedSnapshots.slice(-6);
          break;
        case "This Year":
          const currentYear = new Date().getFullYear();
          relevantSnapshots = normalizedSnapshots.filter((snapshot: any) => {
            const snapshotYear = parseInt(snapshot.monthYear.split('-')[0]);
            return snapshotYear === currentYear;
          });
          break;
        case "All Time":
          relevantSnapshots = normalizedSnapshots;
          break;
        default:
          relevantSnapshots = normalizedSnapshots.slice(-6);
      }
      
      // Deduplicate snapshots to fix X-axis
      const uniqueSnapshots = deduplicateSnapshots(relevantSnapshots);
      
      return uniqueSnapshots.map((snapshot: any, index: number) => {
        const monthLabel = formatMonthLabel(snapshot.monthYear);
        return {
          period: monthLabel,
          progressValue: snapshot.progressPercentage,
          completionValue: snapshot.goalsCompleted,
          isCurrent: index === uniqueSnapshots.length - 1,
          isFuture: false,
          isHistorical: false
        };
      });
    }
  };

  // Calculate circular progress value based on goal progress for the selected time period
  const getCircularProgressValue = () => {
    if (selectedPeriod === "This Month") {
      // For current month, calculate average of current goal progress
      if (!goals || goals.length === 0) return 0;
      
      const totalProgress = goals.reduce((sum: number, goal: Goal) => {
        return sum + (goal.progress || 0);
      }, 0);
      
      return Math.round(totalProgress / goals.length);
    } else {
      // For historical periods, use progress snapshots
      const snapshots = metricData?.progressSnapshots || [];
      
      if (snapshots.length === 0) return 0;
      
      // Normalize snapshot names for consistent processing
      const normalizedSnapshots = snapshots.map((s: any) => ({
        ...s,
        normalizedName: normalizeName(s.lifeMetricName || s.name || ''),
        originalName: s.lifeMetricName || s.name || ''
      }));
      
      let relevantSnapshots;
      switch (selectedPeriod) {
        case "Last 3 Months":
          relevantSnapshots = normalizedSnapshots.slice(-3);
          break;
        case "Last 6 Months":
          relevantSnapshots = normalizedSnapshots.slice(-6);
          break;
        case "This Year":
          const currentYear = new Date().getFullYear();
          relevantSnapshots = normalizedSnapshots.filter((snapshot: any) => {
            const snapshotYear = parseInt(snapshot.monthYear.split('-')[0]);
            return snapshotYear === currentYear;
          });
          break;
        case "All Time":
          relevantSnapshots = normalizedSnapshots;
          break;
        default:
          relevantSnapshots = normalizedSnapshots.slice(-6);
      }
      
      if (relevantSnapshots.length === 0) return 0;
      
      // Calculate average of progress percentages from snapshots
      const totalProgress = relevantSnapshots.reduce((sum: number, snapshot: any) => {
        return sum + (snapshot.progressPercentage || 0);
      }, 0);
      
      return Math.round(totalProgress / relevantSnapshots.length);
    }
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
            <CardTitle className="text-lg flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span>Goal Progress and Completions</span>
            </CardTitle>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className={showCompleted ? "bg-green-100 text-green-700" : ""}
                >
                  {showCompleted ? "Hide Completed" : "Show Completed"}
                </Button>
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
              ) : goals.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-600">No goals found for this life metric.</div>
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
                  {[...goals].sort((a: Goal, b: Goal) => (b.progress || 0) - (a.progress || 0)).map((goal: Goal) => {
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
