
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
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
  Search
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Logo } from "@/components/ui/Logo";
import { GoalDetailModal } from "./GoalDetailModal";
import { AddHabitModal } from "./AddHabitModal";
import { EditGoalModal } from "./EditGoalModal";
import { CreateGoalModal } from "./CreateGoalModal";
import { apiRequest } from "@/lib/queryClient";

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

interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate: string;
  status: 'active' | 'completed' | 'overdue';
  progress: number;
  currentValue?: number;
  targetValue?: number;
  lifeMetric: {
    id: string;
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
  createdAt: string;
  completedAt?: string;
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

export const GoalsScreen = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [suggestedGoals, setSuggestedGoals] = useState<any[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [lifeMetrics, setLifeMetrics] = useState<LifeMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoalDetails, setSelectedGoalDetails] = useState<Goal | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [showProgressUpdateModal, setShowProgressUpdateModal] = useState(false);
  const [selectedGoalForProgress, setSelectedGoalForProgress] = useState<Goal | null>(null);
  const [filterMetric, setFilterMetric] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  // Use a single dropdown filter; remove extra toggles
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all, active, completed, archived

  // Fetch data on component mount
  useEffect(() => {
    fetchGoals();
    fetchSuggestedGoals();
    fetchHabits();
    fetchLifeMetrics();
  }, []);

  // Refetch goals when filters change
  useEffect(() => {
    fetchGoals();
  }, [filterMetric, statusFilter]);

  const fetchGoals = async () => {
    try {
      // Build query parameters for filtering
      const params = new URLSearchParams();
      if (filterMetric) params.append('metric', filterMetric);
      
      // Handle archived status differently - server expects showArchived=true
      if (statusFilter === 'archived') {
        params.append('showArchived', 'true');
        // Don't send status parameter when showing archived - server will show all archived goals
      } else if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      const queryString = params.toString();
      const url = queryString ? `/api/goals?${queryString}` : '/api/goals';
      
      const response = await apiRequest(url);
      setGoals(response);
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
  };

  const fetchSuggestedGoals = async () => {
    try {
      const response = await apiRequest('/api/goals/suggested');
      setSuggestedGoals(response);
    } catch (error) {
      console.error('Error fetching suggested goals:', error);
    }
  };

  const fetchHabits = async () => {
    try {
      const response = await apiRequest('/api/goals/habits');
      setHabits(response);
    } catch (error) {
      console.error('Error fetching habits:', error);
    }
  };

  const fetchLifeMetrics = async () => {
    try {
      const response = await apiRequest('/api/life-metrics');
      setLifeMetrics(response);
    } catch (error) {
      console.error('Error fetching life metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async (goalData: any) => {
    try {
      const response = await apiRequest('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(goalData),
      });
      
      if (response) {
        await fetchGoals();
        return response;
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    }
  };

  const updateGoalProgress = async (goalId: string, progress: number) => {
    try {
      const response = await apiRequest(`/api/goals/${goalId}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ progress }),
      });
      
      if (response) {
        await fetchGoals();
        return response;
      }
    } catch (error) {
      console.error('Error updating goal progress:', error);
      throw error;
    }
  };

  const completeGoal = async (goalId: string) => {
    try {
      const response = await apiRequest(`/api/goals/${goalId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'completed', completedAt: new Date().toISOString() }),
      });
      
      if (response) {
        await fetchGoals();
        return response;
      }
    } catch (error) {
      console.error('Error completing goal:', error);
      throw error;
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const response = await apiRequest(`/api/goals/${goalId}`, {
        method: 'DELETE',
      });
      
      if (response) {
        await fetchGoals();
        return response;
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw error;
    }
  };

  const completeHabit = async (habitId: string) => {
    try {
      const response = await apiRequest(`/api/goals/habits/${habitId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
      
      if (response) {
        await fetchGoals();
        await fetchHabits();
        return response;
      }
    } catch (error) {
      console.error('Error completing habit:', error);
      throw error;
    }
  };

  const addHabitToGoal = async (goalId: string, habitData: any) => {
    try {
      const response = await apiRequest(`/api/goals/${goalId}/habits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(habitData),
      });
      
      if (response) {
        await fetchGoals();
        return response;
      }
    } catch (error) {
      console.error('Error adding habit to goal:', error);
      throw error;
    }
  };

  const removeHabitFromGoal = async (goalId: string, habitId: string) => {
    try {
      const response = await apiRequest(`/api/goals/${goalId}/habits/${habitId}`, {
        method: 'DELETE',
      });
      
      if (response) {
        await fetchGoals();
        return response;
      }
    } catch (error) {
      console.error('Error removing habit from goal:', error);
      throw error;
    }
  };

  const handleGoalClick = async (goal: Goal) => {
    try {
      const goalResponse = await apiRequest(`/api/goals/${goal.id}`, { credentials: 'include' });
      setSelectedGoalDetails(goalResponse);
      setShowGoalModal(true);
    } catch (error) {
      console.error('Error fetching goal details:', error);
    }
  };

  const handleProgressUpdate = async (goalId: string, newProgress: number) => {
    try {
      const response = await apiRequest(`/api/goals/${goalId}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ currentValue: newProgress }),
      });
      
      if (response) {
        await fetchGoals();
        return response;
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      throw error;
    }
  };

  const handleHabitComplete = async (habitId: string, goalId?: string) => {
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
        await fetchGoals();
        await fetchHabits();
        return response;
      }
    } catch (error) {
      console.error('Error completing habit:', error);
      throw error;
    }
  };

  const handleAddHabitToGoal = async (goalId: string, habitData: any) => {
    try {
      console.log('🟣 GoalsScreen - Adding habit to goal:', { goalId, habitData, selectedGoalDetailsId: selectedGoalDetails?.id });
      
      // Only fetch goal details if we have them
      if (selectedGoalDetails?.id) {
        const goalResponse = await apiRequest(`/api/goals/${selectedGoalDetails.id}`);
        setSelectedGoalDetails(goalResponse);
      }
      
      const response = await apiRequest(`/api/goals/${goalId}/habits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(habitData),
      });
      
      if (response) {
        await fetchGoals();
        return response;
      }
    } catch (error) {
      console.error('Error adding habit to goal:', error);
      throw error;
    }
  };

  const handleRemoveHabitFromGoal = async (goalId: string, habitId: string) => {
    try {
      console.log('🟣 GoalsScreen - Removing habit from goal:', { goalId, habitId, selectedGoalDetailsId: selectedGoalDetails?.id });
      
      // Only fetch goal details if we have them
      if (selectedGoalDetails?.id) {
        const goalResponse = await apiRequest(`/api/goals/${selectedGoalDetails.id}`);
        setSelectedGoalDetails(goalResponse);
      }
      
      const response = await apiRequest(`/api/goals/${goalId}/habits/${habitId}`, {
        method: 'DELETE',
      });
      
      if (response) {
        await fetchGoals();
        return response;
      }
    } catch (error) {
      console.error('Error removing habit from goal:', error);
      throw error;
    }
  };

  // Filter goals based on search criteria (client-side filtering for search only)
  const filteredGoals = goals
    .filter(goal => {
      const matchesSearch = goal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           goal.description?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
    .slice()
    .sort((a, b) => (b.progress || 0) - (a.progress || 0));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-4 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading goals...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="Your Goals"
          description="Track your progress and stay motivated"
          icon={<Target className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />}
          showAddButton={true}
          addButtonText="Add Goal"
          addButtonIcon={<Plus className="w-4 h-4" />}
          onAddClick={() => setShowCreateGoalModal(true)}
          filters={[
            {
              label: "Life Metric",
              value: filterMetric || "all",
              options: [
                { value: "all", label: "All metrics" },
                ...lifeMetrics.map((metric) => ({
                  value: metric.name,
                  label: metric.name
                }))
              ],
              onChange: setFilterMetric
            },
            {
              label: "Status",
              value: statusFilter,
              options: [
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
                { value: "archived", label: "Archived" }
              ],
              onChange: setStatusFilter
            }
          ]}
        />

        {/* Search Bar */}
        <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search goals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Goals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGoals.map((goal) => (
            <Card
              key={goal.id}
              className="shadow-md border-0 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleGoalClick(goal)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-2">{goal.title}</h3>
                    {goal.description && (
                      <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {goal.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    <Badge
                      variant={goal.status === 'completed' ? 'default' : 'secondary'}
                      className={goal.status === 'overdue' ? 'bg-red-100 text-red-800' : ''}
                    >
                      {goal.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                  
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      <span>{goal.habits.length} habits</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(goal.targetDate).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div 
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                      style={{ 
                        backgroundColor: getPillBackgroundColor(goal.lifeMetric.name),
                        color: getPillTextColor(goal.lifeMetric.name)
                      }}
                    >
                      {goal.lifeMetric.name}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredGoals.length === 0 && !loading && (
          <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8 text-center">
              <Target className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No goals found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || filterMetric 
                  ? "Try adjusting your search or filter criteria"
                  : "Create your first goal to start tracking your progress"
                }
              </p>
              <Button
                onClick={() => setShowCreateGoalModal(true)}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Goal
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Modals */}
        {selectedGoalDetails && (
          <GoalDetailModal
            isOpen={showGoalModal}
            onClose={() => {
              setShowGoalModal(false);
              setSelectedGoalDetails(null);
            }}
            goal={selectedGoalDetails}
            onUpdateProgress={handleProgressUpdate}
            onAddHabit={handleAddHabitToGoal}
            onRemoveHabit={handleRemoveHabitFromGoal}
            onCompleteHabit={handleHabitComplete}
          />
        )}

        <CreateGoalModal
          isOpen={showCreateGoalModal}
          onClose={() => setShowCreateGoalModal(false)}
          onGoalCreated={fetchGoals}
        />

        <AddHabitModal
          isOpen={showAddHabitModal}
          onClose={() => setShowAddHabitModal(false)}
          onHabitAdded={fetchGoals}
          onHabitAddedWithSelections={async (data) => {
            console.log('🟣 GoalsScreen - Habit added with selections:', data);
            console.log('🟣 GoalsScreen - Current selectedGoalDetails:', selectedGoalDetails);
            // Refresh goals to show the new habit
            await fetchGoals();
            // If we have specific goal IDs, refresh those goal details
            if (data.associatedGoalIds && data.associatedGoalIds.length > 0) {
              for (const goalId of data.associatedGoalIds) {
                try {
                  const goalResponse = await apiRequest(`/api/goals/${goalId}`);
                  console.log('🟣 GoalsScreen - Refreshed goal details:', goalResponse);
                  
                  // Update the selectedGoalDetails if this is the currently selected goal
                  console.log('🟣 GoalsScreen - Comparing IDs:', {
                    selectedGoalDetailsId: selectedGoalDetails?.id,
                    goalId,
                    match: selectedGoalDetails?.id === goalId
                  });
                  
                  if (selectedGoalDetails && selectedGoalDetails.id === goalId) {
                    setSelectedGoalDetails(goalResponse);
                    console.log('🟣 GoalsScreen - Updated selectedGoalDetails with new habit data');
                  } else {
                    console.log('🟣 GoalsScreen - ID mismatch, not updating selectedGoalDetails');
                  }
                } catch (error) {
                  console.warn('🟣 GoalsScreen - Failed to refresh goal details for:', goalId, error);
                }
              }
            }
          }}
        />

        {/* GoalProgressUpdate component removed due to type mismatches */}
      </div>
    </div>
  );
};
