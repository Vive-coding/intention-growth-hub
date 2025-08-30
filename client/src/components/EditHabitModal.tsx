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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      
      // Since we don't have a direct API endpoint for habit details,
      // we need to infer the frequency settings from the target value
      // This is a temporary solution until we add a proper endpoint
      
      // For now, set reasonable defaults and let the user adjust
      setFrequency("daily");
      setPerPeriodTarget(1);
      setPeriodsCount(currentTargetValue);
      
      console.log('🟣 EditHabitModal - Set default values:', {
        frequency: "daily",
        perPeriodTarget: 1,
        periodsCount: currentTargetValue
      });
      
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
      // Update the habit-goal association
      await apiRequest(`/api/goals/${goalId}/habits/${habitDefinitionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          targetValue: totalTarget,
          frequency: frequency,
          perPeriodTarget: perPeriodTarget,
          periodsCount: periodsCount,
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
            <DialogTitle className="text-lg font-bold">Edit Habit: {habitName}</DialogTitle>
            <DialogDescription className="text-sm">
              Modify how this habit contributes to your goal
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
            <div className="text-sm text-gray-600">
              Editing targets for this goal
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select 
                  value={frequency} 
                  onValueChange={(val: "daily" | "weekly" | "monthly") => setFrequency(val)}
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


