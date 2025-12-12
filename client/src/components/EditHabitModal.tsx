import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

interface EditHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  habitId: string;
  habitName: string;
  habitDescription?: string;
  goalId: string;
  habitDefinitionId: string; // Changed from habitInstanceId
  currentTargetValue: number;
  onHabitUpdated?: () => void;
}

export const EditHabitModal = ({ 
  isOpen, 
  onClose, 
  habitId, 
  habitName, 
  habitDescription, 
  goalId,
  habitDefinitionId,
  currentTargetValue,
  onHabitUpdated 
}: EditHabitModalProps) => {
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [perPeriodTarget, setPerPeriodTarget] = useState<number>(1);
  const [periodsCount, setPeriodsCount] = useState<number>(1);
  const [weekdaysOnly, setWeekdaysOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [goalTargetDate, setGoalTargetDate] = useState<string | null>(null);

  // Calculate total target based on current inputs
  const totalTarget = perPeriodTarget * periodsCount;

  // Load current habit settings when modal opens
  useEffect(() => {
    console.log('EditHabitModal useEffect - isOpen:', isOpen, 'habitDefinitionId:', habitDefinitionId, 'goalId:', goalId);
    if (isOpen && habitDefinitionId && goalId) {
      loadCurrentHabitSettings();
    }
  }, [isOpen, habitDefinitionId, goalId]);

  const loadCurrentHabitSettings = async () => {
    setLoading(true);
    try {
      console.log('Using current target value:', currentTargetValue);
      
      // Get the habit data from the goal detail endpoint
      // We need to find the habit in the goal's habits array
      const goalResponse = await apiRequest(`/api/goals/${goalId}`);
      const habit = goalResponse.habits?.find((h: any) => h.habitDefinitionId === habitDefinitionId);
      // Server nests target date under goalInstance.targetDate
      const instanceTargetDate = goalResponse.goalInstance?.targetDate;
      setGoalTargetDate(instanceTargetDate || null);
      
      if (habit && habit.frequencySettings) {
        // Use the stored frequency settings
        setFrequency(habit.frequencySettings.frequency || "daily");
        setPerPeriodTarget(habit.frequencySettings.perPeriodTarget || 1);
        setPeriodsCount(habit.frequencySettings.periodsCount || 1);
        setWeekdaysOnly(!!habit.frequencySettings.weekdaysOnly);
        
        console.log('🟣 EditHabitModal - Loaded saved frequency settings:', habit.frequencySettings);
      } else {
        // Fallback to inferring from target value (for backward compatibility)
        setFrequency("daily");
        setPerPeriodTarget(1);
        setPeriodsCount(currentTargetValue);
        
        console.log('🟣 EditHabitModal - No frequency settings found, using defaults:', {
          frequency: "daily",
          perPeriodTarget: 1,
          periodsCount: currentTargetValue
        });
      }
      
    } catch (error) {
      console.error('Error loading current habit settings:', error);
      // Set default values if loading fails
      setFrequency("daily");
      setPerPeriodTarget(1);
      setPeriodsCount(currentTargetValue);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // First, optionally recalculate based on remaining time using backend helper
      await apiRequest(`/api/goals/${goalId}/habits/${habitDefinitionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          targetValue: totalTarget,
          frequency,
          perPeriodTarget,
          periodsCount,
          weekdaysOnly: frequency === 'daily' ? weekdaysOnly : undefined,
        }),
      });
      
      // Call the update callback to refresh data
      onHabitUpdated?.();
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error('Error updating habit settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const getPeriodLabel = () => {
    switch (frequency) {
      case 'daily': return 'days';
      case 'weekly': return 'weeks';
      case 'monthly': return 'months';
      default: return 'periods';
    }
  };

  const recalcPeriodsFromTargetDate = (newFrequency: "daily" | "weekly" | "monthly", weekdaysFlag: boolean) => {
    if (!goalTargetDate) return periodsCount;
    const targetDate = new Date(goalTargetDate);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 1;

    if (newFrequency === "daily") {
      if (weekdaysFlag) {
        let weekdayCount = 0;
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        for (let i = 0; i < diffDays; i++) {
          const d = new Date(todayMidnight.getTime());
          d.setDate(todayMidnight.getDate() + i);
          const day = d.getDay();
          if (day !== 0 && day !== 6) {
            weekdayCount++;
          }
        }
        return Math.max(1, weekdayCount);
      }
      return Math.max(1, diffDays);
    }
    if (newFrequency === "weekly") {
      return Math.max(1, Math.ceil(diffDays / 7));
    }
    return Math.max(1, Math.ceil(diffDays / 30));
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw]">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading habit settings...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader className="space-y-3">
          <div>
            <DialogTitle className="text-lg font-bold">Edit Habit Targets for This Goal</DialogTitle>
            <DialogDescription className="text-sm">
              Adjust how "{habitName}" contributes to this specific goal's targets and frequency
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="py-4">
          {habitDescription && (
            <div className="text-sm text-gray-600 bg-gray-50 border rounded-lg p-3 mb-4">
              <strong>Description:</strong> {habitDescription}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  Want to edit the habit itself?
                </div>
                <div className="text-xs text-gray-600">
                  Change the habit title, description, or which goals it's linked to
                </div>
              </div>
              <a
                href={`/habits?edit=${habitDefinitionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium whitespace-nowrap ml-3"
              >
                Edit habit details →
              </a>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select 
                  value={frequency} 
                  onValueChange={(val: "daily" | "weekly" | "monthly") => {
                    setFrequency(val);
                    const nextPeriods = recalcPeriodsFromTargetDate(val, weekdaysOnly);
                    setPeriodsCount(nextPeriods);
                  }}
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
                <Label>Target per {frequency === 'daily' ? 'day' : frequency === 'weekly' ? 'week' : 'month'}</Label>
                <Input 
                  type="number" 
                  min={1} 
                  value={perPeriodTarget} 
                  onChange={(e) => setPerPeriodTarget(Number(e.target.value))} 
                />
              </div>
              
              <div className="space-y-2">
                <Label>Number of {getPeriodLabel()}</Label>
                <Input 
                  type="number" 
                  min={1} 
                  value={periodsCount} 
                  onChange={(e) => setPeriodsCount(Number(e.target.value))} 
                />
              </div>
            </div>
            
            {frequency === 'daily' && (
              <div className="flex items-center gap-2 mt-1 text-sm">
                <input
                  id="weekdays-only-toggle"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={weekdaysOnly}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setWeekdaysOnly(checked);
                    const nextPeriods = recalcPeriodsFromTargetDate("daily", checked);
                    setPeriodsCount(nextPeriods);
                  }}
                />
                <Label htmlFor="weekdays-only-toggle" className="text-sm font-normal">
                  Only count weekdays (Mon–Fri)
                </Label>
              </div>
            )}
            
            <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
              {perPeriodTarget} per {frequency} × {periodsCount} {getPeriodLabel()} = <span className="font-medium">{totalTarget}</span> total
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="flex justify-between items-center pt-6 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          
          <Button 
            type="button" 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};


