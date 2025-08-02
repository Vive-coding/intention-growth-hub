import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Flame, Calendar } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface HabitCompletionCardProps {
  habit: {
    id: string;
    title: string;
    description?: string;
    category?: string;
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
  };
}

export function HabitCompletionCard({ habit }: HabitCompletionCardProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const queryClient = useQueryClient();

  const completeHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      const response = await fetch(`/api/goals/habits/${habitId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: "" }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to complete habit");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refetch habits data
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      setIsCompleting(false);
    },
    onError: (error) => {
      console.error("Error completing habit:", error);
      setIsCompleting(false);
    },
  });

  const handleCompleteHabit = () => {
    setIsCompleting(true);
    completeHabitMutation.mutate(habit.id);
  };

  return (
    <Card className="w-full mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{habit.title}</CardTitle>
            {habit.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {habit.description}
              </p>
            )}
          </div>
          {habit.category && (
            <Badge 
              variant="outline" 
              className="ml-2 shrink-0"
            >
              {habit.category}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Streak Information */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">
              {habit.currentStreak} day streak
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">
              Best: {habit.longestStreak} days
            </span>
          </div>
        </div>

        {/* Completion Stats */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Total completions: {habit.totalCompletions}
          </span>
        </div>

        {/* Complete Button */}
        <Button
          onClick={handleCompleteHabit}
          disabled={isCompleting}
          className="w-full"
          variant="outline"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {isCompleting ? "Completing..." : "Complete Today"}
        </Button>
      </CardContent>
    </Card>
  );
} 