import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Edit, Plus, Flame, X, Search, CheckCircle } from "lucide-react";
import { EditGoalModal } from "./EditGoalModal";
import { HabitCompletionProgress } from "./HabitCompletionProgress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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
  
  // Handle the actual API response structure
  const goalData = goal.goalInstance ? {
    id: goal.goalInstance.id,
    title: goal.goalDefinition?.title || "Untitled Goal",
    description: goal.goalDefinition?.description || "",
    progress: goal.goalInstance.currentValue || 0, // currentValue is now stored as percentage
    currentValue: goal.goalInstance.currentValue,
    targetValue: goal.goalInstance.targetValue,
    lifeMetric: goal.lifeMetric || { name: goal.goalDefinition?.category || "General", color: "#6B7280" },
    habits: goal.habits || [],
  } : goal;

  console.log('Goal data:', goalData);
  console.log('Associated habits:', goalData.habits);

  const [progress, setProgress] = useState(goalData.progress);
  const [showAddHabitPanel, setShowAddHabitPanel] = useState(false);
  const [showEditGoal, setShowEditGoal] = useState(false);
  
  // Add habit panel state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHabits, setSelectedHabits] = useState<any[]>([]);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [newHabitDescription, setNewHabitDescription] = useState("");
  const [newHabitCategory, setNewHabitCategory] = useState(goalData.lifeMetric.name);
  const [activeTab, setActiveTab] = useState("select");
  const [targetValue, setTargetValue] = useState(1);
  const [selectedHabitId, setSelectedHabitId] = useState("");
  
  // Update progress when goal data changes
  useEffect(() => {
    setProgress(goalData.progress);
  }, [goalData.progress]);

  // Fetch existing habits
  const { data: existingHabits = [], isLoading } = useQuery({
    queryKey: ['/api/goals/habits/all'],
    queryFn: async () => {
      const response = await fetch('/api/goals/habits/all', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch habits');
      const habits = await response.json();
      console.log('Fetched habits:', habits.length, 'habits');
      console.log('Habits:', habits);
      return habits;
    },
    retry: 1,
  });

  const handleProgressUpdate = () => {
    onUpdateProgress(goalData.id, progress);
  };

  const handleManualComplete = async () => {
    try {
      const response = await fetch(`/api/goals/${goalData.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      if (response.ok) {
        // Update local progress to 100%
        setProgress(100);
        toast({
          title: 'Goal completed successfully!',
          description: 'Your goal has been marked as completed.',
        });
        
        // Refresh goal data to show completed status
        setTimeout(async () => {
          try {
            const goalResponse = await fetch(`/api/goals/${goalData.id}`, {
              credentials: 'include',
            });
            if (goalResponse.ok) {
              const updatedGoal = await goalResponse.json();
              console.log('Goal completed and refreshed:', updatedGoal);
            }
          } catch (error) {
            console.error('Error refreshing goal data after completion:', error);
          }
        }, 500);
      } else {
        toast({
          title: 'Failed to complete goal',
          description: 'Could not mark goal as completed.',
          variant: 'destructive',
        });
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

  const handleEditGoal = (goalId: string, updates: any) => {
    // TODO: Implement goal update API call
    console.log('Edit goal:', goalId, updates);
    // Refresh goal data after edit
    console.log('Goal edit completed - would refresh in production');
  };

  // Function to refresh goal data
  const refreshGoalData = async () => {
    try {
      const response = await fetch(`/api/goals/${goalData.id}`, {
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

  // Handle habit completion with refresh
  const handleHabitComplete = async (habitId: string) => {
    try {
      await onCompleteHabit(habitId);
      
      // Refresh goal data after habit completion
      setTimeout(async () => {
        try {
          const response = await fetch(`/api/goals/${goalData.id}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const updatedGoal = await response.json();
            // Force a re-render by updating the goal prop
            // This will trigger the useEffect and update the progress
            console.log('Goal data refreshed after habit completion:', updatedGoal);
            
            // Update the local state to reflect the new data
            setProgress(updatedGoal.goalInstance?.currentValue || 0);
          }
        } catch (error) {
          console.error('Error refreshing goal data:', error);
        }
      }, 500); // Small delay to ensure backend update completes
    } catch (error) {
      console.error('Error completing habit:', error);
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
        
        const response = await fetch(`/api/goals/${goalData.id}/habits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            habitDefinitionId: selectedHabitId,
            targetValue: targetValue,
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Response error:', errorText);
          
          // Check if it's the "already associated" error
          if (errorText.includes("Habit already associated")) {
            alert("This habit is already associated with this goal.");
            return;
          }
          
          throw new Error('Failed to add habit to goal');
        }
        
        // Call the parent's onAddHabit function
        const selectedHabit = existingHabits.find((h: any) => h.id === selectedHabitId);
        if (selectedHabit) {
          onAddHabit(goalData.id, selectedHabit);
        }
        
        // Refresh the goal data to show the new habit
        try {
          const goalResponse = await fetch(`/api/goals/${goalData.id}`, { credentials: 'include' });
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
        const createResponse = await fetch('/api/goals/habits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: newHabitTitle,
            description: newHabitDescription,
          }),
        });
        
        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error('Create habit response error:', errorText);
          throw new Error('Failed to create habit');
        }
        const newHabit = await createResponse.json();
        console.log('Created new habit:', newHabit);
        
        // Then add it to the goal
        const addResponse = await fetch(`/api/goals/${goalData.id}/habits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            habitDefinitionId: newHabit.id,
            targetValue: targetValue,
          }),
        });
        
        if (!addResponse.ok) throw new Error('Failed to add habit to goal');
        
        onAddHabit(goalData.id, newHabit);
      }
      
      // Reset form and close panel
      setSelectedHabitId("");
      setNewHabitTitle("");
      setNewHabitDescription("");
      setTargetValue(1);
      setSearchTerm("");
      setShowAddHabitPanel(false);
      
    } catch (error) {
      console.error('Error adding habit:', error);
      alert('Failed to add habit to goal');
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {/* Main Goal Content */}
          <div className={`transition-transform duration-300 ${showAddHabitPanel ? '-translate-x-full' : 'translate-x-0'}`}>
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
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-1"
                  onClick={() => setShowEditGoal(true)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
              <DialogTitle className="text-xl font-bold">{goalData.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
            {/* Goal Progress Section */}
            <Card>
              <CardContent className="p-6">
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
                        min="0"
                        max="100"
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
                </div>
              </CardContent>
            </Card>

            {/* Associated Habits Section */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Associated Habits</h3>
                  <Button
                    onClick={() => setShowAddHabitPanel(true)}
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Habit</span>
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {goalData.habits.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      No habits associated with this goal yet.
                    </p>
                  ) : (
                    goalData.habits.map((habit) => (
                      <HabitCompletionProgress
                        key={habit.id}
                        habit={habit}
                        onComplete={() => handleHabitComplete(habit.id)}
                        onRemove={() => onRemoveHabit(goalData.id, habit.id)}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Add Habit Sliding Panel */}
        <div className={`absolute inset-0 bg-white transition-transform duration-300 ${showAddHabitPanel ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 h-full overflow-y-auto">
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
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="select">Select Existing</TabsTrigger>
                <TabsTrigger value="create">Create New</TabsTrigger>
              </TabsList>

              <TabsContent value="select" className="space-y-4 mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search habits..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Select a habit to add to this goal:</p>
                  {isLoading ? (
                    <div className="text-center py-4">
                      <div className="text-gray-600">Loading habits...</div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
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
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedHabitId === habit.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:bg-gray-50'
                            } ${!habit.isActive ? 'opacity-60' : ''}`}
                            onClick={() => setSelectedHabitId(habit.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{habit.title}</div>
                              {!habit.isActive && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {habit.description && (
                              <div className="text-sm text-gray-600 mt-1">{habit.description}</div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                
                {selectedHabitId && (
                  <div className="space-y-2">
                    <Label htmlFor="targetValue">Target Value for this Goal</Label>
                    <Input
                      id="targetValue"
                      type="number"
                      min="1"
                      value={targetValue}
                      onChange={(e) => setTargetValue(Number(e.target.value))}
                      placeholder="e.g., 5"
                    />
                    <p className="text-xs text-gray-500">How many times should this habit be completed to contribute to the goal?</p>
                  </div>
                )}
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
                
                <div>
                  <Label htmlFor="newHabitTargetValue">Target Value for this Goal</Label>
                  <Input
                    id="newHabitTargetValue"
                    type="number"
                    min="1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(Number(e.target.value))}
                    placeholder="e.g., 5"
                  />
                  <p className="text-xs text-gray-500">How many times should this habit be completed to contribute to the goal?</p>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end space-x-2 pt-6">
              <Button variant="outline" onClick={() => setShowAddHabitPanel(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddHabit}>
                Add Habit
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      </Dialog>

      {/* Edit Goal Modal */}
      <EditGoalModal
        isOpen={showEditGoal}
        onClose={() => setShowEditGoal(false)}
        goal={goalData}
        onSave={handleEditGoal}
      />
    </>
  );
}; 