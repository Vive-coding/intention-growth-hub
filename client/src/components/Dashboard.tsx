
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { MessageCircle, Smile, TrendingUp, Star, Trophy, Target, Plus, CheckCircle, ThumbsUp, ThumbsDown, BookOpen, Flame, X, MoreVertical, ExternalLink, Lightbulb } from "lucide-react";
import { LifeMetricsDashboard } from "./LifeMetricsDashboard";
import { DetailedLifeOverview } from "./DetailedLifeOverview";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DashboardProps {
  onOpenGPT: () => void;
  onDetailedViewChange?: (isInDetailedView: boolean) => void;
  onClearDetailedView?: () => void;
}

export const Dashboard = ({ onOpenGPT, onDetailedViewChange, onClearDetailedView }: DashboardProps) => {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [journalContent, setJournalContent] = useState("");
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const typedUser = user as UserType | undefined;
  
  const currentTime = new Date().getHours();
  const greeting = currentTime < 12 ? "Good morning" : currentTime < 18 ? "Good afternoon" : "Good evening";
  const userName = typedUser?.firstName || 
                  (typedUser?.email?.split('@')[0]) || "there";

  // Save journal entry
  const handleSaveJournal = async () => {
    if (!journalContent.trim()) {
      alert("Please write something in your journal before saving.");
      return;
    }

    setIsSavingJournal(true);
    try {
      const response = await fetch('/api/journals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: `Journal Entry - ${new Date().toLocaleDateString()}`,
          content: journalContent,
          entryDate: new Date().toISOString(),
          mood: 'neutral',
          tags: [],
          isPrivate: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save journal entry');
      }

      const savedEntry = await response.json();
      console.log('Journal entry saved:', savedEntry);
      
      // Clear the journal content
      setJournalContent("");
      
      // Show success message
      alert("Journal entry saved successfully! The AI will analyze it and generate insights.");
      
      // Refresh the page to show new insights and suggestions
      window.location.reload();
    } catch (error) {
      console.error('Error saving journal entry:', error);
      alert('Failed to save journal entry. Please try again.');
    } finally {
      setIsSavingJournal(false);
    }
  };

  // Fetch recent insights
  const { data: insights = [], isLoading: insightsLoading, error: insightsError } = useQuery({
    queryKey: ['/api/insights'],
    queryFn: async () => {
      const response = await fetch('/api/insights', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch insights');
      return response.json();
    },
    retry: 1,
  });

  // Fetch goals
  const { data: goals = [], isLoading: goalsLoading, error: goalsError } = useQuery({
    queryKey: ['/api/goals'],
    queryFn: async () => {
      const response = await fetch('/api/goals', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch goals');
      return response.json();
    },
    retry: 1,
  });

  // Fetch habits
  const { data: habits = [], isLoading: habitsLoading, error: habitsError } = useQuery({
    queryKey: ['/api/goals/habits'],
    queryFn: async () => {
      const response = await fetch('/api/goals/habits', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch habits');
      return response.json();
    },
    retry: 1,
  });

  // Fetch suggested goals
  const { data: suggestedGoals = [], isLoading: suggestedGoalsLoading, error: suggestedGoalsError } = useQuery({
    queryKey: ['/api/goals/suggested'],
    queryFn: async () => {
      const response = await fetch('/api/goals/suggested', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch suggested goals');
      return response.json();
    },
    retry: 1,
  });

  // Fetch suggested habits
  const { data: suggestedHabits = [], isLoading: suggestedHabitsLoading, error: suggestedHabitsError } = useQuery({
    queryKey: ['/api/goals/habits/suggested'],
    queryFn: async () => {
      const response = await fetch('/api/goals/habits/suggested', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch suggested habits');
      return response.json();
    },
    retry: 1,
  });

  // Get recent insights (last 3)
  const recentInsights = insights.slice(0, 3);

  // Get suggested goals (last 3)
  const recentSuggestedGoals = suggestedGoals.slice(0, 3);

  // Get suggested habits (last 3)
  const recentSuggestedHabits = suggestedHabits.slice(0, 3);

  // Debug logging
  console.log('Dashboard data:', {
    insights: insights.length,
    goals: goals.length,
    habits: habits.length,
    suggestedGoals: suggestedGoals.length,
    suggestedHabits: suggestedHabits.length,
    recentInsights: recentInsights.length,
    recentSuggestedGoals: recentSuggestedGoals.length,
    recentSuggestedHabits: recentSuggestedHabits.length
  });

  // Get celebration items (habit streaks and goal completions)
  interface CelebrationItem {
    type: 'habit_streak' | 'goal_completion';
    title: string;
    description: string;
    icon: any;
    color: string;
  }
  
  const celebrationItems: CelebrationItem[] = [];
  
  // Add habit streaks
  habits.forEach((habit: any) => {
    if (habit.currentStreak >= 3) {
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

  // Generate smart suggestions
  const smartSuggestions = [];
  
  // Add suggestions based on insights
  if (recentInsights.length > 0) {
    smartSuggestions.push({
      type: 'insight_based',
      title: 'Based on your recent insights, try...',
      description: 'Morning journaling has improved your mood. Try adding a 5-minute reflection to your routine.',
      action: 'Add Morning Journal Habit',
      icon: TrendingUp,
      color: 'blue'
    });
  }

  // Add goal motivation
  const closeToCompletion = goals.filter((goal: any) => goal.progress >= 80 && goal.progress < 100);
  if (closeToCompletion.length > 0) {
    const goal = closeToCompletion[0];
    smartSuggestions.push({
      type: 'goal_motivation',
      title: `You're close to completing ${goal.title}!`,
      description: `You're ${goal.progress}% there. One more push to reach your goal!`,
      action: 'Update Progress',
      icon: Target,
      color: 'green'
    });
  }

  // Add habit streak motivation
  const atRiskHabits = habits.filter((habit: any) => habit.currentStreak > 0 && habit.currentStreak < 3);
  if (atRiskHabits.length > 0) {
    const habit = atRiskHabits[0];
    smartSuggestions.push({
      type: 'habit_reminder',
      title: `Your ${habit.title} streak is at risk!`,
      description: `Don't break your ${habit.currentStreak}-day streak. Complete it today!`,
      action: 'Complete Today',
      icon: Flame,
      color: 'orange'
    });
  }

  // Limit smart suggestions to 3
  const recentSmartSuggestions = smartSuggestions.slice(0, 3);

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
          onDetailedViewChange?.(false);
        }}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        onNavigateHome={() => {
          console.log('Home navigation clicked from detailed view');
          setSelectedMetric(null);
          onDetailedViewChange?.(false);
        }}
        onClearDetailedView={() => {
          console.log('Dashboard: Clearing detailed view via external call');
          setSelectedMetric(null);
          onDetailedViewChange?.(false);
        }}
      />
    );
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
            {greeting}, {userName}
          </h1>
          <p className="text-sm lg:text-base text-gray-600">
            Ready to reflect and grow today?
          </p>
        </div>

        {/* Mobile Layout: Single Column */}
        <div className="lg:hidden space-y-6">
          {/* Journal Chat Box - Mobile (Primary Action) */}
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-4">
            {/* Chat-like input box with buttons inside */}
            <div className="bg-white rounded-xl p-1.5">
              <div className="text-left mb-1.5">
                <textarea 
                  className="w-full h-24 p-1 border-0 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 text-gray-700 placeholder-gray-400 min-h-[6rem]"
                  placeholder="What's on your mind today? Share your thoughts, feelings, or experiences..."
                  style={{ minHeight: '6rem' }}
                  value={journalContent}
                  onChange={(e) => setJournalContent(e.target.value)}
                />
              </div>
              
              {/* Action buttons inside the chat box - right aligned and smaller */}
              <div className="flex gap-1 justify-end">
                <Button 
                  onClick={onOpenGPT}
                  className="bg-green-500 text-white hover:bg-green-600 py-0.5 px-1.5 rounded-lg font-semibold text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Chat with Life Coach
                </Button>
                <Button 
                  className="bg-purple-600 text-white hover:bg-purple-700 py-0.5 px-1.5 rounded-lg font-semibold text-xs"
                  onClick={handleSaveJournal}
                  disabled={isSavingJournal}
                >
                  {isSavingJournal ? "Saving..." : "Save Journal"}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Life Metrics Dashboard - Mobile */}
          <div className="w-full">
            <LifeMetricsDashboard 
              onMetricClick={setSelectedMetric}
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
            />
          </div>

          {/* Smart Suggestions - Mobile */}
          {smartSuggestions.length > 0 && (
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Smart Suggestions</h3>
                  <p className="text-xs text-gray-600">Top guidance to move forward</p>
                </div>
              </div>
              <div className="space-y-3">
                {smartSuggestions.map((suggestion: any, index: number) => (
                  <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-200 text-blue-800">
                        {suggestion.type === 'insight_based' ? 'Insight' : 'Motivation'}
                      </span>
                      <suggestion.icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-1 text-sm">{suggestion.title}</h4>
                    <p className="text-xs text-gray-600 mb-3">{suggestion.description}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      {suggestion.action}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
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
          ) : (recentSuggestedGoals.length > 0 || recentSuggestedHabits.length > 0) && (
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
                {recentSuggestedGoals.map((suggestedGoal: any) => (
                  <div key={`goal-${suggestedGoal.id}`} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-1 text-xs rounded-full bg-purple-200 text-purple-800">
                        Goal • {suggestedGoal.lifeMetric?.name || 'General'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {suggestedGoal.insight?.confidence || 85}% confident
                      </span>
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-1 text-sm">{suggestedGoal.title}</h4>
                    <p className="text-xs text-gray-600 mb-3">
                      {suggestedGoal.description || "AI-generated goal suggestion based on your patterns."}
                    </p>
                    <div className="flex items-center justify-end space-x-2">
                      <Button variant="ghost" size="sm" className="text-xs hover:bg-purple-100">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        Helpful
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs hover:bg-red-100">
                        <ThumbsDown className="w-3 h-3 mr-1" />
                        Not Helpful
                      </Button>
                    </div>
                  </div>
                ))}
                
                {/* Suggested Habits */}
                {recentSuggestedHabits.map((suggestedHabit: any) => (
                  <div key={`habit-${suggestedHabit.id}`} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-1 text-xs rounded-full bg-orange-200 text-orange-800">
                        Habit • {suggestedHabit.lifeMetric?.name || 'General'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {suggestedHabit.insight?.confidence || 85}% confident
                      </span>
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-1 text-sm">{suggestedHabit.title}</h4>
                    <p className="text-xs text-gray-600 mb-3">
                      {suggestedHabit.description || "AI-generated habit suggestion based on your patterns."}
                    </p>
                    <div className="flex items-center justify-end space-x-2">
                      <Button variant="ghost" size="sm" className="text-xs hover:bg-orange-100">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        Helpful
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs hover:bg-red-100">
                        <ThumbsDown className="w-3 h-3 mr-1" />
                        Not Helpful
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete Today's Habits - Mobile */}
          {habits.length > 0 && (
            <div className="bg-orange-600 rounded-lg p-4 text-center">
              <Flame className="w-6 h-6 mx-auto mb-2 text-white" />
              <p className="text-xs text-orange-100 mb-3">Track your daily progress and maintain streaks</p>
                                <Button 
                    className="w-full bg-white text-orange-600 hover:bg-orange-50 py-0.5 px-1.5 rounded-lg font-semibold text-xs"
                    onClick={() => setShowHabitModal(true)}
                  >
                    Complete Habits
                  </Button>
            </div>
          )}
        </div>

        {/* Desktop Layout: Two Column */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Left Column - Journal CTA and Life Metrics */}
          <div className="lg:col-span-8 space-y-6">
            {/* Journal Chat Box - Desktop (Primary Action) */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-6">
              {/* Chat-like input box with buttons inside */}
              <div className="bg-white rounded-xl p-2">
                <div className="text-left mb-2">
                  <textarea 
                    className="w-full h-32 p-1.5 border-0 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-purple-300 text-gray-700 placeholder-gray-400 text-base min-h-[8rem]"
                    placeholder="What's on your mind today? Share your thoughts, feelings, or experiences..."
                    style={{ minHeight: '8rem' }}
                    value={journalContent}
                    onChange={(e) => setJournalContent(e.target.value)}
                  />
                </div>
                
                {/* Action buttons inside the chat box - right aligned and smaller */}
                <div className="flex gap-1.5 justify-end">
                  <Button 
                    onClick={onOpenGPT}
                    className="bg-green-500 text-white hover:bg-green-600 py-0.75 px-2 rounded-lg font-semibold text-sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Chat with Life Coach
                  </Button>
                  <Button 
                    className="bg-purple-600 text-white hover:bg-purple-700 py-0.75 px-2 rounded-lg font-semibold text-sm"
                    onClick={handleSaveJournal}
                    disabled={isSavingJournal}
                  >
                    {isSavingJournal ? "Saving..." : "Save Journal"}
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Life Metrics Dashboard */}
            <div className="w-full">
              <LifeMetricsDashboard 
                onMetricClick={setSelectedMetric}
                selectedPeriod={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
              />
            </div>

            {/* Smart Suggestions - Desktop */}
            {smartSuggestions.length > 0 && (
              <div className="w-full">
                <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Lightbulb className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Smart Suggestions</h3>
                        <p className="text-sm text-gray-600">Top guidance to move forward</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {smartSuggestions.map((suggestion: any, index: number) => (
                        <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-200 text-blue-800">
                              {suggestion.type === 'insight_based' ? 'Insight' : 'Motivation'}
                            </span>
                            <suggestion.icon className="w-4 h-4 text-blue-600" />
                          </div>
                          <h4 className="font-semibold text-gray-800 mb-1 text-sm">{suggestion.title}</h4>
                          <p className="text-xs text-gray-600 mb-3">{suggestion.description}</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                          >
                            {suggestion.action}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>

          {/* Right Column - Insights, Suggested Goals, and Habits */}
          <div className="lg:col-span-4 lg:sticky lg:top-8 lg:h-fit space-y-6">
            {/* Recent Insights */}
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
                    <div className="text-red-600">Failed to load insights. Please try again.</div>
                  </div>
                </CardContent>
              </Card>
            ) : recentInsights.length > 0 && (
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
                      <div key={insight.id} className="p-3 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex flex-col gap-2 mb-3">
                          <div className="flex flex-wrap gap-2">
                            {insight.lifeMetrics && insight.lifeMetrics.length > 0 && (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-200 text-green-800">
                                {insight.lifeMetrics[0].name}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded self-start">
                            {insight.confidence}% confident
                          </span>
                        </div>
                        
                        <h4 className="font-semibold text-gray-800 mb-2 text-sm">{insight.content}</h4>
                        <p className="text-xs text-gray-600 mb-3">
                          {insight.description || "AI-generated insight based on your journal entries and activities."}
                        </p>
                        
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm" className="text-xs hover:bg-green-100">
                            <ThumbsUp className="w-3 h-3 mr-1" />
                            Helpful
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs hover:bg-red-100">
                            <ThumbsDown className="w-3 h-3 mr-1" />
                            Not Helpful
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suggested Goals and Habits */}
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
                    <div className="text-red-600">Failed to load suggestions</div>
                  </div>
                </CardContent>
              </Card>
            ) : (recentSuggestedGoals.length > 0 || recentSuggestedHabits.length > 0) && (
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
                  <div className="space-y-3">
                    {/* Suggested Goals */}
                    {recentSuggestedGoals.map((suggestedGoal: any) => (
                      <div key={`goal-${suggestedGoal.id}`} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-1 text-xs rounded-full bg-purple-200 text-purple-800">
                            Goal • {suggestedGoal.lifeMetric?.name || 'General'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {suggestedGoal.insight?.confidence || 85}% confident
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-800 mb-1 text-sm">{suggestedGoal.title}</h4>
                        <p className="text-xs text-gray-600 mb-3">
                          {suggestedGoal.description || "AI-generated goal suggestion based on your patterns."}
                        </p>
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm" className="text-xs hover:bg-purple-100">
                            <ThumbsUp className="w-3 h-3 mr-1" />
                            Helpful
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs hover:bg-red-100">
                            <ThumbsDown className="w-3 h-3 mr-1" />
                            Not Helpful
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Suggested Habits */}
                    {recentSuggestedHabits.map((suggestedHabit: any) => (
                      <div key={`habit-${suggestedHabit.id}`} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-1 text-xs rounded-full bg-orange-200 text-orange-800">
                            Habit • {suggestedHabit.lifeMetric?.name || 'General'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {suggestedHabit.insight?.confidence || 85}% confident
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-800 mb-1 text-sm">{suggestedHabit.title}</h4>
                        <p className="text-xs text-gray-600 mb-3">
                          {suggestedHabit.description || "AI-generated habit suggestion based on your patterns."}
                        </p>
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm" className="text-xs hover:bg-orange-100">
                            <ThumbsUp className="w-3 h-3 mr-1" />
                            Helpful
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs hover:bg-red-100">
                            <ThumbsDown className="w-3 h-3 mr-1" />
                            Not Helpful
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Complete Today's Habits */}
            {habits.length > 0 && (
              <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm mt-8">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <Flame className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Complete Habits</h3>
                      <p className="text-sm text-gray-600">Track your daily progress</p>
                    </div>
                  </div>
                  <Button 
                    className="w-full bg-orange-600 text-white hover:bg-orange-700 py-0.75 px-2 rounded-lg font-semibold text-sm"
                    onClick={() => setShowHabitModal(true)}
                  >
                    Complete Today's Habits
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Mobile Floating Action Button */}
        <div className="lg:hidden fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setShowMobileActions(!showMobileActions)}
            className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 shadow-lg"
          >
            <Plus className="w-6 h-6" />
          </Button>
          
          {/* Mobile Actions Menu */}
          {showMobileActions && (
            <div className="absolute bottom-16 right-0 space-y-2">
              {/* GPT Chat */}
              <Button
                onClick={() => {
                  setShowMobileActions(false);
                  onOpenGPT();
                }}
                className="w-12 h-12 rounded-full bg-green-600 hover:bg-green-700 shadow-lg flex items-center justify-center"
                title="GPT Chat"
              >
                <MessageCircle className="w-5 h-5" />
              </Button>
              
              {/* Write Journal */}
              <Button
                onClick={() => setShowMobileActions(false)}
                className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center"
                title="Write Journal"
              >
                <BookOpen className="w-5 h-5" />
              </Button>
              
              {/* Track Habits */}
              {habits.length > 0 && (
                <Button
                  onClick={() => {
                    setShowMobileActions(false);
                    setShowHabitModal(true);
                  }}
                  className="w-12 h-12 rounded-full bg-orange-600 hover:bg-orange-700 shadow-lg flex items-center justify-center"
                  title="Track Habits"
                >
                  <Flame className="w-5 h-5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Habit Completion Modal */}
      <Dialog open={showHabitModal} onOpenChange={setShowHabitModal}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-orange-600" />
              <span className="text-sm lg:text-base">Complete Today's Habits</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {habits.map((habit: any) => (
              <div key={habit.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-gray-800 text-sm lg:text-base truncate">{habit.title}</h4>
                    <p className="text-xs text-gray-600">
                      {habit.currentStreak} day streak • {habit.totalCompletions} total completions
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs flex-shrink-0 ml-2"
                >
                  Complete
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
