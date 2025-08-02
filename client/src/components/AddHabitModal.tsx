import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface AddHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHabit: (habit: any) => void;
  goalId: string;
  lifeMetric?: string; // Auto-fill the life metric when creating from a life metric page
}

interface SelectedHabit {
  habit: Habit;
  completionsNeeded: number;
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

export const AddHabitModal = ({
  isOpen,
  onClose,
  onAddHabit,
  goalId,
  lifeMetric,
}: AddHabitModalProps) => {
  const [activeTab, setActiveTab] = useState("select");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHabits, setSelectedHabits] = useState<SelectedHabit[]>([]);
  const [completionsNeeded, setCompletionsNeeded] = useState(1);
  
  // New habit form state
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [newHabitDescription, setNewHabitDescription] = useState("");
  const [newHabitCategory, setNewHabitCategory] = useState(lifeMetric || "");
  const [newHabitFrequency, setNewHabitFrequency] = useState("daily");
  const [newHabitCount, setNewHabitCount] = useState(1);

  // Fetch existing habits
  const { data: existingHabits = [], isLoading } = useQuery({
    queryKey: ['/api/goals/habits'],
    queryFn: async () => {
      const response = await fetch('/api/goals/habits', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch habits');
      return response.json();
    },
    retry: 1,
  });

  // Fetch life metrics for new habit creation
  const { data: lifeMetrics = [] } = useQuery({
    queryKey: ['/api/life-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/life-metrics', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch life metrics');
      return response.json();
    },
    retry: 1,
  });

  const filteredHabits = existingHabits.filter((habit: Habit) =>
    habit.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    habit.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectExistingHabit = (habit: Habit) => {
    const isAlreadySelected = selectedHabits.some(sh => sh.habit.id === habit.id);
    if (isAlreadySelected) {
      setSelectedHabits(selectedHabits.filter(sh => sh.habit.id !== habit.id));
    } else {
      setSelectedHabits([...selectedHabits, { habit, completionsNeeded }]);
    }
  };

  const handleCreateNewHabit = async () => {
    if (!newHabitTitle || !newHabitCategory) return;

    try {
      const response = await fetch('/api/goals/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: newHabitTitle,
          description: newHabitDescription,
          lifeMetricId: newHabitCategory,
          targetFrequency: newHabitFrequency,
          targetCount: newHabitCount,
        }),
      });

      if (!response.ok) throw new Error('Failed to create habit');
      
      const newHabit = await response.json();
      onAddHabit(newHabit);
    } catch (error) {
      console.error('Error creating habit:', error);
    }
  };

  const handleAddSelectedHabits = async () => {
    if (selectedHabits.length === 0) return;
    
    try {
      for (const selectedHabit of selectedHabits) {
        const response = await fetch(`/api/goals/${goalId}/habits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            habitId: selectedHabit.habit.id,
            completionsNeeded: selectedHabit.completionsNeeded,
          }),
        });
        
        if (!response.ok) throw new Error('Failed to add habit to goal');
      }
      
      // Call onAddHabit for each selected habit
      selectedHabits.forEach(sh => onAddHabit(sh.habit));
    } catch (error) {
      console.error('Error adding habits to goal:', error);
    }
  };

  const resetForm = () => {
    setSearchTerm("");
    setSelectedHabits([]);
    setCompletionsNeeded(1);
    setNewHabitTitle("");
    setNewHabitDescription("");
    setNewHabitCategory("");
    setNewHabitFrequency("daily");
    setNewHabitCount(1);
    setActiveTab("select");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Add Habit to Goal</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select">Select Existing Habit</TabsTrigger>
            <TabsTrigger value="create">Create New Habit</TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-4">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search habits..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-600">Loading habits...</div>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredHabits.map((habit: Habit) => (
                    <Card
                      key={habit.id}
                      className={`cursor-pointer transition-colors ${
                        selectedHabits.some(sh => sh.habit.id === habit.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleSelectExistingHabit(habit)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-800">{habit.title}</h4>
                            {habit.description && (
                              <p className="text-sm text-gray-600 mt-1">{habit.description}</p>
                            )}
                            <div className="flex items-center space-x-2 mt-2">
                              <span
                                className="text-xs px-2 py-1 rounded-full"
                                style={{
                                  backgroundColor: `${habit.category ? '#6B7280' : '#6B7280'}20`,
                                  color: habit.category ? '#6B7280' : '#6B7280',
                                }}
                              >
                                {habit.category || 'General'}
                              </span>
                            </div>
                          </div>
                          {selectedHabits.some(sh => sh.habit.id === habit.id) && (
                            <div className="ml-2">
                              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {selectedHabits.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="completionsNeeded">Completions needed per goal progress:</Label>
                    <Input
                      id="completionsNeeded"
                      type="number"
                      min="1"
                      value={completionsNeeded}
                      onChange={(e) => setCompletionsNeeded(Number(e.target.value))}
                      className="w-20"
                    />
                  </div>
                  
                  <Button
                    onClick={handleAddSelectedHabits}
                    className="w-full"
                  >
                    Add {selectedHabits.length} Habit{selectedHabits.length !== 1 ? 's' : ''} to Goal
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="habit-title">Habit Title *</Label>
                <Input
                  id="habit-title"
                  value={newHabitTitle}
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                  placeholder="e.g., Morning meditation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="habit-description">Description (optional)</Label>
                <Input
                  id="habit-description"
                  value={newHabitDescription}
                  onChange={(e) => setNewHabitDescription(e.target.value)}
                  placeholder="Brief description of the habit"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="habit-category">Life Metric Category *</Label>
                <Select value={newHabitCategory} onValueChange={setNewHabitCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="habit-frequency">Target Frequency</Label>
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

                <div className="space-y-2">
                  <Label htmlFor="habit-count">Target Count</Label>
                  <Input
                    id="habit-count"
                    type="number"
                    min="1"
                    value={newHabitCount}
                    onChange={(e) => setNewHabitCount(Number(e.target.value))}
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateNewHabit}
                disabled={!newHabitTitle || !newHabitCategory}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create and Add Habit
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}; 