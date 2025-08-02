
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, ChevronRight, CheckCircle, History, ArrowLeft, Calendar, Flame, Edit, Save, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { GoalDetailModal } from "./GoalDetailModal";

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
  createdAt: string;
  completedAt?: string; // Add completed date
  targetDate?: string;
  status: 'active' | 'completed' | 'paused';
  habits?: Habit[];
}

interface Habit {
  id: string;
  title: string;
  description?: string;
  category?: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
}

interface LifeMetric {
  id: string;
  name: string;
  color: string;
}

export const GoalsScreen = () => {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"current" | "history">("current");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showAddHabitDialog, setShowAddHabitDialog] = useState(false);
  const [selectedGoalForHabit, setSelectedGoalForHabit] = useState<string | null>(null);
  const [showGoalDetailModal, setShowGoalDetailModal] = useState(false);
  const [selectedGoalDetails, setSelectedGoalDetails] = useState<any>(null);
  const [showCompletedGoals, setShowCompletedGoals] = useState(false); // New filter state
  const [editGoal, setEditGoal] = useState({
    title: "",
    description: "",
    lifeMetricId: "",
    targetDate: ""
  });
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    lifeMetricId: "",
    targetDate: ""
  });

  // Get metric filter from URL
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const metricFilter = urlParams.get('metric');

  // Debug logging
  console.log("GoalsScreen render - showEditDialog:", showEditDialog, "showAddHabitDialog:", showAddHabitDialog);
  
  const queryClient = useQueryClient();

  // Render dialogs at the top level to ensure they're always available
  const renderDialogs = () => (
    <>
      {/* Edit Goal Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Goal Title *</Label>
              <Input
                id="edit-title"
                value={editGoal.title}
                onChange={(e) => setEditGoal({ ...editGoal, title: e.target.value })}
                placeholder="e.g., Improve Sleep Quality"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editGoal.description}
                onChange={(e) => setEditGoal({ ...editGoal, description: e.target.value })}
                placeholder="Describe your goal..."
              />
            </div>
            <div>
              <Label htmlFor="edit-lifeMetric">Life Metric *</Label>
              <Select value={editGoal.lifeMetricId} onValueChange={(value) => setEditGoal({ ...editGoal, lifeMetricId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a life metric" />
                </SelectTrigger>
                <SelectContent>
                  {lifeMetrics.map((metric: LifeMetric) => (
                    <SelectItem key={metric.id} value={metric.id}>
                      {metric.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-targetDate">Target Date (Optional)</Label>
              <Input
                id="edit-targetDate"
                type="date"
                value={editGoal.targetDate}
                onChange={(e) => setEditGoal({ ...editGoal, targetDate: e.target.value })}
              />
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleEditGoal} className="flex-1" disabled={updateGoalMutation.isPending}>
                {updateGoalMutation.isPending ? "Updating..." : "Update Goal"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowEditDialog(false)}
                disabled={updateGoalMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Habit Dialog */}
      <Dialog open={showAddHabitDialog} onOpenChange={setShowAddHabitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Habit to Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">Select a habit to associate with this goal:</p>
            {habitsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            ) : habits.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-600">No habits available</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {habits.map((habit: Habit) => (
                  <div key={habit.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">{habit.title}</h4>
                      <p className="text-sm text-gray-600">{habit.description}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddHabitToGoal(habit.id)}
                      disabled={addHabitToGoalMutation.isPending}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowAddHabitDialog(false)}
                disabled={addHabitToGoalMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
  
  // Fetch goals
  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const response = await fetch('/api/goals', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch goals');
      return response.json();
    }
  });

  // Fetch suggested goals from insights
  const { data: suggestedGoals = [] } = useQuery({
    queryKey: ["suggested-goals"],
    queryFn: async () => {
      const response = await fetch('/api/goals/suggested', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch suggested goals');
      return response.json();
    }
  });

  // Fetch habits
  const { data: habits = [], isLoading: habitsLoading } = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const response = await fetch('/api/goals/habits', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch habits');
      return response.json();
    }
  });

  // Fetch life metrics
  const { data: lifeMetrics = [] } = useQuery({
    queryKey: ["life-metrics"],
    queryFn: async () => {
      const response = await fetch('/api/life-metrics', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch life metrics');
      return response.json();
    }
  });

  // Filter goals based on metric filter and completion status
  const filteredGoals = goals.filter((goal: Goal) => {
    // First filter by metric
    if (metricFilter && goal.lifeMetric.name !== metricFilter) return false;
    
    // Then filter by completion status - only show goals with status 'completed'
    if (!showCompletedGoals && goal.status === 'completed') return false;
    
    return true;
  });

  // Filter suggested goals based on metric filter
  const filteredSuggestedGoals = suggestedGoals.filter((suggestedGoal: any) => {
    if (!metricFilter) return true;
    return suggestedGoal.lifeMetric?.name === metricFilter;
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: any) => {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(goalData)
      });
      if (!response.ok) throw new Error('Failed to create goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setShowCreateDialog(false);
      setNewGoal({ title: "", description: "", lifeMetricId: "", targetDate: "" });
      toast.success("Goal created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create goal");
      console.error("Error creating goal:", error);
    }
  });

  // Update goal progress mutation
  const updateGoalProgressMutation = useMutation({
    mutationFn: async ({ goalId, progress }: { goalId: string; progress: number }) => {
      const response = await fetch(`/api/goals/${goalId}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentValue: progress })
      });
      if (!response.ok) throw new Error('Failed to update goal progress');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal progress updated!");
    },
    onError: (error) => {
      toast.error("Failed to update goal progress");
      console.error("Error updating goal progress:", error);
    }
  });

  // Accept suggested goal mutation
  const acceptSuggestedGoalMutation = useMutation({
    mutationFn: async (suggestedGoal: any) => {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: suggestedGoal.title,
          description: suggestedGoal.description,
          lifeMetricId: suggestedGoal.lifeMetric.id,
          targetDate: ""
        })
      });
      if (!response.ok) throw new Error('Failed to accept suggested goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["suggested-goals"] });
      toast.success("Goal accepted successfully!");
    },
    onError: (error) => {
      toast.error("Failed to accept goal");
      console.error("Error accepting goal:", error);
    }
  });

  // Update goal mutation
  const updateGoalMutation = useMutation({
    mutationFn: async ({ goalId, goalData }: { goalId: string; goalData: any }) => {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(goalData)
      });
      if (!response.ok) throw new Error('Failed to update goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setShowEditDialog(false);
      setEditingGoal(null);
      setEditGoal({ title: "", description: "", lifeMetricId: "", targetDate: "" });
      toast.success("Goal updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update goal");
      console.error("Error updating goal:", error);
    }
  });

  // Complete habit mutation
  const completeHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      const response = await fetch(`/api/goals/habits/${habitId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes: "Completed via goals screen" })
      });
      if (!response.ok) throw new Error('Failed to complete habit');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Habit completed successfully!");
    },
    onError: (error) => {
      toast.error("Failed to complete habit");
      console.error("Error completing habit:", error);
    }
  });

  // Add habit to goal mutation
  const addHabitToGoalMutation = useMutation({
    mutationFn: async ({ goalId, habitId }: { goalId: string; habitId: string }) => {
      const response = await fetch(`/api/goals/${goalId}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ habitId })
      });
      if (!response.ok) throw new Error('Failed to add habit to goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setShowAddHabitDialog(false);
      setSelectedGoalForHabit(null);
      toast.success("Habit added to goal successfully!");
    },
    onError: (error) => {
      toast.error("Failed to add habit to goal");
      console.error("Error adding habit to goal:", error);
    }
  });

  // Remove habit from goal mutation
  const removeHabitFromGoalMutation = useMutation({
    mutationFn: async ({ goalId, habitId }: { goalId: string; habitId: string }) => {
      const response = await fetch(`/api/goals/${goalId}/habits/${habitId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to remove habit from goal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Habit removed from goal successfully!");
    },
    onError: (error) => {
      toast.error("Failed to remove habit from goal");
      console.error("Error removing habit from goal:", error);
    }
  });

  const handleCreateGoal = () => {
    if (!newGoal.title || !newGoal.lifeMetricId) {
      toast.error("Please fill in all required fields");
      return;
    }
    createGoalMutation.mutate(newGoal);
  };

  const handleEditGoal = () => {
    if (!editGoal.title || !editGoal.lifeMetricId) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!editingGoal) return;
    updateGoalMutation.mutate({ goalId: editingGoal.id, goalData: editGoal });
  };

  const handleAcceptSuggestedGoal = (suggestedGoal: any) => {
    acceptSuggestedGoalMutation.mutate(suggestedGoal);
  };

  const handleUpdateProgress = (goalId: string, currentProgress: number) => {
    updateGoalProgressMutation.mutate({ goalId, progress: currentProgress });
  };

  const handleEditClick = (goal: Goal) => {
    console.log("Edit button clicked for goal:", goal);
    setEditingGoal(goal);
    setEditGoal({
      title: goal.title,
      description: goal.description || "",
      lifeMetricId: goal.lifeMetricId,
      targetDate: goal.targetDate || ""
    });
    setShowEditDialog(true);
    console.log("showEditDialog set to true");
  };

  const handleCompleteHabit = (habitId: string) => {
    completeHabitMutation.mutate(habitId);
  };

  const handleAddHabitClick = (goalId: string) => {
    console.log("Add habit button clicked for goal:", goalId);
    setSelectedGoalForHabit(goalId);
    setShowAddHabitDialog(true);
    console.log("showAddHabitDialog set to true");
  };

  const handleAddHabitToGoal = (habitId: string) => {
    if (!selectedGoalForHabit) return;
    addHabitToGoalMutation.mutate({ goalId: selectedGoalForHabit, habitId });
  };

  const handleRemoveHabitFromGoal = (goalId: string, habitId: string) => {
    removeHabitFromGoalMutation.mutate({ goalId, habitId });
  };

  // Goal detail modal handlers
  const handleGoalClick = async (goal: any) => {
    try {
      const response = await fetch(`/api/goals/${goal.id}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch goal details');
      const goalDetails = await response.json();
      setSelectedGoalDetails(goalDetails);
      setShowGoalDetailModal(true);
    } catch (error) {
      console.error('Error fetching goal details:', error);
      toast.error('Failed to load goal details');
    }
  };

  const handleUpdateGoalProgress = async (goalId: string, progress: number) => {
    try {
      const response = await fetch(`/api/goals/${goalId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ progress }),
      });
      if (!response.ok) throw new Error('Failed to update goal progress');
      
      // Refresh the goals data
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      toast.success('Goal progress updated successfully');
    } catch (error) {
      console.error('Error updating goal progress:', error);
      toast.error('Failed to update goal progress');
    }
  };

  const handleCompleteHabitModal = async (habitId: string) => {
    try {
      const response = await fetch(`/api/goals/habits/${habitId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          notes: 'Completed via goal detail modal',
          goalId: selectedGoalDetails?.id // Pass the goal ID
        }),
      });
      if (!response.ok) throw new Error('Failed to complete habit');
      
      // Refresh the goal details
      if (selectedGoalDetails) {
        const goalResponse = await fetch(`/api/goals/${selectedGoalDetails.id}`, { credentials: 'include' });
        if (goalResponse.ok) {
          const updatedGoal = await goalResponse.json();
          setSelectedGoalDetails(updatedGoal);
          
          // Invalidate and refetch goals list to update progress
          queryClient.invalidateQueries({ queryKey: ['goals'] });
        }
      }
      toast.success('Habit completed successfully');
    } catch (error) {
      console.error('Error completing habit:', error);
      toast.error('Failed to complete habit');
    }
  };

  const handleRemoveHabitModal = async (goalId: string, habitId: string) => {
    try {
      const response = await fetch(`/api/goals/${goalId}/habits/${habitId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to remove habit from goal');
      
      // Refresh the goal details
      if (selectedGoalDetails) {
        const goalResponse = await fetch(`/api/goals/${selectedGoalDetails.id}`, { credentials: 'include' });
        if (goalResponse.ok) {
          const updatedGoal = await goalResponse.json();
          setSelectedGoalDetails(updatedGoal);
        }
      }
      toast.success('Habit removed from goal');
    } catch (error) {
      console.error('Error removing habit from goal:', error);
      toast.error('Failed to remove habit from goal');
    }
  };

  const handleAddHabitModal = async (goalId: string, habit: any) => {
    try {
      const response = await fetch(`/api/goals/${goalId}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          habitId: habit.id,
          completionsNeeded: 1 // Default: 1 completion = 1% progress
        }),
      });
      if (!response.ok) throw new Error('Failed to add habit to goal');
      
      // Refresh the goal details
      if (selectedGoalDetails) {
        const goalResponse = await fetch(`/api/goals/${selectedGoalDetails.id}`, { credentials: 'include' });
        if (goalResponse.ok) {
          const updatedGoal = await goalResponse.json();
          setSelectedGoalDetails(updatedGoal);
        }
      }
      toast.success('Habit added to goal successfully');
    } catch (error) {
      console.error('Error adding habit to goal:', error);
      toast.error('Failed to add habit to goal');
    }
  };

  const getLifeMetricName = (lifeMetricId: string) => {
    const metric = lifeMetrics.find((m: LifeMetric) => m.id === lifeMetricId);
    return metric ? metric.name : "General";
  };

  const getLifeMetricColor = (lifeMetricId: string) => {
    const metric = lifeMetrics.find((m: LifeMetric) => m.id === lifeMetricId);
    return metric ? metric.color : "#6B7280";
  };

  if (viewMode === "history") {
    return (
      <>
        {renderDialogs()}
        <div className="p-6 pb-24 max-w-md mx-auto">
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={() => setViewMode("current")}
              className="mb-4 text-green-600"
            >
              ← Back to Current Goals
            </Button>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Goal History</h1>
            <p className="text-gray-600">
              Your completed goals and their success stories
            </p>
          </div>

          <div className="space-y-4">
            {goals.filter((goal: Goal) => goal.status === 'completed').map((goal: Goal) => (
              <Card key={goal.id} className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">{goal.title}</h3>
                    <Badge variant="outline" className="text-green-600">
                      Completed
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{goal.lifeMetric.name}</p>
                  <Progress value={goal.progress} className="mb-2" />
                  <p className="text-xs text-gray-500">
                    Final progress: {goal.progress}%
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (selectedGoal) {
    const goal = goals.find((g: Goal) => g.id === selectedGoal);
    if (!goal) return null;

    // Use the actual associated habits from the goal, or filter by category as fallback
    const goalHabits = goal.habits || habits.filter((habit: Habit) => 
      habit.category && habit.category === goal.lifeMetric.name
    );

    return (
      <>
        {renderDialogs()}
        <div className="p-6 pb-24 max-w-md mx-auto">
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={() => setSelectedGoal(null)}
              className="mb-4 text-green-600"
            >
              ← Back to Goals
            </Button>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-800">{goal.title}</h1>
              <Button 
                size="sm"
                variant="outline"
                onClick={() => handleEditClick(goal)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-gray-600">{goal.lifeMetric.name}</p>
          </div>

          <Card className="mb-4 shadow-md border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                <span className="text-sm font-bold text-green-600">{goal.progress}%</span>
              </div>
              <Progress value={goal.progress} className="mb-2" />
              
              {/* Progress Update */}
              <div className="mt-4 space-y-2">
                <Label htmlFor="progress">Update Progress (%)</Label>
                <Input
                  id="progress"
                  type="number"
                  min="0"
                  max="100"
                  value={goal.progress}
                  onChange={(e) => {
                    const newProgress = parseInt(e.target.value) || 0;
                    handleUpdateProgress(goal.id, newProgress);
                  }}
                  className="w-full"
                />
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                You're doing great! Keep up the momentum.
              </p>
            </CardContent>
          </Card>

          {/* Add Habit Section */}
          <Card className="mb-4 shadow-md border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Associated Habits</h3>
                <Button size="sm" variant="outline" onClick={() => handleAddHabitClick(goal.id)}>
                  Add Habit
                </Button>
              </div>
              {goalHabits.length > 0 ? (
                <div className="space-y-3">
                  {goalHabits.map((habit: Habit) => (
                    <div key={habit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium text-gray-800">{habit.title}</span>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-gray-600">
                            <Flame className="h-3 w-3 inline mr-1 text-orange-500" />
                            {habit.currentStreak} day streak
                          </span>
                          <span className="text-sm text-gray-600">
                            Total: {habit.totalCompletions}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleCompleteHabit(habit.id)}>
                          Complete Today
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => handleRemoveHabitFromGoal(goal.id, habit.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-2">No habits associated with this goal yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      {renderDialogs()}
      <div className="p-4 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
                  {metricFilter ? `${metricFilter} Goals` : "Your Goals"}
                </h1>
                <p className="text-gray-600">
                  {metricFilter ? `${metricFilter} goals based on your insights` : "Personal growth goals based on your insights"}
                </p>
              </div>
              <div className="flex space-x-2">
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Goal
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Goal</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">Goal Title *</Label>
                        <Input
                          id="title"
                          value={newGoal.title}
                          onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                          placeholder="e.g., Improve Sleep Quality"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={newGoal.description}
                          onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                          placeholder="Describe your goal..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="lifeMetric">Life Metric *</Label>
                        <Select value={newGoal.lifeMetricId} onValueChange={(value) => setNewGoal({ ...newGoal, lifeMetricId: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a life metric" />
                          </SelectTrigger>
                          <SelectContent>
                            {lifeMetrics.map((metric: LifeMetric) => (
                              <SelectItem key={metric.id} value={metric.id}>
                                {metric.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="targetDate">Target Date (Optional)</Label>
                        <Input
                          id="targetDate"
                          type="date"
                          value={newGoal.targetDate}
                          onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleCreateGoal} className="w-full" disabled={createGoalMutation.isPending}>
                        {createGoalMutation.isPending ? "Creating..." : "Create Goal"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Current Goals */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Current Goals</h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Show completed</span>
                <button
                  onClick={() => setShowCompletedGoals(!showCompletedGoals)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    showCompletedGoals ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showCompletedGoals ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            {goalsLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-2 bg-gray-200 rounded w-1/4"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredGoals.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {metricFilter ? `No goals for ${metricFilter}` : "No goals yet"}
                </h3>
                <p className="text-gray-600">
                  {metricFilter ? `Create your first ${metricFilter} goal to get started!` : "Create your first goal to get started!"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredGoals.map((goal: Goal) => {
                  // Only treat goals with status 'completed' as completed for visual purposes
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
              </div>
            )}
          </div>

          {/* Suggested Goals */}
          {filteredSuggestedGoals.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Suggested Goals</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSuggestedGoals.map((suggestedGoal: any) => (
                  <Card key={suggestedGoal.id} className="shadow-md border-0 bg-blue-50/80 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-800">{suggestedGoal.title}</h3>
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                            style={{ backgroundColor: suggestedGoal.lifeMetric.color + "20", color: suggestedGoal.lifeMetric.color }}
                          >
                            {suggestedGoal.lifeMetric.name}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptSuggestedGoal(suggestedGoal);
                          }}
                          disabled={acceptSuggestedGoalMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {suggestedGoal.description && (
                        <p className="text-sm text-gray-600 mb-3">{suggestedGoal.description}</p>
                      )}
                      
                      <p className="text-xs text-blue-600">
                        Suggested based on your insights
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
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
          onUpdateProgress={handleUpdateGoalProgress}
          onCompleteHabit={handleCompleteHabitModal}
          onRemoveHabit={handleRemoveHabitModal}
          onAddHabit={handleAddHabitModal}
        />
      )}
    </>
  );
};
