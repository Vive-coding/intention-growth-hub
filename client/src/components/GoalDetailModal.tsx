import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Edit, Plus, Flame, X, CheckCircle, Archive, Trash, ChevronDown, ChevronRight, Sparkles } from "lucide-react";

import { HabitCompletionProgress } from "./HabitCompletionProgress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { analytics } from "@/services/analyticsService";
import { apiRequest } from "@/lib/queryClient";

interface GoalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: {
    id: string;
    title: string;
    description?: string;
    progress: number;
    currentValue?: number;
    targetValue?: number;
    lifeMetric: {
      name: string;
      color: string;
    };
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
  };
  onUpdateProgress: (goalId: string, progress: number) => void;
  onCompleteHabit: (habitId: string) => void;
  onRemoveHabit: (goalId: string, habitId: string) => void;
  onAddHabit: (goalId: string, habit: any) => void;
  isInFocus?: boolean;
}

export const GoalDetailModal = ({
  isOpen,
  onClose,
  goal,
  onUpdateProgress,
  onCompleteHabit,
  onRemoveHabit,
  onAddHabit,
  isInFocus = false,
}: GoalDetailModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State to hold the current goal data (can be updated independently of props)
  const [currentGoalData, setCurrentGoalData] = useState(goal);
  
  // Function to refresh goal data
  const refreshGoalData = async () => {
    try {
      console.log('🟣 GoalDetailModal - Refreshing goal data for ID:', goalData.id);
      const refreshedGoal = await apiRequest(`/api/goals/${goalData.id}`);
      setCurrentGoalData(refreshedGoal);
      console.log('🟣 GoalDetailModal - Goal data refreshed:', refreshedGoal);
    } catch (error) {
      console.error('🟣 GoalDetailModal - Failed to refresh goal data:', error);
    }
  };
  
  // Update currentGoalData when goal prop changes
  useEffect(() => {
    setCurrentGoalData(goal);
  }, [goal]);
  
    // Handle the actual API response structure
  const goalData = currentGoalData.goalInstance
    ? {
        id: currentGoalData.goalInstance.id,
        title: currentGoalData.goalDefinition?.title || "Untitled Goal",
        description: currentGoalData.goalDefinition?.description || "",
        progress: currentGoalData.goalInstance.currentValue || 0, // currentValue is now stored as percentage
        currentValue: currentGoalData.goalInstance.currentValue,
        targetValue: currentGoalData.goalInstance.targetValue,
        targetDate: currentGoalData.goalInstance.targetDate, // Include target date
        term: (currentGoalData as any).term ?? null,
        lifeMetric:
          currentGoalData.lifeMetric || {
            name: currentGoalData.goalDefinition?.category || "General",
            color: "#6B7280",
          },
        habits: currentGoalData.habits || [],
      }
    : {
        ...currentGoalData,
        habits: currentGoalData.habits || [],
      };

  console.log('Goal data:', goalData);
  console.log('Associated habits:', goalData.habits);
  console.log('Goal ID:', goalData.id);
  if (goalData.habits && goalData.habits.length > 0) {
    console.log('Sample habit structure:', goalData.habits[0]);
  }

  const [progress, setProgress] = useState(goalData.progress);
  // Split habit vs manual so users can see the adjustment that explains the number
  const habitAverage = (() => {
    if (!Array.isArray(goalData.habits) || goalData.habits.length === 0) return 0;
    const total = goalData.habits.reduce((sum: number, h: any) => {
      const target = Number(h.targetValue || 0);
      const cur = Number(h.currentValue || 0);
      const pct = target > 0 ? Math.min((cur / target) * 100, 100) : 0;
      return sum + pct;
    }, 0);
    return Math.min(90, total / goalData.habits.length);
  })();
  const manualOffset = Math.round((progress || 0) - habitAverage);
  const [showAddHabitPanel, setShowAddHabitPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  
  // Add habit panel state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHabits, setSelectedHabits] = useState<any[]>([]);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [newHabitDescription, setNewHabitDescription] = useState("");
  const [newHabitCategory, setNewHabitCategory] = useState(goalData.lifeMetric.name);
  const [newHabitFrequency, setNewHabitFrequency] = useState("daily");
  const [newHabitTargetCompletions, setNewHabitTargetCompletions] = useState(1);
  const [newHabitPeriods, setNewHabitPeriods] = useState(1);
  const [newHabitWeekdaysOnly, setNewHabitWeekdaysOnly] = useState(false);
  const [existingHabitFrequency, setExistingHabitFrequency] = useState("daily");
  const [existingHabitPerPeriod, setExistingHabitPerPeriod] = useState(1);
  const [existingHabitPeriods, setExistingHabitPeriods] = useState(1);
  const [activeTab, setActiveTab] = useState("select");
  const [targetValue, setTargetValue] = useState(1);
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);
  const [showBrowseAll, setShowBrowseAll] = useState(false);
  const [suggestingMore, setSuggestingMore] = useState(false);
  const [showTargetSetting, setShowTargetSetting] = useState(false);
  const [habitTargets, setHabitTargets] = useState<{[habitId: string]: {frequency: string; perPeriodTarget: number; periodsCount: number}}>({});
  const [newSuggestionsCount, setNewSuggestionsCount] = useState(0);
  const [newSuggestedHabits, setNewSuggestedHabits] = useState<any[]>([]);
  const [showNewSuggestions, setShowNewSuggestions] = useState(false);
  
  // Calculate periods based on goal target date and frequency
  const calculatePeriodsFromTargetDate = (frequency: string, weekdaysOnly: boolean = false) => {
    if (!goalData.targetDate) return 1;
    const targetDate = new Date(goalData.targetDate);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    switch (frequency) {
      case 'daily':
        if (weekdaysOnly) {
          // Count only weekdays between today and target date
          let weekdayCount = 0;
          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          for (let i = 0; i < diffDays; i++) {
            const d = new Date(todayMidnight.getTime());
            d.setDate(todayMidnight.getDate() + i);
            const day = d.getDay(); // 0 = Sun, 6 = Sat
            if (day !== 0 && day !== 6) {
              weekdayCount++;
            }
          }
          return Math.max(1, weekdayCount);
        }
        return Math.max(1, diffDays);
      case 'weekly':
        return Math.max(1, Math.ceil(diffDays / 7));
      case 'monthly':
        return Math.max(1, Math.ceil(diffDays / 30));
      default:
        return Math.max(1, diffDays);
    }
  };
  
  // Auto-set periods when frequency changes (if goal has target date)
  useEffect(() => {
    if (goalData.targetDate) {
      const calculatedPeriods = calculatePeriodsFromTargetDate(newHabitFrequency, newHabitWeekdaysOnly);
      setNewHabitPeriods(calculatedPeriods);
    }
  }, [newHabitFrequency, newHabitWeekdaysOnly, goalData.targetDate]);
  
  useEffect(() => {
    if (goalData.targetDate) {
      const calculatedPeriods = calculatePeriodsFromTargetDate(existingHabitFrequency);
      setExistingHabitPeriods(calculatedPeriods);
    }
  }, [existingHabitFrequency, goalData.targetDate]);
  
  // Edit goal panel state
  const [editTitle, setEditTitle] = useState(goalData.title);
  const [editDescription, setEditDescription] = useState(goalData.description || "");
  // Initialize with empty string - will be set once lifeMetrics loads
  const [editLifeMetricId, setEditLifeMetricId] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editTerm, setEditTerm] = useState<'short' | 'mid' | 'long' | 'backlog'>(
    (goalData as any).term ?? 'backlog'
  );
  const [showTermDropdown, setShowTermDropdown] = useState(false);
  
  // Update progress when goal data changes
  useEffect(() => {
    setProgress(goalData.progress);
  }, [goalData.progress]);
  
  // Initialize edit form when goal data changes (but not when edit panel is open)
  useEffect(() => {
    if (!showEditPanel) {
      console.log('Initializing edit form with fresh goal data:', goalData);
      setEditTitle(goalData.title);
      setEditDescription(goalData.description || "");
      
      // Life metric ID will be set by the useEffect below that watches lifeMetrics
      
      if (goalData.targetDate) {
        const date = new Date(goalData.targetDate);
        const formattedDate = date.toISOString().split('T')[0];
        setEditTargetDate(formattedDate);
      } else {
        setEditTargetDate("");
      }
    }
  }, [goalData, showEditPanel]);

  // Fetch existing habits (auth-aware)
  const { data: existingHabits = [], isLoading } = useQuery({
    queryKey: ['/api/goals/habits/all'],
    queryFn: async () => {
      const habits = await apiRequest('/api/goals/habits/all');
      // Only sort to surface not-yet-added habits first; no recommendation labels
      return [...habits].sort((a: any, b: any) => {
        const aAdded = goalData.habits?.some((h: any) => h.id === a.id) ? 1 : 0;
        const bAdded = goalData.habits?.some((h: any) => h.id === b.id) ? 1 : 0;
        return aAdded - bAdded;
      });
    },
    retry: 1,
  });

  // Recommended habits for this goal (semantic)
  const { data: recommendedHabits = [] } = useQuery({
    queryKey: ['/api/goals', goalData.id, 'habits', 'recommendations'],
    queryFn: async () => {
      return apiRequest(`/api/goals/${goalData.id}/habits/recommendations?limit=5`);
    },
    retry: 1,
  });

  // Dashboard suggested habits (global suggestions)
  const { data: dashboardSuggestedHabits = [] } = useQuery({
    queryKey: ['/api/goals/habits/suggested'],
    queryFn: async () => {
      return apiRequest('/api/goals/habits/suggested');
    },
    retry: 1,
  });
  
  // Fetch life metrics for edit form
  const { data: lifeMetrics = [] } = useQuery({
    queryKey: ['/api/life-metrics'],
    queryFn: async () => {
      return apiRequest('/api/life-metrics');
    },
    retry: 1, // Always fetch life metrics, not just when edit panel is open
  });
  
  useEffect(() => {
    if (isOpen && lifeMetrics.length > 0 && goalData.lifeMetric?.name) {
      const currentLifeMetric = lifeMetrics.find(
        (metric: any) => metric.name === goalData.lifeMetric.name
      );
      if (currentLifeMetric && editLifeMetricId !== currentLifeMetric.id) {
        setEditLifeMetricId(currentLifeMetric.id);
        console.log(
          "✅ Initialized life metric ID:",
          currentLifeMetric.id,
          "for",
          goalData.lifeMetric.name
        );
      }
      // If we couldn't find an exact match, don't change lifeMetricId.
      // This avoids accidentally resetting the life metric to a fallback value.
    } else if (isOpen) {
      // Ensure we don't reuse any stale ID when we can't confidently resolve it
      setEditLifeMetricId("");
    }
  }, [isOpen, lifeMetrics, goalData.lifeMetric?.name, editLifeMetricId]);
  
  // Initialize edit form when edit panel opens for the first time
  useEffect(() => {
    if (showEditPanel) {
      console.log('Edit panel opened, initializing form with:', goalData);
      console.log('Available life metrics:', lifeMetrics);
      
      // Set basic fields
      setEditTitle(goalData.title);
      setEditDescription(goalData.description || "");
      
      // Set target date
      if (goalData.targetDate) {
        console.log('Raw targetDate from goalData:', goalData.targetDate, typeof goalData.targetDate);
        const date = new Date(goalData.targetDate);
        console.log('Parsed date object:', date);
        console.log('Is valid date?', !isNaN(date.getTime()));
        
        if (!isNaN(date.getTime())) {
          const formattedDate = date.toISOString().split('T')[0];
          setEditTargetDate(formattedDate);
          console.log('✅ Set target date to:', formattedDate);
          console.log('Display date would be:', date.toLocaleDateString());
        } else {
          console.warn('❌ Invalid date format:', goalData.targetDate);
          setEditTargetDate("");
        }
      } else {
        setEditTargetDate("");
        console.log('No target date, setting to empty');
      }
      setEditTerm((goalData as any).term ?? 'backlog');
      // Reset showTermDropdown when panel opens
      setShowTermDropdown(false);
      
      // Set life metric only if we find an exact name match.
      if (lifeMetrics.length > 0 && goalData.lifeMetric?.name) {
        console.log("Searching for life metric:", goalData.lifeMetric.name);
        console.log(
          "Available life metrics:",
          lifeMetrics.map((m: any) => ({ id: m.id, name: m.name }))
        );

        const currentLifeMetric = lifeMetrics.find(
          (metric: any) => metric.name === goalData.lifeMetric.name
        );

        if (currentLifeMetric) {
          setEditLifeMetricId(currentLifeMetric.id);
          console.log(
            "✅ Set life metric to:",
            currentLifeMetric.id,
            currentLifeMetric.name
          );
        } else {
          console.warn(
            "❌ Could not find life metric for:",
            goalData.lifeMetric.name
          );
          console.log("Full goalData.lifeMetric:", goalData.lifeMetric);
          // Leave editLifeMetricId as-is so we don't change the life metric on save.
        }
      } else {
        console.warn("No life metrics available yet or missing goalData.lifeMetric.name");
      }
    }
  }, [showEditPanel, lifeMetrics]); // Trigger when panel opens OR when life metrics are loaded

  const handleProgressUpdate = async () => {
    try {
      const response = await apiRequest(`/api/goals/${goalData.id}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ currentValue: progress }),
      });
      
      if (response) {
        console.log('Goal progress updated:', response);
        toast({
          title: 'Progress updated',
          description: 'Your goal progress has been updated successfully.',
        });
        
        // Invalidate all goal-related queries to refresh data immediately
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        queryClient.invalidateQueries({ queryKey: ['/api/goal-instances'] });
        queryClient.invalidateQueries({ queryKey: ['/api/life-metrics/progress'] });
        
        // Update local state to reflect the change immediately
        try {
          const updatedGoalResponse = await apiRequest(`/api/goals/${goalData.id}`);
          console.log('Goal data refreshed after progress update:', updatedGoalResponse);
          
          if (updatedGoalResponse.progress !== undefined) {
            setProgress(updatedGoalResponse.progress);
          }
        } catch (error) {
          console.error('Error refreshing goal data after progress update:', error);
        }
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      toast({
        title: 'Failed to update progress',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const suggestMoreHabits = async () => {
    setSuggestingMore(true);
    try {
      // Trigger new habit suggestions for this goal
      const response = await apiRequest(`/api/goals/${goalData.id}/habits/suggest-more`, {
        method: 'POST',
        body: JSON.stringify({ goalId: goalData.id })
      });
      
      // Refresh both recommendations and dashboard suggestions
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/goals', goalData.id, 'habits', 'recommendations'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/goals/habits/suggested'] })
      ]);
      
      // Store new suggested habits
      const newHabits = response?.suggestions || [];
      setNewSuggestedHabits(newHabits);
      setNewSuggestionsCount(newHabits.length);
      setShowNewSuggestions(false); // Hide them initially, show button instead
      
      toast({
        title: "New habits suggested!",
        description: `${newHabits.length} new habits ready to view.`,
      });
    } catch (error) {
      console.error("Error suggesting more habits:", error);
      toast({
        title: "Error",
        description: "Failed to generate new habit suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSuggestingMore(false);
    }
  };

  const viewNewSuggestions = () => {
    setShowNewSuggestions(true);
    setNewSuggestionsCount(0); // Hide the "View X new" button after viewing
  };

  const handleManualComplete = async () => {
    try {
      const response = await apiRequest(`/api/goals/${goalData.id}/complete`, {
        method: 'POST',
      });
      
      if (response) {
        // Track goal completion
        analytics.trackGoalCompleted(goalData.id, {
          goal_title: goalData.title,
          life_metric: goalData.lifeMetric?.name,
          completion_time: new Date().toISOString(),
          final_progress: 100,
        });
        
        // Update local progress to 100%
        setProgress(100);
        toast({
          title: 'Goal completed successfully!',
          description: 'Your goal has been marked as completed.',
        });
        
        // Invalidate queries to refresh all goal data
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        
        // Refresh goal data to show completed status
        setTimeout(async () => {
          try {
            const updatedGoal = await apiRequest(`/api/goals/${goalData.id}`);
            console.log('Goal completed and refreshed:', updatedGoal);
          } catch (error) {
            console.error('Error refreshing goal data after completion:', error);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error completing goal:', error);
      toast({
        title: 'Failed to complete goal',
        description: 'Could not mark goal as completed.',
        variant: 'destructive',
      });
    }
  };

  const handleEditGoal = async () => {
    if (!editTitle?.trim()) {
      toast({
        title: 'Error',
        description: 'Goal title is required.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const updates: any = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        // Only include lifeMetricId if we have a valid value, otherwise omit to keep existing
        ...(editLifeMetricId ? { lifeMetricId: editLifeMetricId } : {}),
        targetDate: editTargetDate || null,
        term: editTerm === 'backlog' ? null : editTerm,
      };
      
      console.log('Saving goal updates:', updates);
      console.log('Current editLifeMetricId:', editLifeMetricId);
      console.log('Original goal life metric:', goalData.lifeMetric);
      
      const response = await apiRequest(`/api/goals/${goalData.id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      
      if (response) {
        console.log('Goal updated successfully:', response);
        toast({
          title: 'Goal updated',
          description: 'Your goal has been updated successfully.',
        });
        
        // Invalidate and refetch goal data first
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        
        // Force immediate refresh of this specific goal
        try {
          const updatedGoalResponse = await apiRequest(`/api/goals/${goalData.id}`);
          console.log('Goal data refreshed after edit:', updatedGoalResponse);
          
          // Update any local state if needed
          if (updatedGoalResponse.progress !== undefined) {
            setProgress(updatedGoalResponse.progress);
          }
          
          // Close the edit panel after data is refreshed and form will be properly re-initialized
          setShowEditPanel(false);
        } catch (error) {
          console.error('Error refreshing goal data after edit:', error);
          // Still close the panel even if refresh fails
          setShowEditPanel(false);
        }
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      toast({
        title: 'Failed to update goal',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleArchiveGoal = async () => {
    try {
      console.log('🗄️ Starting archive process for goal:', goalData.id);
      console.log('🔑 Token status:', localStorage.getItem("token") ? 'PRESENT' : 'MISSING');
      
      const response = await apiRequest(`/api/goals/${goalData.id}/archive`, {
        method: 'POST',
      });

      console.log('✅ Archive response:', response);

      if (response) {
        toast({
          title: 'Goal archived!',
          description: 'Goal has been archived and removed from active view.',
        });
        
        // Refresh goal data
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        onClose();
      }
    } catch (error) {
      console.error('❌ Error archiving goal:', error);
      console.error('❌ Error details:', {
        message: (error as any)?.message,
        status: (error as any)?.status,
        data: (error as any)?.data
      });
      toast({
        title: 'Error',
        description: 'Failed to archive goal.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteGoal = async () => {
    try {
      const confirmed = window.confirm('Delete this goal permanently? This will remove its instances and associations.');
      if (!confirmed) return;
      await apiRequest(`/api/goals/${goalData.id}`, { method: 'DELETE' });
      toast({ title: 'Goal deleted', description: 'The goal was removed.' });
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      onClose();
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast({ title: 'Failed to delete goal', description: 'Please try again.', variant: 'destructive' });
    }
  };



  // Track habit completion state to prevent double clicks
  const [completingHabits, setCompletingHabits] = useState<Set<string>>(new Set());

  // Handle habit completion with refresh
  const handleHabitComplete = async (habitId: string) => {
    // Prevent double completion
    if (completingHabits.has(habitId)) {
      console.log('Habit completion already in progress for:', habitId);
      return;
    }
    
    // Add to completing set
    setCompletingHabits(prev => new Set(prev.add(habitId)));
    
    try {
      // Complete the habit with goal context
      const response = await apiRequest(`/api/goals/habits/${habitId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          goalId: goalData.id, // Include goal ID for progress tracking
          completedAt: new Date().toISOString(),
        }),
      });
      
      if (response) {
        console.log('Habit completed successfully:', response);
        
        toast({
          title: 'Habit completed!',
          description: 'Great job staying consistent.',
        });
        
        // Invalidate all goal-related queries to refresh data and update UI immediately
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        queryClient.invalidateQueries({ queryKey: ['/api/goal-instances'] });
        queryClient.invalidateQueries({ queryKey: ['/api/goals/habits/today'] });
        queryClient.invalidateQueries({ queryKey: ['/api/goals/habits/completed-today'] });
        queryClient.invalidateQueries({ queryKey: ['/api/life-metrics/progress'] });
        queryClient.invalidateQueries({ queryKey: ['metric-progress'] });
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        queryClient.invalidateQueries({ queryKey: ['/api/smart-suggestions'] });
        
        // Optimistically update progress by refetching immediately
        try {
          const updatedGoalResponse = await apiRequest(`/api/goals/${goalData.id}`);
          console.log('Goal data refreshed after habit completion:', updatedGoalResponse);
          
          // Update the local state to reflect the new progress immediately
          const calculatedProgress = updatedGoalResponse.progress || 0;
          setProgress(calculatedProgress);
        } catch (error) {
          console.error('Error refreshing goal data:', error);
        }
      }
    } catch (error) {
      console.error('Error completing habit:', error);
      
      // Check if it's a duplicate completion error
      const errorMessage = (error as any)?.message || '';
      if (errorMessage.includes('already completed today')) {
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
    } finally {
      // Remove from completing set
      setCompletingHabits(prev => {
        const newSet = new Set(prev);
        newSet.delete(habitId);
        return newSet;
      });
    }
  };

  const handleAddHabit = async () => {
    try {
      console.log('Goal ID:', goalData.id);
      console.log('Goal object:', goalData);
      
      if (activeTab === "select") {
        if (selectedHabitIds.length === 0) {
          alert("Please select at least one habit");
          return;
        }
        
        console.log('Adding existing habits:', selectedHabitIds, 'to goal:', goalData.id);
        
        // Add multiple habits
        const promises = selectedHabitIds.map(async (habitId) => {
        const response = await apiRequest(`/api/goals/${goalData.id}/habits`, {
          method: 'POST',
          body: JSON.stringify({
              habitDefinitionId: habitId,
            targetValue: targetValue,
            frequencySettings: {
              frequency: existingHabitFrequency,
              perPeriodTarget: existingHabitPerPeriod,
              periodsCount: existingHabitPeriods,
            },
          }),
          });
          return response;
        });
        
        const responses = await Promise.all(promises);
        
        console.log('Added existing habits to goal:', responses);
        
        toast({
          title: 'Habits added successfully!',
          description: `${selectedHabitIds.length} habit(s) have been added to your goal.`,
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        
        // Call the parent's onAddHabit function for each habit
        selectedHabitIds.forEach((habitId) => {
          const selectedHabit = existingHabits.find((h: any) => h.id === habitId);
        if (selectedHabit) {
          const calculatedTargetValue = existingHabitPerPeriod * existingHabitPeriods;
          console.log('🟣 Adding existing habit with calculated values:', {
            habitId: selectedHabit.id,
            habitTitle: selectedHabit.title,
            perPeriodTarget: existingHabitPerPeriod,
            periodsCount: existingHabitPeriods,
            calculatedTargetValue,
            frequency: existingHabitFrequency
          });
                  onAddHabit(goalData.id, {
          habitDefinitionId: selectedHabit.id,
          targetValue: calculatedTargetValue,
          frequencySettings: {
            frequency: existingHabitFrequency,
            perPeriodTarget: existingHabitPerPeriod,
            periodsCount: existingHabitPeriods,
          },
        });
          }
        });
        
        // Wait a moment for the parent to process, then refresh the goal data
        setTimeout(async () => {
          await refreshGoalData();
        }, 100);
        
      } else if (activeTab === "create") {
        if (!newHabitTitle.trim()) {
          alert("Please enter a habit title");
          return;
        }
        
        console.log('Creating new habit for goal:', goalData.id);
        
        // First create the habit
        const createResponse = await apiRequest('/api/goals/habits', {
          method: 'POST',
          body: JSON.stringify({
            title: newHabitTitle,
            description: newHabitDescription,
            frequency: newHabitFrequency,
            targetCompletions: newHabitTargetCompletions,
          }),
        });
        
        console.log('Created new habit:', createResponse);
        
        // Add it to the goal through the callback (no duplicate API call)
        const calculatedTargetValue = newHabitTargetCompletions * newHabitPeriods;
        console.log('🟣 Adding new habit with calculated values:', {
          habitId: createResponse.id,
          habitTitle: newHabitTitle,
          perPeriodTarget: newHabitTargetCompletions,
          periodsCount: newHabitPeriods,
          calculatedTargetValue,
          frequency: newHabitFrequency
        });
        onAddHabit(goalData.id, {
          habitDefinitionId: createResponse.id,
          targetValue: calculatedTargetValue,
          frequencySettings: {
          frequency: newHabitFrequency,
          perPeriodTarget: newHabitTargetCompletions,
          periodsCount: newHabitPeriods,
          ...(newHabitFrequency === 'daily' && newHabitWeekdaysOnly ? { weekdaysOnly: true } : {}),
          },
        });
        
        // Wait a moment for the parent to process, then refresh the goal data
        setTimeout(async () => {
          await refreshGoalData();
        }, 100);
        
        toast({
          title: 'Habit added successfully!',
          description: 'The habit has been added to your goal.',
        });
      }
      
      // Reset form and close panel
      setSelectedHabitIds([]);
      setNewHabitTitle("");
      setNewHabitDescription("");
      setNewHabitFrequency("daily");
      setNewHabitTargetCompletions(1);
      setNewHabitPeriods(1);
      setExistingHabitFrequency("daily");
      setExistingHabitPerPeriod(1);
      setExistingHabitPeriods(1);
      setTargetValue(1);
      setSearchTerm("");
      setShowAddHabitPanel(false);
      setShowBrowseAll(false);
      setShowTargetSetting(false);
      setHabitTargets({});
      
    } catch (error) {
      console.error('Error adding habit:', error);
      toast({
        title: 'Failed to add habit',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAddHabitWithTargets = async () => {
    try {
      console.log('Adding habits with individual targets:', selectedHabitIds, habitTargets);
      
      // Add multiple habits with their individual targets
      const promises = selectedHabitIds.map(async (habitId) => {
        const targets = habitTargets[habitId];
        if (!targets) return;
        
        console.log('Adding habit:', habitId, 'with targets:', targets);
        
        const response = await apiRequest(`/api/goals/${goalData.id}/habits`, {
          method: 'POST',
          body: JSON.stringify({
            habitDefinitionId: habitId,
            targetValue: targets.perPeriodTarget * targets.periodsCount,
            frequencySettings: {
              frequency: targets.frequency,
              perPeriodTarget: targets.perPeriodTarget,
              periodsCount: targets.periodsCount,
            },
          }),
        });
        
        return response;
      });
      
      const responses = await Promise.all(promises);
      console.log('Added habits with targets:', responses);
      
      toast({
        title: 'Habits added successfully!',
        description: `${selectedHabitIds.length} habit(s) have been added to your goal with individual targets.`,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      
      // Call the parent's onAddHabit function for each habit
      selectedHabitIds.forEach((habitId) => {
        const targets = habitTargets[habitId];
        if (!targets) return;
        
        const selectedHabit = existingHabits.find((h: any) => h.id === habitId) ||
                             recommendedHabits.find((h: any) => h.id === habitId) ||
                             dashboardSuggestedHabits.find((h: any) => h.id === habitId);
        
        if (selectedHabit) {
          const calculatedTargetValue = targets.perPeriodTarget * targets.periodsCount;
          console.log('🟣 Adding habit with calculated values:', {
            habitId: selectedHabit.id,
            habitTitle: selectedHabit.title || selectedHabit.name,
            perPeriodTarget: targets.perPeriodTarget,
            periodsCount: targets.periodsCount,
            calculatedTargetValue,
            frequency: targets.frequency
          });
          onAddHabit(goalData.id, {
            habitDefinitionId: selectedHabit.id,
            targetValue: calculatedTargetValue,
            frequencySettings: {
              frequency: targets.frequency,
              perPeriodTarget: targets.perPeriodTarget,
              periodsCount: targets.periodsCount,
            },
          });
        }
      });
      
      // Wait a moment for the parent to process, then refresh the goal data
      setTimeout(async () => {
        await refreshGoalData();
      }, 100);
      
      // Close the modal and reset state
      setShowTargetSetting(false);
      setShowAddHabitPanel(false);
      setSelectedHabitIds([]);
      setHabitTargets({});
      setShowBrowseAll(false);
      
    } catch (error) {
      console.error('Error adding habits with targets:', error);
      toast({
        title: 'Error',
        description: 'Failed to add habits. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getProgressMessage = (progress: number) => {
    if (progress >= 100) return "Congratulations! Goal completed!";
    if (progress >= 80) return "You're doing great! Keep up the momentum.";
    if (progress >= 50) return "Good progress! You're halfway there.";
    if (progress >= 25) return "Getting started! Every step counts.";
    return "Just beginning! You've got this.";
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl w-11/12 max-h-[90vh] overflow-y-auto overflow-x-hidden">
          {/* Main Goal Content */}
          <div className={`transition-transform duration-300 overflow-x-hidden ${showAddHabitPanel || showEditPanel ? '-translate-x-full' : 'translate-x-0'}`}>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="p-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-500">Back to Goals</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <DialogTitle className="text-xl font-bold flex-1">{goalData.title}</DialogTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-1 ml-2 shrink-0"
                  onClick={() => setShowEditPanel(true)}
                  title="Edit goal"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </DialogHeader>

            <div className="space-y-6 px-2 sm:px-0 overflow-x-hidden">
            {/* Goal Progress Section */}
            <Card>
              <CardContent className="p-3 sm:p-6">
                <h3 className="font-semibold text-lg mb-4">Overall Progress</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Progress value={progress} className="flex-1 mr-4" />
                    <span className="text-green-600 font-semibold">{progress}%</span>
                  </div>
                  
                  {/* Manual completion section */}
                  {progress >= 90 && progress < 100 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-blue-800">Almost there!</h4>
                          <p className="text-sm text-blue-600">
                            Your habits have brought you to {progress}%. You can manually complete this goal.
                          </p>
                        </div>
                        <Button 
                          onClick={handleManualComplete}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Complete Goal
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {progress === 100 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-800">Goal Completed!</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Update Progress (%)</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={progress}
                        onChange={(e) => setProgress(Number(e.target.value))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button onClick={handleProgressUpdate} size="sm">
                        Update
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{getProgressMessage(progress)}</p>
                  <div className="text-xs text-gray-500">
                    Habit contribution ≈ {Math.round(habitAverage)}%, Manual adjustment ≈ {manualOffset >= 0 ? `+${manualOffset}` : manualOffset}%
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Associated Habits Section */}
            <Card>
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Associated Habits</h3>
                  <Button
                    onClick={() => setShowAddHabitPanel(true)}
                    size="sm"
                    className="flex items-center space-x-2 text-xs sm:text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add Habit</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {goalData.habits.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      No habits associated with this goal yet.
                    </p>
                  ) : (
                    goalData.habits.map((habit) => {
                      console.log('Full habit data:', habit);
                      return (
                        <HabitCompletionProgress
                          key={habit.id}
                                                                          habit={{
                          ...habit,
                          goalId: goalData.id,
                          habitDefinitionId: habit.id, // This is the habit definition ID
                        }}
                        onComplete={async () => {
                          await handleHabitComplete(habit.id);
                          // Refresh goal data to show updated progress immediately
                          await refreshGoalData();
                        }}
                        onRemove={async () => {
                          await onRemoveHabit(goalData.id, habit.id);
                          // Refresh goal data to show updated habit list immediately
                          await refreshGoalData();
                        }}
                        onHabitUpdated={() => {
                          // Refresh goal data to show updated habit targets
                          queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/goals', goalData.id] });
                          // Also refresh local goal data immediately
                          refreshGoalData();
                        }}
                        />
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Archive and Delete Actions - Separated from close button at bottom */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-8 border-t border-gray-200">
              <Button 
                variant="outline" 
                onClick={handleArchiveGoal}
                className="flex-1 sm:flex-none order-2 sm:order-1"
                title="Archive goal"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDeleteGoal}
                className="flex-1 sm:flex-none order-1 sm:order-2 bg-red-50 text-red-600 hover:text-red-700 hover:bg-red-100 border-red-300"
                title="Delete goal permanently"
              >
                <Trash className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Add Habit Sliding Panel */}
        <div className={`absolute inset-0 bg-white transition-transform duration-300 ${showAddHabitPanel ? 'translate-x-0' : 'translate-x-full'} z-10`}>
          <div className="p-3 sm:p-6 h-full flex flex-col overflow-hidden bg-white relative" style={{ height: 'calc(90vh - 2rem)' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddHabitPanel(false)}
                  className="p-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-500">Back to Goal</span>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold">Add Habit to Goal</h2>
                <p className="text-sm text-gray-600">{goalData.title}</p>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1">
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                              <TabsTrigger value="select" className="text-xs sm:text-sm">Select Existing</TabsTrigger>
              <TabsTrigger value="create" className="text-xs sm:text-sm">Create New</TabsTrigger>
              </TabsList>

              <TabsContent value="select" className="space-y-4 mt-4 flex-1 flex flex-col">
                <div className="space-y-2 flex-1 flex flex-col">
                  <p className="text-sm text-gray-600">Select habits to add to this goal:</p>
                  
                  {/* Selected Habits Counter */}
                  {selectedHabitIds.length > 0 && (
                    <div className="text-xs font-medium text-gray-500 mb-2">
                      Selected Habits ({selectedHabitIds.length})
                      </div>
                    )}
                    
                    {/* Habit Selection - Single Scroll Container */}
                    <div className="border rounded-md flex-1 overflow-y-auto" style={{ maxHeight: '500px' }}>
                        {/* Search Input */}
                        <div className="p-3 border-b bg-gray-50">
                          <Input
                            placeholder="Search habits..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        
                        {/* Recommended Habits Section - Always Expanded */}
                        <div className="space-y-2">
                          {/* Combined Recommended Habits */}
                          {(() => {
                            // Filter dashboard suggestions to only show relevant ones
                            const relevantDashboardHabits = Array.isArray(dashboardSuggestedHabits) 
                              ? dashboardSuggestedHabits
                                  .filter((habit: any) => {
                                    // Check if habit is relevant to current goal
                                    const habitTitle = (habit.title || habit.name || '').toLowerCase();
                                    const habitDesc = (habit.description || '').toLowerCase();
                                    const goalTitle = goalData.title.toLowerCase();
                                    const goalDesc = (goalData.description || '').toLowerCase();
                                    
                                    // More strict relevance check
                                    const goalText = `${goalTitle} ${goalDesc}`;
                                    const habitText = `${habitTitle} ${habitDesc}`;
                                    
                                    // Extract meaningful keywords (longer than 3 chars, not common words)
                                    const commonWords = ['the', 'and', 'for', 'with', 'this', 'that', 'your', 'you', 'are', 'can', 'will', 'have', 'has', 'been', 'from', 'into', 'more', 'most', 'some', 'time', 'day', 'week', 'month', 'year'];
                                    const goalKeywords = goalText.split(' ').filter(word => 
                                      word.length > 3 && !commonWords.includes(word)
                                    );
                                    const habitKeywords = habitText.split(' ').filter(word => 
                                      word.length > 3 && !commonWords.includes(word)
                                    );
                                    
                                    // Check for meaningful keyword overlap
                                    const hasOverlap = goalKeywords.some(keyword => 
                                      habitKeywords.some(hKeyword => 
                                        hKeyword.includes(keyword) || keyword.includes(hKeyword) ||
                                        hKeyword === keyword
                                      )
                                    );
                                    
                                    return hasOverlap;
                                  })
                                  .slice(0, 2)
                              : [];
                            
                            const semanticHabits = Array.isArray(recommendedHabits) ? recommendedHabits.slice(0, 3) : [];
                            
                            // Include new suggested habits if they're being shown
                            const newHabits = showNewSuggestions ? newSuggestedHabits : [];
                            
                            // Also include high-scoring existing habits that aren't already recommended
                            const highScoringExisting = existingHabits
                              .filter((habit: any) =>
                                !goalData.habits.some((associatedHabit: any) => associatedHabit.id === habit.id) &&
                                !relevantDashboardHabits.some((dh: any) => dh.id === habit.id) &&
                                !semanticHabits.some((sh: any) => sh.id === habit.id) &&
                                !newHabits.some((nh: any) => nh.id === habit.id) &&
                                habit.isActive === true && // Only active habits
                                habit.score > 0.7 // High scoring habits
                              )
                              .slice(0, 2); // Limit to 2 high-scoring existing habits
                            
                            // Combine all habits - existing recommendations first, then new suggestions
                            const allHabits = [...relevantDashboardHabits, ...semanticHabits, ...highScoringExisting, ...newHabits]
                              .filter((habit: any) =>
                                (habit.title || habit.name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                habit.description?.toLowerCase().includes(searchTerm.toLowerCase())
                              )
                              .filter((habit: any) => 
                                !goalData.habits.some((associatedHabit: any) => 
                                  associatedHabit.id === habit.id
                                )
                              )
                              .filter((habit: any) => {
                                // Prioritize active habits, only show inactive if high leverage + high impact
                                if (habit.isActive !== false) return true; // Show active habits
                                // For inactive habits, only show if they have high score/leverage
                                return habit.score > 0.8 || habit.isHighLeverage;
                              });
                            
                            // Don't limit the total count when showing new suggestions
                            const finalHabits = showNewSuggestions ? allHabits : allHabits.slice(0, 5);

                            if (finalHabits.length === 0) return null;

                            return (
                              <>
                                <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-blue-50 border-b flex items-center gap-2">
                                  <Sparkles className="w-3 h-3" />
                                  RECOMMENDED
                                  {showNewSuggestions && (
                                    <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                                      +{newSuggestedHabits.length} new
                                    </span>
                                  )}
                                </div>
                                {finalHabits.map((habit: any) => (
                                <div
                                  key={habit.id}
                                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                                      selectedHabitIds.includes(habit.id) ? 'bg-blue-50 border-blue-200' : ''
                                    }`}
                                    onClick={() => {
                                      if (selectedHabitIds.includes(habit.id)) {
                                        setSelectedHabitIds(prev => prev.filter(id => id !== habit.id));
                                      } else {
                                        setSelectedHabitIds(prev => [...prev, habit.id]);
                                      }
                                    }}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className={`w-4 h-4 mt-0.5 border-2 rounded ${
                                        selectedHabitIds.includes(habit.id) 
                                          ? 'bg-blue-600 border-blue-600' 
                                          : 'border-gray-300'
                                      }`}>
                                        {selectedHabitIds.includes(habit.id) && (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <div className="w-2 h-2 bg-white rounded-sm"></div>
                                          </div>
                                        )}
                                      </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{habit.title || habit.name}</div>
                                      {habit.description && (
                                        <div className="text-xs text-gray-600 line-clamp-2 mt-1">{habit.description}</div>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 ml-3 flex-shrink-0">
                                        {newHabits.includes(habit) ? 'New' : 
                                         habit.score ? `Score ${(habit.score*100).toFixed(0)}` : 'Suggested'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </>
                            );
                          })()}

                          {/* New Suggestions Button or Suggest More Button */}
                          <div className="p-3 border-b">
                            {newSuggestionsCount > 0 ? (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={viewNewSuggestions}
                                className="w-full text-xs bg-green-600 hover:bg-green-700"
                              >
                                <Sparkles className="w-3 h-3 mr-2" />
                                View {newSuggestionsCount} new suggested habits
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={suggestMoreHabits}
                                disabled={suggestingMore}
                                className="w-full text-xs"
                              >
                                <Sparkles className="w-3 h-3 mr-2" />
                                {suggestingMore ? "Generating..." : "Suggest More Habits"}
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Browse All Habits - Always Expanded */}
                        <div className="border-t">
                        <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 border-b">
                            BROWSE ALL HABITS
                        </div>
                          <div>
                        {existingHabits
                          .filter((habit: any) =>
                            habit.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            habit.description?.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .filter((habit: any) => 
                            !goalData.habits.some((associatedHabit: any) => 
                              associatedHabit.id === habit.id
                            )
                          )
                          .map((habit: any) => (
                            <div
                              key={habit.id}
                              className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                                      selectedHabitIds.includes(habit.id) ? 'bg-blue-50 border-blue-200' : ''
                                    }`}
                                    onClick={() => {
                                      if (selectedHabitIds.includes(habit.id)) {
                                        setSelectedHabitIds(prev => prev.filter(id => id !== habit.id));
                                      } else {
                                        setSelectedHabitIds(prev => [...prev, habit.id]);
                                      }
                                    }}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className={`w-4 h-4 mt-0.5 border-2 rounded ${
                                        selectedHabitIds.includes(habit.id) 
                                          ? 'bg-blue-600 border-blue-600' 
                                          : 'border-gray-300'
                                      }`}>
                                        {selectedHabitIds.includes(habit.id) && (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <div className="w-2 h-2 bg-white rounded-sm"></div>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1">
                              <div className="font-medium text-sm">{habit.title}</div>
                              {habit.description && (
                                <div className="text-xs text-gray-600 line-clamp-2 mt-1">{habit.description}</div>
                              )}
                            </div>
                                      {habit.score && (
                                        <div className="text-xs text-gray-500 ml-3 flex-shrink-0">
                                          Score {(habit.score*100).toFixed(0)}
                      </div>
                                      )}
                        </div>
                        </div>
                                ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

              <TabsContent value="create" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="newHabitTitle">Habit Title *</Label>
                  <Input
                    id="newHabitTitle"
                    value={newHabitTitle}
                    onChange={(e) => setNewHabitTitle(e.target.value)}
                    placeholder="e.g., Morning Exercise"
                  />
                </div>
                
                <div>
                  <Label htmlFor="newHabitDescription">Description</Label>
                  <Input
                    id="newHabitDescription"
                    value={newHabitDescription}
                    onChange={(e) => setNewHabitDescription(e.target.value)}
                    placeholder="Describe your habit..."
                  />
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-sm mb-3">Set Habit Targets</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="newHabitFrequency">Frequency</Label>
                      <Select value={newHabitFrequency} onValueChange={setNewHabitFrequency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="newHabitTargetCompletions">Target per period</Label>
                      <Input
                        id="newHabitTargetCompletions"
                        type="number"
                        min="1"
                        value={newHabitTargetCompletions}
                        onChange={(e) => setNewHabitTargetCompletions(Number(e.target.value))}
                        placeholder="e.g., 1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="newHabitPeriods">
                        {newHabitFrequency === 'daily' ? 'Number of days' : 
                         newHabitFrequency === 'weekly' ? 'Number of weeks' : 
                         'Number of months'}
                      </Label>
                      <Input
                        id="newHabitPeriods"
                        type="number"
                        min="1"
                        value={newHabitPeriods || 1}
                        onChange={(e) => setNewHabitPeriods(Number(e.target.value))}
                        placeholder="e.g., 7"
                      />
                    </div>
                  </div>
                  
                  {newHabitFrequency === 'daily' && (
                    <div className="flex items-center gap-2 mt-3 text-sm">
                      <input
                        id="new-habit-weekdays-only"
                        type="checkbox"
                        className="h-4 w-4"
                        checked={newHabitWeekdaysOnly}
                        onChange={(e) => setNewHabitWeekdaysOnly(e.target.checked)}
                      />
                      <Label htmlFor="new-habit-weekdays-only" className="text-sm font-normal">
                        Only count weekdays (Mon–Fri)
                      </Label>
                    </div>
                  )}
                  
                  <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="text-sm text-blue-800">
                      <strong>Target:</strong> {newHabitTargetCompletions} per {newHabitFrequency} × {newHabitPeriods} {newHabitFrequency === 'daily' ? 'days' : newHabitFrequency === 'weekly' ? 'weeks' : 'months'} = {newHabitTargetCompletions * newHabitPeriods} total
                    </div>
                  </div>
                </div>
              </TabsContent>
                          </Tabs>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-6 mt-4">
              <Button variant="outline" onClick={() => setShowAddHabitPanel(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (activeTab === "select" && selectedHabitIds.length > 0) {
                    // Initialize habit targets with defaults
                    const defaultTargets: {[habitId: string]: {frequency: string; perPeriodTarget: number; periodsCount: number}} = {};
                    selectedHabitIds.forEach(habitId => {
                      defaultTargets[habitId] = {
                        frequency: "daily",
                        perPeriodTarget: 1,
                        periodsCount: goalData.targetDate ? calculatePeriodsFromTargetDate("daily") : 7
                      };
                    });
                    setHabitTargets(defaultTargets);
                    setShowTargetSetting(true);
                  } else {
                    handleAddHabit();
                  }
                }}
                disabled={activeTab === "select" && selectedHabitIds.length === 0}
                className="w-full sm:w-auto"
              >
{activeTab === "select" ? "Next" : "Add Habit"}
              </Button>
            </div>
          </div>
        </div>

        {/* Target Setting Panel */}
        <div className={`absolute inset-0 bg-white transition-transform duration-300 ${showTargetSetting ? 'translate-x-0' : 'translate-x-full'} z-20`}>
          <div className="p-3 sm:p-6 h-full flex flex-col overflow-hidden bg-white relative" style={{ height: 'calc(90vh - 2rem)' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowTargetSetting(false)}
                  className="p-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-500">Back to Habit Selection</span>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold">Set Habit Targets</h2>
                <p className="text-sm text-gray-600">Define how often you'll complete each habit to achieve your goal by {goalData.targetDate ? new Date(goalData.targetDate).toLocaleDateString() : 'your target date'}</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="space-y-6">
                {selectedHabitIds.map((habitId) => {
                  const habit = existingHabits.find((h: any) => h.id === habitId) || 
                               recommendedHabits.find((h: any) => h.id === habitId) ||
                               dashboardSuggestedHabits.find((h: any) => h.id === habitId);
                  const targets = habitTargets[habitId] || {frequency: "daily", perPeriodTarget: 1, periodsCount: 7};
                  
                  return (
                    <div key={habitId} className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-sm mb-3">{habit?.title || habit?.name}</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor={`frequency-${habitId}`}>Frequency</Label>
                          <Select 
                            value={targets.frequency} 
                            onValueChange={(value) => {
                              setHabitTargets(prev => ({
                                ...prev,
                                [habitId]: {
                                  ...prev[habitId],
                                  frequency: value,
                                  periodsCount: goalData.targetDate ? calculatePeriodsFromTargetDate(value) : prev[habitId]?.periodsCount || 7
                                }
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor={`perPeriod-${habitId}`}>Per Period</Label>
                          <Input
                            id={`perPeriod-${habitId}`}
                            type="number"
                            min="1"
                            value={targets.perPeriodTarget}
                            onChange={(e) => {
                              setHabitTargets(prev => ({
                                ...prev,
                                [habitId]: {
                                  ...prev[habitId],
                                  perPeriodTarget: Number(e.target.value)
                                }
                              }));
                            }}
                            placeholder="e.g., 1"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={`periods-${habitId}`}>
                            {targets.frequency === 'daily' ? 'Number of days' : 
                             targets.frequency === 'weekly' ? 'Number of weeks' : 
                             'Number of months'}
                          </Label>
                          <Input
                            id={`periods-${habitId}`}
                            type="number"
                            min="1"
                            value={targets.periodsCount}
                            onChange={(e) => {
                              setHabitTargets(prev => ({
                                ...prev,
                                [habitId]: {
                                  ...prev[habitId],
                                  periodsCount: Number(e.target.value)
                                }
                              }));
                            }}
                            placeholder="e.g., 7"
                          />
                        </div>
                      </div>
                      
                      <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="text-sm text-blue-800">
                          <strong>Total:</strong> {targets.perPeriodTarget * targets.periodsCount} completions by {goalData.targetDate ? new Date(goalData.targetDate).toLocaleDateString() : 'your target date'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-6 mt-4">
              <Button variant="outline" onClick={() => setShowTargetSetting(false)} className="w-full sm:w-auto">
                Back
              </Button>
              <Button onClick={handleAddHabitWithTargets} className="w-full sm:w-auto">
                Add Habits
              </Button>
            </div>
          </div>
        </div>

        {/* Edit Goal Sliding Panel */}
        <div className={`absolute inset-0 bg-white transition-transform duration-300 ${showEditPanel ? 'translate-x-0' : 'translate-x-full'} z-10`}>
          <div className="p-3 sm:p-6 h-full flex flex-col overflow-hidden bg-white relative" style={{ height: 'calc(90vh - 2rem)' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowEditPanel(false)}
                  className="p-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-500">Back to Goal</span>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold">Edit Goal</h2>
                <p className="text-sm text-gray-600">{goalData.title}</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editTitle">Goal Title *</Label>
                  <Input
                    id="editTitle"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g., Improve Sleep Quality"
                  />
                </div>

                <div>
                  <Label htmlFor="editDescription">Description</Label>
                  <Textarea
                    id="editDescription"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Describe your goal..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="editLifeMetric">Life Metric</Label>
                  <Select
                    value={editLifeMetricId || undefined}
                    onValueChange={setEditLifeMetricId}
                  >
                    <SelectTrigger id="editLifeMetric">
                      <SelectValue placeholder={goalData.lifeMetric.name} />
                    </SelectTrigger>
                    <SelectContent>
                      {lifeMetrics.map((metric: any) => (
                        <SelectItem key={metric.id} value={metric.id}>
                          {metric.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="editTargetDate">Target Date (Optional)</Label>
                  <Input
                    id="editTargetDate"
                    type="date"
                    value={editTargetDate}
                    onChange={(e) => setEditTargetDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="editTerm">Start timeline</Label>
                  {isInFocus && !showTermDropdown ? (
                    <div className="space-y-2">
                      <div className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-md text-sm font-medium">
                        Currently in focus
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowTermDropdown(true)}
                        className="text-sm text-emerald-600 hover:text-emerald-700 underline"
                      >
                        change this
                      </button>
                    </div>
                  ) : (
                    <Select
                      value={editTerm}
                      onValueChange={(value: 'short' | 'mid' | 'long' | 'backlog') =>
                        setEditTerm(value)
                      }
                    >
                      <SelectTrigger id="editTerm">
                        <SelectValue placeholder="Choose when you'd like to start" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">
                          Backlog (not scheduled yet)
                        </SelectItem>
                        <SelectItem value="short">
                          Short term (next few weeks)
                        </SelectItem>
                        <SelectItem value="mid">
                          Mid term (next 1–3 months)
                        </SelectItem>
                        <SelectItem value="long">
                          Long term (3+ months)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button 
                onClick={() => setShowEditPanel(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEditGoal}
                className="flex-1"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}; 