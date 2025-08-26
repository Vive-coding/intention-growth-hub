import React from "react";
import { useQuery } from "@tanstack/react-query";
import { habitsService, type Habit } from "@/services/habitsService";
import { HabitCompletionCard } from "./HabitCompletionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Flame, Calendar, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Logo } from "@/components/ui/Logo";

export function HabitsScreen() {
  // Get metric filter from URL
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const metricFilter = urlParams.get('metric');

  // Hooks must stay at top-level and never be conditional
  const [statusFilter, setStatusFilter] = React.useState<'active' | 'archived' | 'all'>('active');
  const [lifeMetricFilter, setLifeMetricFilter] = React.useState<string>('All');

  const { data: habits, isLoading, error } = useQuery({
    queryKey: ["habits", statusFilter],
    queryFn: () => habitsService.getHabits(statusFilter),
  });
  const lifeMetricOptions = React.useMemo(() => {
    const set = new Set<string>();
    (habits || []).forEach((h: any) => (h.lifeMetrics || []).forEach((m: any) => set.add(m.name)));
    return ['All', ...Array.from(set).sort()];
  }, [habits]);
  const filteredHabits = React.useMemo(() => {
    const list = (habits || []).filter((h: any) => {
      const statusOk = statusFilter === 'all' ? true : (h.status || 'active') === statusFilter;
      const metricOk = lifeMetricFilter === 'All' ? true : (h.lifeMetrics || []).some((m: any) => m.name === lifeMetricFilter);
      return statusOk && metricOk;
    });
    // Sort by total completions desc
    return list.sort((a: any, b: any) => (b.totalCompletions || 0) - (a.totalCompletions || 0));
  }, [habits, statusFilter, lifeMetricFilter]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Logo size="md" className="text-gray-800" />
          <h1 className="text-2xl font-bold text-gray-800">Habits</h1>
        </div>
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
        <div className="flex items-center space-x-3 mb-6">
          <Logo size="md" className="text-gray-800" />
          <h1 className="text-2xl font-bold text-gray-800">Habits</h1>
        </div>
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
        <div className="flex items-center space-x-3 mb-6">
          <Logo size="md" className="text-gray-800" />
          <h1 className="text-2xl font-bold text-gray-800">
            {metricFilter ? `${metricFilter} Habits` : "Habits"}
          </h1>
        </div>
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

  // End hooks

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Logo size="md" className="text-gray-800" />
        <h1 className="text-2xl font-bold text-gray-800">
          {metricFilter ? `${metricFilter} Habits` : "Habits"}
        </h1>
      </div>
      
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status</span>
          <Select value={statusFilter} onValueChange={(v: any)=> setStatusFilter(v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Life Metric</span>
          <Select value={lifeMetricFilter} onValueChange={(v: any)=> setLifeMetricFilter(v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Life Metric" />
            </SelectTrigger>
            <SelectContent>
              {lifeMetricOptions.map((opt)=> (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">{filteredHabits.length} habit{filteredHabits.length!==1?'s':''}</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredHabits.map((habit: any) => (
          <HabitCompletionCard key={habit.id} habit={habit} />
        ))}
      </div>
    </div>
  );
} 