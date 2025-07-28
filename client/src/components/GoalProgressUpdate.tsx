import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Target, Plus, Minus } from "lucide-react";
import type { GoalInstance } from "@shared/schema";

interface GoalProgressUpdateProps {
  goalInstance: GoalInstance;
  onUpdate?: () => void;
}

export const GoalProgressUpdate = ({ goalInstance, onUpdate }: GoalProgressUpdateProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const currentValue = goalInstance.currentValue || 0;
  const targetValue = goalInstance.targetValue || 1;
  const [newValue, setNewValue] = useState(currentValue.toString());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const progressPercentage = Math.min(
    Math.round((currentValue / targetValue) * 100),
    100
  );

  const updateProgressMutation = useMutation({
    mutationFn: async (currentValue: number) => {
      const response = await fetch(`/api/goals/${goalInstance.id}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentValue }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Progress Updated!",
        description: "Your goal progress has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/life-metrics/progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/goal-instances'] });
      setIsUpdating(false);
      onUpdate?.();
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update goal progress. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to update goal progress:", error);
    }
  });

  const handleQuickUpdate = (increment: number) => {
    const newCurrentValue = Math.max(0, currentValue + increment);
    updateProgressMutation.mutate(newCurrentValue);
  };

  const handleCustomUpdate = () => {
    const value = parseFloat(newValue);
    if (isNaN(value) || value < 0) {
      toast({
        title: "Invalid Value",
        description: "Please enter a valid positive number.",
        variant: "destructive",
      });
      return;
    }
    updateProgressMutation.mutate(value);
  };

  const isCompleted = goalInstance.status === 'completed';

  return (
    <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Goal Progress
          </CardTitle>
          {isCompleted && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Completed!</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Display */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Current Progress
            </span>
            <span className="text-sm font-bold text-blue-600">
              {currentValue} / {targetValue} ({progressPercentage}%)
            </span>
          </div>
          <Progress value={progressPercentage} className="mb-2" />
          {!isCompleted && (
            <p className="text-xs text-gray-500">
              {targetValue - currentValue} more to reach your goal!
            </p>
          )}
        </div>

        {!isCompleted && (
          <>
            {/* Quick Update Buttons */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Quick Updates
              </Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickUpdate(1)}
                  disabled={updateProgressMutation.isPending}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  +1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickUpdate(5)}
                  disabled={updateProgressMutation.isPending}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  +5
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickUpdate(-1)}
                  disabled={updateProgressMutation.isPending || currentValue <= 0}
                  className="flex items-center gap-1"
                >
                  <Minus className="w-4 h-4" />
                  -1
                </Button>
              </div>
            </div>

            {/* Custom Update */}
            <div>
              <Label htmlFor="custom-value" className="text-sm font-medium text-gray-700 mb-2 block">
                Set Custom Value
              </Label>
              <div className="flex gap-2">
                <Input
                  id="custom-value"
                  type="number"
                  min="0"
                  step="0.1"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Enter new value"
                  className="flex-1"
                />
                <Button
                  onClick={handleCustomUpdate}
                  disabled={updateProgressMutation.isPending}
                  size="sm"
                >
                  Update
                </Button>
              </div>
            </div>
          </>
        )}

        {updateProgressMutation.isPending && (
          <div className="text-center py-2">
            <div className="text-sm text-blue-600">Updating progress...</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};