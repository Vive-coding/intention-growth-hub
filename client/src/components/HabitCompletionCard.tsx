import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Flame, Calendar, Trash } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Edit } from "lucide-react";
import { EditHabitWizardModal } from "./EditHabitWizardModal";

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

interface HabitCompletionCardProps {
  habit: {
    id: string;
    title: string;
    description?: string;
    category?: string;
    lifeMetrics?: Array<{ id: string; name: string; color: string }>;
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
  };
}

export function HabitCompletionCard({ habit }: HabitCompletionCardProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const completeHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      return await apiRequest(`/api/goals/habits/${habitId}/complete`, {
        method: "POST",
        body: JSON.stringify({
          completedAt: new Date().toISOString(),
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Habit completed!',
        description: 'Great job staying consistent.',
      });
      
      // Refetch habits data and smart suggestions
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/life-metrics/progress"] });
      queryClient.invalidateQueries({ queryKey: ["metric-progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-suggestions"] });
      setIsCompleting(false);
    },
    onError: (error) => {
      console.error("Error completing habit:", error);
      
      // Check if it's a duplicate completion error
      if (error.message && error.message.includes('already completed today')) {
        toast({
          title: 'Already completed!',
          description: 'You have already completed this habit today.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to complete habit.',
          variant: 'destructive',
        });
      }
      setIsCompleting(false);
    },
  });

  const handleCompleteHabit = () => {
    if (isCompleting) return; // Prevent double clicks
    setIsCompleting(true);
    completeHabitMutation.mutate(habit.id);
  };

  const handleDeleteHabit = async () => {
    const confirmed = window.confirm('Delete this habit permanently? This will remove all its instances.');
    if (!confirmed) return;
    try {
      await apiRequest(`/api/goals/habits/${habit.id}`, { method: 'DELETE' });
      toast({ title: 'Habit deleted', description: 'The habit has been removed.' });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
    } catch (e) {
      console.error('Failed to delete habit', e);
      toast({ title: 'Failed to delete habit', description: 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <Card className="w-full h-full border border-gray-100 shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base lg:text-lg leading-snug break-words">
            {habit.title}
          </CardTitle>
          <div className="flex flex-wrap gap-1 shrink-0 self-start">
            {habit.lifeMetrics && habit.lifeMetrics.length > 0 ? (
              habit.lifeMetrics.map((metric) => (
                <div
                  key={metric.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: getPillBackgroundColor(metric.name),
                    color: getPillTextColor(metric.name)
                  }}
                >
                  {metric.name}
                </div>
              ))
            ) : habit.category ? (
              <Badge variant="outline" className="shrink-0 self-start">
                {habit.category}
              </Badge>
            ) : null}
          </div>
        </div>
        {habit.description && (
          <p className="text-xs lg:text-sm text-muted-foreground mt-1 break-words">
            {habit.description}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Streak Information */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-xs lg:text-sm font-medium">
              {habit.currentStreak} day streak
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            <span className="text-xs lg:text-sm text-muted-foreground">
              Best: {habit.longestStreak} days
            </span>
          </div>
        </div>

        {/* Completion Stats */}
        <div className="flex items-center justify-between">
          <span className="text-xs lg:text-sm text-muted-foreground">
            Total completions: {habit.totalCompletions}
          </span>
        </div>

        {/* Actions */}
        <Button
          onClick={handleCompleteHabit}
          disabled={isCompleting}
          className="w-full"
          variant="outline"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {isCompleting ? "Completing..." : "Complete Today"}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setIsEditing(true)} variant="secondary">
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button onClick={handleDeleteHabit} variant="ghost">
            <Trash className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>

        <EditHabitWizardModal
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          habit={{ 
            id: habit.id, 
            title: habit.title, 
            description: habit.description,
            category: habit.category 
          }}
          onHabitUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["habits"] });
            queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
          }}
        />
      </CardContent>
    </Card>
  );
} 