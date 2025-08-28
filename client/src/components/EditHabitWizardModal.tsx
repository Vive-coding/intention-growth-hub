import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Target, ChevronRight, ChevronLeft, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EditHabitWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit: {
    id: string;
    title: string;
    description?: string;
    category?: string;
  };
  onHabitUpdated?: () => void;
}

interface HabitGoalAssociation {
  id: string;
  goalId: string;
  goalTitle: string;
  goalTargetDate?: string;
  frequency: "daily" | "weekly" | "monthly";
  perPeriodTarget: number;
  periodsCount: number;
  currentTargetValue: number;
}

export const EditHabitWizardModal = ({ 
  isOpen, 
  onClose, 
  habit, 
  onHabitUpdated 
}: EditHabitWizardModalProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const stepTitles = [
    "Basic Information",
    "Goal Association", 
    "Set Targets"
  ];

  const [title, setTitle] = useState(habit.title);
  const [description, setDescription] = useState(habit.description || "");
  const [lifeMetricId, setLifeMetricId] = useState(habit.category || "");
  
  const [associations, setAssociations] = useState<HabitGoalAssociation[]>([]);
  const [availableGoals, setAvailableGoals] = useState<Array<{id: string, title: string}>>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load habit-goal associations when modal opens
  useEffect(() => {
    if (isOpen && !initialized) {
      loadHabitAssociations();
    }
  }, [isOpen, initialized]);

  const loadHabitAssociations = async () => {
    setLoading(true);
    try {
      // Fetch the habit's current associations with goals
      const response = await apiRequest(`/api/habits/${habit.id}/associations`);
      
      if (response && Array.isArray(response)) {
        const formattedAssociations = response.map((assoc: any) => {
          const targetValue = assoc.targetValue || 1;
          
          // Use the actual frequency settings from the database if available
          let frequency = 'daily';
          let perPeriodTarget = 1;
          let periodsCount = targetValue;
          
          if (assoc.frequencySettings) {
            frequency = assoc.frequencySettings.frequency || 'daily';
            perPeriodTarget = assoc.frequencySettings.perPeriodTarget || 1;
            periodsCount = assoc.frequencySettings.periodsCount || targetValue;
          } else {
            // Fallback for backward compatibility: infer from target value
            // If targetValue > 1, assume 1 per day × targetValue days
            perPeriodTarget = 1;
            periodsCount = targetValue;
          }
          
          return {
            id: assoc.id,
            goalId: assoc.goalId,
            goalTitle: assoc.goalTitle,
            goalTargetDate: assoc.goalTargetDate,
            frequency: frequency,
            perPeriodTarget: perPeriodTarget,
            periodsCount: periodsCount,
            currentTargetValue: targetValue,
          };
        });
        setAssociations(formattedAssociations);
      }

      // Fetch available goals for this habit
      await loadAvailableGoals();
      
      setInitialized(true);
    } catch (error) {
      console.error('Error loading habit associations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableGoals = async () => {
    try {
      // Fetch all active goals that this habit is not already associated with
      const response = await apiRequest('/api/goals');
      
      if (response && Array.isArray(response)) {
        const currentGoalIds = associations.map(assoc => assoc.goalId);
        const available = response
          .filter((goal: any) => !currentGoalIds.includes(goal.id))
          .map((goal: any) => ({
            id: goal.id,
            title: goal.title || goal.goalDefinition?.title || 'Untitled Goal'
          }));
        setAvailableGoals(available);
      }
    } catch (error) {
      console.error('Error loading available goals:', error);
    }
  };

  const addGoalAssociation = () => {
    if (!selectedGoalId) return;
    
    const selectedGoal = availableGoals.find(g => g.id === selectedGoalId);
    if (!selectedGoal) return;

    // For new associations, try to use the most common values from existing associations
    // or fall back to sensible defaults
    const existingFrequencies = associations.map(a => a.frequency);
    const mostCommonFrequency = existingFrequencies.length > 0 
      ? existingFrequencies.sort((a, b) => 
          existingFrequencies.filter(v => v === a).length - 
          existingFrequencies.filter(v => v === b).length
        ).pop() || 'daily'
      : 'daily';

    const newAssociation: HabitGoalAssociation = {
      id: `temp-${Date.now()}`, // Temporary ID for new associations
      goalId: selectedGoalId,
      goalTitle: selectedGoal.title,
      goalTargetDate: undefined,
      frequency: mostCommonFrequency,
      perPeriodTarget: 1,
      periodsCount: 1,
      currentTargetValue: 1,
    };

    setAssociations(prev => [...prev, newAssociation]);
    setSelectedGoalId('');
    
    // Refresh available goals
    loadAvailableGoals();
  };

  const removeGoalAssociation = (index: number) => {
    setAssociations(prev => prev.filter((_, i) => i !== index));
    
    // Refresh available goals
    loadAvailableGoals();
  };

  const nextStep = () => {
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
        return title.trim().length > 0;
      case 2:
        return associations.length > 0;
      default:
        return true;
    }
  };

  const handleStep2Next = () => {
    // Prepare rows for the targets step
    nextStep();
  };

  const handleSaveTargets = async () => {
    setSaving(true);
    try {
      // Handle each association (existing and new)
      for (const association of associations) {
        const totalTarget = association.perPeriodTarget * association.periodsCount;
        
        if (association.id.startsWith('temp-')) {
          // This is a new association - create it
          await apiRequest(`/api/goals/${association.goalId}/habits`, {
            method: 'POST',
            body: JSON.stringify({
              habitDefinitionId: habit.id,
              targetValue: totalTarget,
            }),
          });
        } else {
          // This is an existing association - update it
          await apiRequest(`/api/goals/${association.goalId}/habits/${habit.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              targetValue: totalTarget,
              frequency: association.frequency,
              perPeriodTarget: association.perPeriodTarget,
              periodsCount: association.periodsCount,
            }),
          });
        }
      }
      
      onHabitUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error updating habit associations:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateAssociation = (index: number, field: keyof HabitGoalAssociation, value: any) => {
    setAssociations(prev => prev.map((assoc, i) => {
      if (i === index) {
        return { ...assoc, [field]: value };
      }
      return assoc;
    }));
  };

  const allTargetsValid = associations.length > 0 && associations.every(
    (assoc) => assoc.perPeriodTarget >= 1 && assoc.periodsCount >= 1
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Habit Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Morning Exercise"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your habit..."
              />
            </div>
            
            <div>
              <Label htmlFor="category">Life Metric Category</Label>
              <Input
                id="category"
                value={lifeMetricId}
                onChange={(e) => setLifeMetricId(e.target.value)}
                placeholder="e.g., Health, Career, Relationships"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              {associations.length} goal{associations.length === 1 ? '' : 's'} associated with this habit
            </div>
            
            {/* Current Goal Associations */}
            <div className="space-y-3">
              {associations.map((assoc, idx) => (
                <div key={assoc.id} className="p-3 border rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <Target className="h-3 w-3 mr-1" /> Goal
                      </Badge>
                      <div className="font-medium">{assoc.goalTitle}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGoalAssociation(idx)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="text-sm text-gray-600">
                    Current target: {assoc.currentTargetValue} completions
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Goal Association */}
            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-2">Add to another goal</div>
              <div className="flex gap-2">
                <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a goal to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGoals.map((goal) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        {goal.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={addGoalAssociation}
                  disabled={!selectedGoalId}
                  size="sm"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Set targets for each goal
            </div>
            
            <div className="space-y-4">
              {associations.map((assoc, idx) => {
                const unit = assoc.frequency === 'daily' ? 'days' : assoc.frequency === 'weekly' ? 'weeks' : 'months';
                const total = assoc.perPeriodTarget * assoc.periodsCount;
                
                return (
                  <div key={assoc.id} className="rounded-lg border p-4 bg-white shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant="secondary">
                        <Target className="h-3 w-3 mr-1" /> Goal
                      </Badge>
                      <div className="font-medium">{assoc.goalTitle}</div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        <div className="space-y-2">
                          <Label>Frequency</Label>
                          <Select 
                            value={assoc.frequency} 
                            onValueChange={(val: "daily" | "weekly" | "monthly") => 
                              updateAssociation(idx, 'frequency', val)
                            }
                          >
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
                          <Label>Target per period</Label>
                          <Input 
                            type="number" 
                            min={1} 
                            value={assoc.perPeriodTarget} 
                            onChange={(e) => updateAssociation(idx, 'perPeriodTarget', Number(e.target.value))} 
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Number of {unit}</Label>
                          <Input 
                            type="number" 
                            min={1} 
                            value={assoc.periodsCount} 
                            onChange={(e) => updateAssociation(idx, 'periodsCount', Number(e.target.value))} 
                          />
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
                        {assoc.goalTargetDate ? (
                          <span className="mr-2">Target: {new Date(assoc.goalTargetDate).toLocaleDateString()} • </span>
                        ) : null}
                        {assoc.perPeriodTarget} per {assoc.frequency} × {assoc.periodsCount} {unit} = <span className="font-medium">{total}</span> total
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw]">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading habit associations...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader className="space-y-3">
          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-3">
            {stepTitles.map((stepTitle, index) => (
              <div key={index} className="flex items-center">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 ${
                  index + 1 < currentStep
                    ? 'bg-green-500 border-green-500 text-white'
                    : index + 1 === currentStep
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}>
                  {index + 1 < currentStep ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>
                <span className={`ml-1 text-xs font-medium ${
                  index + 1 === currentStep ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {stepTitle}
                </span>
                {index < stepTitles.length - 1 && (
                  <ChevronRight className="w-3 h-3 mx-1 text-gray-300" />
                )}
              </div>
            ))}
          </div>

          <div>
            <DialogTitle className="text-lg font-bold">
              {currentStep === 1 && "Edit Habit Information"}
              {currentStep === 2 && "Review Goal Associations"}
              {currentStep === 3 && `Set Targets for ${title}`}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {currentStep === 1 && "Update the basic information for this habit."}
              {currentStep === 2 && "Review which goals this habit contributes to."}
              {currentStep === 3 && "Define how this habit contributes to each selected goal."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="py-4">
          {renderStepContent()}
        </div>

        {/* Navigation Footer */}
        <div className="flex justify-between items-center pt-6 border-t">
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={prevStep}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>

          <div className="flex gap-2">
            {currentStep < totalSteps ? (
              <Button
                type="button"
                onClick={currentStep === 1 ? nextStep : handleStep2Next}
                disabled={!canProceedToNext()}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSaveTargets}
                disabled={!allTargetsValid || saving}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
