import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Target, CheckCircle, Edit } from "lucide-react";
import { useState } from "react";
import { EditHabitModal } from "./EditHabitModal";

interface HabitCompletionProgressProps {
  habit: {
    id: string;
    title: string;
    description?: string;
    category?: string;
    targetValue: number;
    currentValue: number;
    goalSpecificStreak: number;
    // Add goal-specific data for editing
    goalId: string;
    habitDefinitionId: string; // Changed from habitInstanceId
  };
  onComplete: () => void;
  onRemove: () => void;
  onHabitUpdated?: () => void; // Add callback for when habit is updated
}

export const HabitCompletionProgress = ({
  habit,
  onComplete,
  onRemove,
  onHabitUpdated,
}: HabitCompletionProgressProps) => {
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Calculate progress based on current value and target value
  const getProgressPercentage = () => {
    if (!habit.targetValue || habit.targetValue === 0) return 0;
    
    const progress = (habit.currentValue / habit.targetValue) * 100;
    return Math.min(progress, 100);
  };

  const progressPercentage = getProgressPercentage();

  return (
    <>
      <Card className="shadow-sm border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-gray-800 mb-2">{habit.title}</h4>
              
              {/* Progress Section */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-semibold text-green-600">{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
                
                {/* Target vs Actual */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {habit.currentValue} / {habit.targetValue} completions
                  </span>
                </div>
              </div>

              {/* Streak Information */}
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1 text-orange-600">
                  <Flame className="w-4 h-4" />
                  <span>{habit.goalSpecificStreak} day streak</span>
                </div>
                <div className="flex items-center space-x-1 text-gray-600">
                  <Target className="w-4 h-4" />
                  <span>Total: {habit.currentValue}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-2 ml-4">
              <button
                onClick={onComplete}
                className="flex items-center justify-center w-8 h-8 bg-green-100 hover:bg-green-200 text-green-600 rounded-full transition-colors"
                title="Complete today"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center justify-center w-8 h-8 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-colors"
                title="Edit habit targets"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={onRemove}
                className="flex items-center justify-center w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"
                title="Remove from goal"
              >
                <span className="text-sm font-bold">×</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Habit Modal */}
      <EditHabitModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        habitId={habit.id}
        habitName={habit.title}
        habitDescription={habit.description}
        goalId={habit.goalId}
        habitDefinitionId={habit.habitDefinitionId}
        currentTargetValue={habit.targetValue}
        onHabitUpdated={() => {
          // Close the modal and notify parent to refresh
          setShowEditModal(false);
          onHabitUpdated?.();
        }}
      />
    </>
  );
}; 