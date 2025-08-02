import React from "react";
import { useQuery } from "@tanstack/react-query";
import { habitsService, type Habit } from "@/services/habitsService";
import { HabitCompletionCard } from "./HabitCompletionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Calendar, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

export function HabitsScreen() {
  // Get metric filter from URL
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const metricFilter = urlParams.get('metric');

  const { data: habits, isLoading, error } = useQuery({
    queryKey: ["habits"],
    queryFn: habitsService.getHabits,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Habits</h1>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Habits</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Error loading habits: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!habits || habits.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">
          {metricFilter ? `${metricFilter} Habits` : "Habits"}
        </h1>
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {metricFilter ? `No ${metricFilter} habits yet` : "No habits yet"}
            </h3>
            <p className="text-muted-foreground">
              {metricFilter 
                ? `${metricFilter} habits will appear here when insights suggest them based on your journal entries.`
                : "Habits will appear here when insights suggest them based on your journal entries."
              }
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter habits based on metric filter
  const filteredHabits = habits.filter(habit => {
    if (!metricFilter) return true;
    return habit.category === metricFilter;
  });

  // Group habits by category
  const habitsByCategory = filteredHabits.reduce((acc, habit) => {
    const categoryName = habit.category || "General";
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(habit);
    return acc;
  }, {} as Record<string, Habit[]>);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        {metricFilter ? `${metricFilter} Habits` : "Habits"}
      </h1>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium">Active Habits</span>
            </div>
            <p className="text-2xl font-bold">{filteredHabits.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">Total Completions</span>
            </div>
            <p className="text-2xl font-bold">
              {filteredHabits.reduce((sum, habit) => sum + habit.totalCompletions, 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">Best Streak</span>
            </div>
            <p className="text-2xl font-bold">
              {Math.max(...habits.map(h => h.longestStreak), 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Habits by Category */}
      {Object.entries(habitsByCategory).map(([categoryName, categoryHabits]) => (
        <div key={categoryName} className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Badge variant="outline">
              {categoryName}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {categoryHabits.length} habit{categoryHabits.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="grid gap-4">
            {categoryHabits.map((habit) => (
              <HabitCompletionCard key={habit.id} habit={habit} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 