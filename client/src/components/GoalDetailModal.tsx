import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Edit, Plus, Flame, X, CheckCircle, Archive, Trash } from "lucide-react";

import { HabitCompletionProgress } from "./HabitCompletionProgress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
}

export const GoalDetailModal = ({
  isOpen,
  onClose,
  goal,
  onUpdateProgress,
  onCompleteHabit,
  onRemoveHabit,
  onAddHabit,
}: GoalDetailModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Handle the actual API response structure
  const goalData = goal.goalInstance ? {
    id: goal.goalInstance.id,
    title: goal.goalDefinition?.title || "Untitled Goal",
    description: goal.goalDefinition?.description || "",
    progress: goal.goalInstance.currentValue || 0, // currentValue is now stored as percentage
    currentValue: goal.goalInstance.currentValue,
    targetValue: goal.goalInstance.targetValue,
    targetDate: goal.goalInstance.targetDate, // Include target date
    lifeMetric: goal.lifeMetric || { name: goal.goalDefinition?.category || "General", color: "#6B7280" },
    habits: goal.habits || [],
  } : goal;

  console.log('Goal data:', goalData);
  console.log('Associated habits:', goalData.habits);
  console.log('Goal ID:', goalData.id);
  console.log('Sample habit structure:', goalData.habits[0]);

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
  const [existingHabitFrequency, setExistingHabitFrequency] = useState("daily");
  const [existingHabitPerPeriod, setExistingHabitPerPeriod] = useState(1);
  const [existingHabitPeriods, setExistingHabitPeriods] = useState(1);
  const [activeTab, setActiveTab] = useState("select");
  const [targetValue, setTargetValue] = useState(1);
  const [selectedHabitId, setSelectedHabitId] = useState("");
  const [showHabitList, setShowHabitList] = useState(false);
  
  // Calculate periods based on goal target date and frequency
  const calculatePeriodsFromTargetDate = (frequency: string) => {
    if (!goalData.targetDate) return 1;
    const targetDate = new Date(goalData.targetDate);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    switch (frequency) {
      case 'daily':
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
      const calculatedPeriods = calculatePeriodsFromTargetDate(newHabitFrequency);
      setNewHabitPeriods(calculatedPeriods);
    }
  }, [newHabitFrequency, goalData.targetDate]);
  
  useEffect(() => {
    if (goalData.targetDate) {
      const calculatedPeriods = calculatePeriodsFromTargetDate(existingHabitFrequency);
      setExistingHabitPeriods(calculatedPeriods);
    }
  }, [existingHabitFrequency, goalData.targetDate]);
  
  // Edit goal panel state
  const [editTitle, setEditTitle] = useState(goalData.title);
  const [editDescription, setEditDescription] = useState(goalData.description || "");
  const [editLifeMetricId, setEditLifeMetricId] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  
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
  
  // Fetch life metrics for edit form
  const { data: lifeMetrics = [] } = useQuery({
    queryKey: ['/api/life-metrics'],
    queryFn: async () => {
      return apiRequest('/api/life-metrics');
    },
    retry: 1, // Always fetch life metrics, not just when edit panel is open
  });
  
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
      
      // Set life metric
      if (lifeMetrics.length > 0) {
        console.log('Searching for life metric:', goalData.lifeMetric.name);
        console.log('Available life metrics:', lifeMetrics.map(m => ({id: m.id, name: m.name})));
        
        const currentLifeMetric = lifeMetrics.find((metric: any) => 
          metric.name === goalData.lifeMetric.name
        );
        if (currentLifeMetric) {
          setEditLifeMetricId(currentLifeMetric.id);
          console.log('✅ Set life metric to:', currentLifeMetric.id, currentLifeMetric.name);
        } else {
          console.warn('❌ Could not find life metric for:', goalData.lifeMetric.name);
          console.log('Full goalData.lifeMetric:', goalData.lifeMetric);
          
          // Try to find by partial match or similar name
          const fallbackMetric = lifeMetrics.find((metric: any) => 
            metric.name.toLowerCase().includes(goalData.lifeMetric.name.toLowerCase()) ||
            goalData.lifeMetric.name.toLowerCase().includes(metric.name.toLowerCase())
          ) || lifeMetrics[0]; // Use first available metric as final fallback
          
          if (fallbackMetric) {
            setEditLifeMetricId(fallbackMetric.id);
            console.log('🔄 Using fallback life metric:', fallbackMetric.id, fallbackMetric.name);
          }
        }
      } else {
        console.warn('No life metrics available yet');
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

  const handleManualComplete = async () => {
    try {
      const response = await apiRequest(`/api/goals/${goalData.id}/complete`, {
        method: 'POST',
      });
      
      if (response) {
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
      const updates = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        lifeMetricId: editLifeMetricId,
        targetDate: editTargetDate || null,
      };
      
      console.log('Saving goal updates:', updates);
      
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
        message: error.message,
        status: (error as any).status,
        data: (error as any).data
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

  // Function to refresh goal data
  const refreshGoalData = async () => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/goals/${goalData.id}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const updatedGoal = await response.json();
        // Update the goal data in the parent component
        // This will trigger a re-render with updated data
        // Note: In a production app, you'd use proper state management here
        console.log('Goal data refreshed:', updatedGoal);
      }
    } catch (error) {
      console.error('Error refreshing goal data:', error);
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
      if (error.message && error.message.includes('already completed today')) {
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
        if (!selectedHabitId) {
          alert("Please select a habit");
          return;
        }
        
        console.log('Adding existing habit:', selectedHabitId, 'to goal:', goalData.id);
        
        const response = await apiRequest(`/api/goals/${goalData.id}/habits`, {
          method: 'POST',
          body: JSON.stringify({
            habitDefinitionId: selectedHabitId,
            targetValue: targetValue,
            frequencySettings: {
              frequency: existingHabitFrequency,
              perPeriodTarget: existingHabitPerPeriod,
              periodsCount: existingHabitPeriods,
            },
          }),
        });
        
        console.log('Added existing habit to goal:', response);
        
        toast({
          title: 'Habit added successfully!',
          description: 'The habit has been added to your goal.',
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        
        // Call the parent's onAddHabit function
        const selectedHabit = existingHabits.find((h: any) => h.id === selectedHabitId);
        if (selectedHabit) {
          onAddHabit(goalData.id, selectedHabit);
        }
        
        // Refresh the goal data to show the new habit
        try {
          const goalResponse = await fetch(`${apiBaseUrl}/api/goals/${goalData.id}`, { credentials: 'include' });
          if (goalResponse.ok) {
            const updatedGoal = await goalResponse.json();
            // Update the goal data in the parent component
            console.log('Goal data refreshed after adding habit:', updatedGoal);
          }
        } catch (refreshError) {
          console.error('Error refreshing goal data:', refreshError);
        }
        
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
        
        // Then add it to the goal
        const addResponse = await apiRequest(`/api/goals/${goalData.id}/habits`, {
          method: 'POST',
          body: JSON.stringify({
            habitDefinitionId: createResponse.id,
            targetValue: targetValue,
            frequencySettings: {
              frequency: newHabitFrequency,
              perPeriodTarget: newHabitTargetCompletions,
              periodsCount: newHabitPeriods,
            },
          }),
        });
        
        console.log('Added habit to goal:', addResponse);
        
        toast({
          title: 'Habit added successfully!',
          description: 'The habit has been added to your goal.',
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
        
        onAddHabit(goalData.id, createResponse);
      }
      
      // Reset form and close panel
      setSelectedHabitId("");
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
      
    } catch (error) {
      console.error('Error adding habit:', error);
      toast({
        title: 'Failed to add habit',
        description: 'Please try again.',
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
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-1"
                    onClick={() => setShowEditPanel(true)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-1 text-gray-400 hover:text-red-600"
                    onClick={handleArchiveGoal}
                    title="Archive goal"
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-1 text-gray-400 hover:text-red-600"
                    onClick={handleDeleteGoal}
                    title="Delete goal"
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <DialogTitle className="text-xl font-bold">{goalData.title}</DialogTitle>
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
                        onComplete={() => handleHabitComplete(habit.id)}
                        onRemove={() => onRemoveHabit(goalData.id, habit.id)}
                        onHabitUpdated={() => {
                          // Refresh goal data to show updated habit targets
                          queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/goals', goalData.id] });
                        }}
                        />
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
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
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="select" className="text-xs sm:text-sm">Select Existing</TabsTrigger>
              <TabsTrigger value="create" className="text-xs sm:text-sm">Create New</TabsTrigger>
              </TabsList>

              <TabsContent value="select" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Select a habit to add to this goal:</p>
                  
                  {/* Expandable Habit Selection */}
                  <div className="space-y-2">
                    
                    {/* Selected Habit Display */}
                    {selectedHabitId && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-blue-800">
                              {existingHabits.find(h => h.id === selectedHabitId)?.title}
                            </div>
                            {existingHabits.find(h => h.id === selectedHabitId)?.description && (
                              <div className="text-xs text-blue-600 mt-1">
                                {existingHabits.find(h => h.id === selectedHabitId)?.description}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedHabitId("")}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Expandable Habit List */}
                    {showHabitList && (
                      <div className="border rounded-md max-h-64 overflow-y-auto">
                        {/* Search Input */}
                        <div className="p-3 border-b bg-gray-50">
                          <Input
                            placeholder="Search habits..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        
                        {/* Recommended Habits Section */}
                        {Array.isArray(recommendedHabits) && recommendedHabits.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 border-b">
                              RECOMMENDED
                            </div>
                            {recommendedHabits
                              .filter((habit: any) =>
                                habit.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                habit.description?.toLowerCase().includes(searchTerm.toLowerCase())
                              )
                              .filter((habit: any) => 
                                // Filter out habits that are already associated with this goal
                                !goalData.habits.some((associatedHabit: any) => 
                                  associatedHabit.id === habit.id
                                )
                              )
                              .map((habit: any) => (
                                <div
                                  key={habit.id}
                                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                                    selectedHabitId === habit.id ? 'bg-blue-50 border-blue-200' : ''
                                  }`}
                                  onClick={() => setSelectedHabitId(habit.id)}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">{habit.title}</div>
                                      {habit.description && (
                                        <div className="text-xs text-gray-600 line-clamp-2 mt-1">{habit.description}</div>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 ml-3 flex-shrink-0">
                                      Score {(habit.score*100).toFixed(0)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </>
                        )}
                        
                        {/* All Other Habits */}
                        <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 border-b">
                          ALL HABITS
                        </div>
                        {existingHabits
                          .filter((habit: any) =>
                            habit.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            habit.description?.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .filter((habit: any) => 
                            // Filter out habits that are already associated with this goal
                            !goalData.habits.some((associatedHabit: any) => 
                              associatedHabit.id === habit.id
                            )
                          )
                          .map((habit: any) => (
                            <div
                              key={habit.id}
                              className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                                selectedHabitId === habit.id ? 'bg-blue-50 border-blue-200' : ''
                              }`}
                              onClick={() => setSelectedHabitId(habit.id)}
                            >
                              <div className="font-medium text-sm">{habit.title}</div>
                              {habit.description && (
                                <div className="text-xs text-gray-600 line-clamp-2 mt-1">{habit.description}</div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  
                </div>
                
                {/* Target Setting Module - Always Visible */}
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-3">
                      Set Habit Targets for this Goal
                      {selectedHabitId ? (
                        <span className="text-xs text-gray-500 ml-2">
                          (Selected: {selectedHabitId})
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 ml-2">
                          (Select a habit above to configure targets)
                        </span>
                      )}
                    </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="existingHabitFrequency">Frequency</Label>
                          <Select value={existingHabitFrequency} onValueChange={setExistingHabitFrequency}>
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
                          <Label htmlFor="existingHabitPerPeriod">Target per period</Label>
                          <Input
                            id="existingHabitPerPeriod"
                            type="number"
                            min="1"
                            value={existingHabitPerPeriod}
                            onChange={(e) => setExistingHabitPerPeriod(Number(e.target.value))}
                            placeholder="e.g., 1"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="existingHabitPeriods">
                            {existingHabitFrequency === 'daily' ? 'Number of days' : 
                             existingHabitFrequency === 'weekly' ? 'Number of weeks' : 
                             'Number of months'}
                          </Label>
                          <Input
                            id="existingHabitPeriods"
                            type="number"
                            min="1"
                            value={existingHabitPeriods}
                            onChange={(e) => setExistingHabitPeriods(Number(e.target.value))}
                            placeholder="e.g., 7"
                          />
                        </div>
                      </div>
                      
                      <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="text-sm text-blue-800">
                          <strong>Target:</strong> {existingHabitPerPeriod} per {existingHabitFrequency} × {existingHabitPeriods} {existingHabitFrequency === 'daily' ? 'days' : existingHabitFrequency === 'weekly' ? 'weeks' : 'months'} = {existingHabitPerPeriod * existingHabitPeriods} total
                        </div>
                      </div>
                      
                      {!selectedHabitId && (
                        <div className="text-center py-4 text-sm text-gray-500">
                          Select a habit above to configure its targets for this goal
                        </div>
                      )}
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
              <Button onClick={handleAddHabit} className="w-full sm:w-auto">
                Add Habit
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
                  <Select value={editLifeMetricId} onValueChange={setEditLifeMetricId}>
                    <SelectTrigger>
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