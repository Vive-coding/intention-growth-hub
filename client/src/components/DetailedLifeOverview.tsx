
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, Target, TrendingUp, Brain, Calendar, ChevronRight, CheckCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useMetricProgress } from "@/hooks/useMetricProgress";
import { Badge } from "@/components/ui/badge";
import { GoalDetailModal } from "./GoalDetailModal";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface DetailedLifeOverviewProps {
  metric: string;
  onBack: () => void;
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
  onNavigateHome?: () => void;
  onClearDetailedView?: () => void;
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

export const DetailedLifeOverview = ({ 
  metric, 
  onBack, 
  selectedPeriod: externalPeriod, 
  onPeriodChange, 
  onNavigateHome, 
  onClearDetailedView 
}: DetailedLifeOverviewProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState(externalPeriod || "This Month");
  const [showGoalDetailModal, setShowGoalDetailModal] = useState(false);
  const [selectedGoalDetails, setSelectedGoalDetails] = useState<Goal | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const periods = ["This Month", "Last 3 Months", "Last 6 Months", "This Year", "All Time"];

  // Use shared hook for consistent progress calculations
  const { data: progressData, isLoading: progressLoading } = useMetricProgress(metric, selectedPeriod);
  
  // Fetch goals for this specific metric
  const { data: goals = [], isLoading: goalsLoading, error: goalsError } = useQuery({
    queryKey: ['/api/goals', metric],
    queryFn: async () => {
      const response = await fetch(`/api/goals?metric=${encodeURIComponent(metric)}`, { 
        credentials: 'include' 
      });
      if (!response.ok) throw new Error('Failed to fetch goals');
      return response.json();
    },
    retry: 1,
  });

  // Handlers for goal interactions
  const handleGoalClick = async (goal: Goal) => {
    try {
      const response = await fetch(`/api/goals/${goal.id}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const goalDetails = await response.json();
        setSelectedGoalDetails(goalDetails);
        setShowGoalDetailModal(true);
      }
    } catch (error) {
      console.error('Error fetching goal details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load goal details.',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteHabit = async (habitId: string) => {
    try {
      const response = await fetch(`/api/goals/habits/${habitId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        toast({
          title: 'Habit completed!',
          description: 'Great job staying consistent.',
        });
      }
    } catch (error) {
      console.error('Error completing habit:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete habit.',
        variant: 'destructive',
      });
    }
  };

  const handleAddHabit = async (goalId: string, habit: any) => {
    try {
      const response = await fetch(`/api/goals/${goalId}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(habit),
      });
      if (response.ok) {
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
      const response = await fetch(`/api/goals/${goalId}/habits/${habitId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
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
      const response = await fetch(`/api/goals/${goalId}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ progress }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
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
        const goalsResponse = await fetch(`/api/goals?metric=${encodeURIComponent(metric)}`, { 
          credentials: 'include' 
        });
        const goals = goalsResponse.ok ? await goalsResponse.json() : [];

        // Fetch insights
        const insightsResponse = await fetch(`/api/insights?metric=${encodeURIComponent(metric)}`, { 
          credentials: 'include' 
        });
        const insights = insightsResponse.ok ? await insightsResponse.json() : [];

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

  // Generate chart data based on selected period - using exact same logic as dashboard
  const getGraphData = () => {
    if (!metricData || typeof metricData !== 'object') return [];

    // Use progress snapshots for all periods - no mock data
    const snapshots = metricData.progressSnapshots || [];
    
    if (selectedPeriod === "This Month") {
      // Generate weekly data points for current month
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Get the last week of the previous month
      const lastWeekOfPrevMonth = new Date(currentYear, currentMonth, 0);
      const lastWeekStart = new Date(lastWeekOfPrevMonth);
      lastWeekStart.setDate(lastWeekOfPrevMonth.getDate() - 6); // 7 days back
      
      // Get current goal progress for calculations
      const currentGoalProgress = goals && goals.length > 0 
        ? Math.round(goals.reduce((sum: number, goal: Goal) => sum + (goal.progress || 0), 0) / goals.length)
        : 0;
      
      // Generate weekly data points
      const weeklyData = [];
      
      // Last week of previous month (baseline)
      weeklyData.push({
        period: `Week ${Math.ceil(lastWeekStart.getDate() / 7)}`,
        progressValue: Math.max(0, currentGoalProgress - 5), // Slightly lower baseline
        completionValue: 0,
        isCurrent: false,
        isFuture: false,
        isHistorical: true
      });
      
      // Current week
      const currentWeek = Math.ceil(now.getDate() / 7);
      weeklyData.push({
        period: `Week ${currentWeek}`,
        progressValue: currentGoalProgress,
        completionValue: goals ? goals.filter((goal: Goal) => goal.status === 'completed').length : 0,
        isCurrent: true,
        isFuture: false,
        isHistorical: false
      });
      
      return weeklyData;
    } else {
      // For historical periods, use progress snapshots - same logic as dashboard
      let relevantSnapshots;
      switch (selectedPeriod) {
        case "Last 3 Months":
          relevantSnapshots = snapshots.slice(-3);
          break;
        case "Last 6 Months":
          relevantSnapshots = snapshots.slice(-6);
          break;
        case "This Year":
          const currentYear = new Date().getFullYear();
          relevantSnapshots = snapshots.filter((snapshot: any) => {
            const snapshotYear = parseInt(snapshot.monthYear.split('-')[0]);
            return snapshotYear === currentYear;
          });
          break;
        case "All Time":
          relevantSnapshots = snapshots;
          break;
        default:
          relevantSnapshots = snapshots.slice(-6);
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
      
      let relevantSnapshots;
      switch (selectedPeriod) {
        case "Last 3 Months":
          relevantSnapshots = snapshots.slice(-3);
          break;
        case "Last 6 Months":
          relevantSnapshots = snapshots.slice(-6);
          break;
        case "This Year":
          const currentYear = new Date().getFullYear();
          relevantSnapshots = snapshots.filter((snapshot: any) => {
            const snapshotYear = parseInt(snapshot.monthYear.split('-')[0]);
            return snapshotYear === currentYear;
          });
          break;
        case "All Time":
          relevantSnapshots = snapshots;
          break;
        default:
          relevantSnapshots = snapshots.slice(-6);
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
  console.log('metricData:', metricData);
  console.log('graphData:', graphData);
  console.log('circularProgressValue:', circularProgressValue);

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
  const getMetricColors = (name: string) => {
    const colorMap: Record<string, { text: string; bg: string }> = {
      "Health & Fitness": { text: "text-green-600", bg: "bg-green-100" },
      "Career Growth": { text: "text-blue-600", bg: "bg-blue-100" },
      "Personal Development": { text: "text-purple-600", bg: "bg-purple-100" },
      "Relationships": { text: "text-orange-600", bg: "bg-orange-100" },
      "Finance": { text: "text-red-600", bg: "bg-red-100" },
    "Mental Health": { text: "text-purple-600", bg: "bg-purple-100" },
    };
    return colorMap[name] || { text: "text-gray-600", bg: "bg-gray-100" };
  };

  const colors = getMetricColors(metric);

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
    console.log(`Suggesting new goals for ${metric}`);
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
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{metric}</h1>
            <p className="text-gray-600">
              Detailed view and progress tracking
            </p>
          </div>
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
              <CardTitle className="text-lg flex items-center space-x-2">
                <Target className="w-5 h-5 text-blue-600" />
                <span>Your Goals</span>
              </CardTitle>
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
                  {goals.map((goal: Goal) => {
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
            {Array.isArray(metricData?.insights) ? metricData.insights.filter((insight: any) => insight && (typeof insight === 'string' || typeof insight === 'object')).map((insight: any, index: number) => {
              // Ensure we're not rendering any objects directly
              let insightText = 'No insight available';
              if (typeof insight === 'string') {
                insightText = insight;
              } else if (typeof insight === 'object' && insight !== null) {
                insightText = typeof insight.title === 'string' ? insight.title :
                             typeof insight.description === 'string' ? insight.description :
                             'No insight available';
              }
                  
                  return (
                    <div key={index} className="p-3 bg-white/60 rounded-lg border-l-4 border-purple-400">
                  <p className="text-sm text-gray-700">{insightText}</p>
                </div>
              );
            }) : null}
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
  </div>
  );
};
