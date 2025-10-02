import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronRight, ChevronLeft, Target, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface CreateGoalWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalCreated: () => void;
  suggestedGoalId: string;
  prefillData: {
    title: string;
    description: string;
    lifeMetricId: string;
    lifeMetricName: string;
    lifeMetricColor: string;
  };
}

interface SuggestedHabit {
  id: string;
  title: string;
  description: string;
  priority: number;
  isHighLeverage: boolean;
  targetFrequency: string;
  targetCount: number;
}

interface ExistingHabit {
  id: string;
  name: string;
  description: string;
}

type Frequency = "daily" | "weekly" | "monthly";

export const CreateGoalWizard = ({
  isOpen,
  onClose,
  onGoalCreated,
  suggestedGoalId,
  prefillData
}: CreateGoalWizardProps) => {
  const queryClient = useQueryClient();
  
  // Step 1: Goal details
  const [title, setTitle] = useState(prefillData.title);
  const [description, setDescription] = useState(prefillData.description);
  const [targetDate, setTargetDate] = useState("");
  const [targetValue, setTargetValue] = useState(1);
  const [selectedLifeMetricId, setSelectedLifeMetricId] = useState(prefillData.lifeMetricId);
  const [lifeMetrics, setLifeMetrics] = useState<Array<{ id: string; name: string; color: string }>>([]);

  // Step 2: Habit selection
  const [suggestedHabits, setSuggestedHabits] = useState<SuggestedHabit[]>([]);
  const [existingHabits, setExistingHabits] = useState<ExistingHabit[]>([]);
  const [selectedSuggestedHabitIds, setSelectedSuggestedHabitIds] = useState<string[]>([]);
  const [selectedExistingHabitIds, setSelectedExistingHabitIds] = useState<string[]>([]);

  // Step 3: Habit targets
  const [habitTargets, setHabitTargets] = useState<{
    [habitId: string]: {
      frequency: Frequency;
      perPeriodTarget: number;
      periodsCount: number;
    };
  }>({});

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetchingHabits, setFetchingHabits] = useState(false);
  const totalSteps = 3;

  // Fetch suggested habits when modal opens
  useEffect(() => {
    if (isOpen && suggestedGoalId && currentStep === 2 && suggestedHabits.length === 0) {
      fetchSuggestedHabits();
    }
  }, [isOpen, suggestedGoalId, currentStep]);

  // Fetch life metrics when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchLifeMetrics();
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(prefillData.title);
      setDescription(prefillData.description);
      setTargetDate("");
      setTargetValue(1);
      setSelectedLifeMetricId(prefillData.lifeMetricId);
      setCurrentStep(1);
      setSuggestedHabits([]);
      setExistingHabits([]);
      setSelectedSuggestedHabitIds([]);
      setSelectedExistingHabitIds([]);
      setHabitTargets({});
    }
  }, [isOpen, prefillData]);

  const fetchLifeMetrics = async () => {
    try {
      const metrics = await apiRequest('/api/life-metrics');
      setLifeMetrics(metrics);
    } catch (error) {
      console.error("Error fetching life metrics:", error);
    }
  };

  const fetchSuggestedHabits = async () => {
    setFetchingHabits(true);
    try {
      const response = await apiRequest(`/api/goals/suggested/${suggestedGoalId}/habits`);
      setSuggestedHabits(response.suggestedHabits || []);
      setExistingHabits(response.existingHabits || []);
      
      // Pre-select essential habits (priority 1)
      const essentialHabits = (response.suggestedHabits || [])
        .filter((h: SuggestedHabit) => h.priority === 1)
        .map((h: SuggestedHabit) => h.id);
      setSelectedSuggestedHabitIds(essentialHabits);
    } catch (error) {
      console.error("Error fetching suggested habits:", error);
    } finally {
      setFetchingHabits(false);
    }
  };

  const computePeriodsCount = (frequency: Frequency): number => {
    if (!targetDate) return 1;
    const now = new Date();
    const end = new Date(targetDate);
    const diffDays = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    
    if (frequency === "daily") return Math.max(1, diffDays);
    if (frequency === "weekly") return Math.max(1, Math.ceil(diffDays / 7));
    return Math.max(1, Math.ceil(diffDays / 30));
  };

  const nextStep = () => {
    if (currentStep === 2) {
      // Initialize habit targets when moving to step 3
      const allSelectedIds = [...selectedSuggestedHabitIds, ...selectedExistingHabitIds];
      const targets: typeof habitTargets = {};
      
      allSelectedIds.forEach(habitId => {
        const suggestedHabit = suggestedHabits.find(h => h.id === habitId);
        const frequency = (suggestedHabit?.targetFrequency || 'daily') as Frequency;
        
        targets[habitId] = {
          frequency,
          perPeriodTarget: suggestedHabit?.targetCount || 1,
          periodsCount: computePeriodsCount(frequency)
        };
      });
      
      setHabitTargets(targets);
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return title.trim().length > 0 && targetDate !== "";
      case 2:
        return selectedSuggestedHabitIds.length + selectedExistingHabitIds.length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiRequest('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          lifeMetricId: selectedLifeMetricId,
          targetValue,
          targetDate,
          habitIds: selectedExistingHabitIds,
          suggestedHabitIds: selectedSuggestedHabitIds,
          habitTargets
        }),
      });

      // Archive the suggested goal
      await apiRequest(`/api/insights/goals/${suggestedGoalId}/archive`, { method: 'POST' });
      
      // Record acceptance feedback
      await apiRequest('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          type: 'suggested_goal',
          itemId: suggestedGoalId,
          action: 'accept',
          context: { source: 'goal_wizard' }
        })
      });

      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/goals/suggested'] });
      
      onGoalCreated();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating goal:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle(prefillData.title);
    setDescription(prefillData.description);
    setTargetDate("");
    setTargetValue(1);
    setSelectedLifeMetricId(prefillData.lifeMetricId);
    setSelectedSuggestedHabitIds([]);
    setSelectedExistingHabitIds([]);
    setHabitTargets({});
    setCurrentStep(1);
    setSuggestedHabits([]);
    setExistingHabits([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return "Essential";
      case 2: return "Helpful";
      case 3: return "Optional";
      default: return "Optional";
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "bg-red-100 text-red-800 border-red-200";
      case 2: return "bg-blue-100 text-blue-800 border-blue-200";
      case 3: return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Create Goal
          </DialogTitle>
          <div className="text-sm text-gray-500">
            Step {currentStep} of {totalSteps}
          </div>
        </DialogHeader>

        {/* Step 1: Goal Details */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Goal Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter goal title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What do you want to achieve?"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="lifeMetric">Life Metric</Label>
              <select
                id="lifeMetric"
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                value={selectedLifeMetricId}
                onChange={(e) => setSelectedLifeMetricId(e.target.value)}
              >
                {lifeMetrics.map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="targetDate">Target Date *</Label>
              <Input
                id="targetDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        )}

        {/* Step 2: Select Habits */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-lg mb-2">Select Habits to Support This Goal</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose suggested habits or existing habits that will help you achieve this goal.
              </p>
            </div>

            {fetchingHabits ? (
              <div className="text-center py-8 text-gray-500">Loading habits...</div>
            ) : (
              <>
                {/* Suggested Habits */}
                {suggestedHabits.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">✨ AI-Suggested Habits</h4>
                    {suggestedHabits.map((habit) => (
                      <div
                        key={habit.id}
                        className={cn(
                          "border rounded-lg p-4 cursor-pointer transition-all",
                          selectedSuggestedHabitIds.includes(habit.id)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => {
                          setSelectedSuggestedHabitIds(prev =>
                            prev.includes(habit.id)
                              ? prev.filter(id => id !== habit.id)
                              : [...prev, habit.id]
                          );
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedSuggestedHabitIds.includes(habit.id)}
                            onCheckedChange={() => {}}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h5 className="font-medium">{habit.title}</h5>
                              {habit.isHighLeverage && (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  High Leverage
                                </Badge>
                              )}
                              <Badge variant="outline" className={getPriorityColor(habit.priority)}>
                                {getPriorityLabel(habit.priority)}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{habit.description}</p>
                            <div className="text-xs text-gray-500 mt-1">
                              {habit.targetFrequency} • {habit.targetCount}x per period
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Existing Habits */}
                {existingHabits.length > 0 && (
                  <div className="space-y-3 mt-6">
                    <h4 className="font-medium text-gray-700">📋 Your Existing Habits</h4>
                    {existingHabits.map((habit) => (
                      <div
                        key={habit.id}
                        className={cn(
                          "border rounded-lg p-4 cursor-pointer transition-all",
                          selectedExistingHabitIds.includes(habit.id)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => {
                          setSelectedExistingHabitIds(prev =>
                            prev.includes(habit.id)
                              ? prev.filter(id => id !== habit.id)
                              : [...prev, habit.id]
                          );
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedExistingHabitIds.includes(habit.id)}
                            onCheckedChange={() => {}}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <h5 className="font-medium">{habit.name}</h5>
                            {habit.description && (
                              <p className="text-sm text-gray-600 mt-1">{habit.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {suggestedHabits.length === 0 && existingHabits.length === 0 && !fetchingHabits && (
                  <div className="text-center py-8 text-gray-500">
                    No habits available. You can add habits after creating the goal.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Set Targets */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-lg mb-2">Set Habit Targets</h3>
              <p className="text-sm text-gray-600 mb-4">
                Define how often you'll complete each habit to achieve your goal by {targetDate}.
              </p>
            </div>

            {Object.keys(habitTargets).map(habitId => {
              const habit = suggestedHabits.find(h => h.id === habitId) 
                || existingHabits.find(h => h.id === habitId);
              if (!habit) return null;

              const target = habitTargets[habitId];
              const habitTitle = 'title' in habit ? habit.title : habit.name;

              return (
                <div key={habitId} className="border rounded-lg p-4 space-y-3">
                  <h5 className="font-medium">{habitTitle}</h5>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Frequency</Label>
                      <select
                        className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                        value={target.frequency}
                        onChange={(e) => {
                          const newFrequency = e.target.value as Frequency;
                          setHabitTargets(prev => ({
                            ...prev,
                            [habitId]: {
                              ...prev[habitId],
                              frequency: newFrequency,
                              periodsCount: computePeriodsCount(newFrequency)
                            }
                          }));
                        }}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs">Per Period</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={target.perPeriodTarget}
                        onChange={(e) => {
                          setHabitTargets(prev => ({
                            ...prev,
                            [habitId]: {
                              ...prev[habitId],
                              perPeriodTarget: parseInt(e.target.value) || 1
                            }
                          }));
                        }}
                        min={1}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Periods</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={target.periodsCount}
                        onChange={(e) => {
                          setHabitTargets(prev => ({
                            ...prev,
                            [habitId]: {
                              ...prev[habitId],
                              periodsCount: parseInt(e.target.value) || 1
                            }
                          }));
                        }}
                        min={1}
                      />
                    </div>
                  </div>

                  <div className="text-xs text-gray-600">
                    Total: {target.perPeriodTarget * target.periodsCount} completions by {targetDate}
                  </div>
                </div>
              );
            })}

            {Object.keys(habitTargets).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No habits selected. Go back to select habits.
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <div className="flex gap-2">
            {currentStep < totalSteps ? (
              <Button
                onClick={nextStep}
                disabled={!canProceedToNext()}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading || Object.keys(habitTargets).length === 0}
              >
                {loading ? "Creating..." : "Create Goal"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

