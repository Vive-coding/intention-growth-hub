import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { habitsService, type Habit } from "@/services/habitsService";
import { HabitCompletionCard } from "./HabitCompletionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Calendar, CheckCircle, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/ui/PageHeader";
import { OptimizeHabitsModal } from "./OptimizeHabitsModal";
import { useToast } from "@/hooks/use-toast";
import { EditHabitWizardModal } from "./EditHabitWizardModal";

interface HabitsScreenProps {
  embedded?: boolean;
  showBackLink?: boolean;
}

export function HabitsScreen({ embedded = false, showBackLink = true }: HabitsScreenProps) {
  // Get metric filter and edit habit ID from URL
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const metricFilter = urlParams.get('metric');
  const editHabitId = urlParams.get('edit');

  // Hooks must stay at top-level and never be conditional
  const [statusFilter, setStatusFilter] = React.useState<'active' | 'archived' | 'all'>('active');
  const [lifeMetricFilter, setLifeMetricFilter] = React.useState<string>('All');
  const [showOptimizeModal, setShowOptimizeModal] = React.useState(false);
  const [editingHabit, setEditingHabit] = React.useState<any | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: habits, isLoading, error, refetch } = useQuery({
    queryKey: ["habits", statusFilter],
    queryFn: () => habitsService.getHabits(statusFilter),
  });

  // Auto-open edit modal if edit query param is present
  React.useEffect(() => {
    if (editHabitId && habits && !editingHabit) {
      const habitToEdit = habits.find((h: any) => h.id === editHabitId);
      if (habitToEdit) {
        setEditingHabit({
          id: habitToEdit.id,
          title: habitToEdit.title,
          description: habitToEdit.description,
          category: habitToEdit.category,
        });
        // Remove edit param from URL without page reload
        const newUrl = location.split('?')[0] + (metricFilter ? `?metric=${metricFilter}` : '');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [editHabitId, habits, editingHabit, location, metricFilter]);
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

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    embedded ? (
      <div className="space-y-6">{children}</div>
    ) : (
      <div className="p-4 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-7xl mx-auto space-y-6">{children}</div>
      </div>
    );

  if (isLoading) {
    return (
      <Wrapper>
        {/* Loading skeleton for PageHeader */}
        <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
                <div>
                  <div className="h-6 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
                </div>
              </div>
              <div className="h-10 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>
          </CardHeader>
        </Card>
        
        {/* Loading skeleton for habits */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
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
      </Wrapper>
    );
  }

  if (error) {
    return (
      <Wrapper>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Error loading habits: {error.message}</p>
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  if (!habits || habits.length === 0) {
    return (
      <Wrapper>
        {showBackLink && (
          <div>
            <a href="/focus" className="inline-flex items-center text-sm text-emerald-700 hover:text-emerald-900">← Back to My Focus</a>
          </div>
        )}
        {/* Header */}
        <PageHeader
          title={metricFilter ? `${metricFilter} Habits` : "Habits"}
          description="Track and manage your daily habits"
          icon={<Flame className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />}
          showAddButton={false}
          filters={[
            {
              label: "Status",
              value: statusFilter,
              options: [
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived" },
                { value: "all", label: "All" }
              ],
              onChange: (value) => setStatusFilter(value as 'active' | 'archived' | 'all')
            },
            {
              label: "Life Metric",
              value: lifeMetricFilter,
              options: lifeMetricOptions.map(opt => ({ value: opt, label: opt })),
              onChange: (value) => setLifeMetricFilter(value)
            }
          ]}
        />
        
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
      </Wrapper>
    );
  }

  // End hooks

  return (
    <Wrapper>
      {showBackLink && (
        <div>
          <a href="/focus" className="inline-flex items-center text-sm text-emerald-700 hover:text-emerald-900">← Back to My Focus</a>
        </div>
      )}
      {/* Header */}
      <PageHeader
        title={metricFilter ? `${metricFilter} Habits` : "Habits"}
        description="Track and manage your daily habits"
        icon={<Flame className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />}
        showAddButton={false}
        filters={[
          {
            label: "Status",
            value: statusFilter,
            options: [
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
              { value: "all", label: "All" }
            ],
            onChange: (value) => setStatusFilter(value as 'active' | 'archived' | 'all')
          },
          {
            label: "Life Metric",
            value: lifeMetricFilter,
            options: lifeMetricOptions.map(opt => ({ value: opt, label: opt })),
            onChange: (value) => setLifeMetricFilter(value)
          }
        ]}
      />
      
      {/* Optimize Habits Button */}
      {statusFilter === 'active' && filteredHabits.length >= 5 && (
        <div className="flex justify-end">
          <Button
            onClick={() => setShowOptimizeModal(true)}
            variant="outline"
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Optimize Habits
          </Button>
        </div>
      )}
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 mt-6">
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
              {Math.max(0, ...filteredHabits.map(h => h.longestStreak))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredHabits.map((habit: any) => (
          <HabitCompletionCard key={habit.id} habit={habit} />
        ))}
      </div>

      {/* Optimize Habits Modal */}
      <OptimizeHabitsModal
        open={showOptimizeModal}
        onClose={() => setShowOptimizeModal(false)}
        onSuccess={() => {
          toast({
            title: "Habits Optimized!",
            description: "Your habits have been successfully optimized.",
          });
          refetch(); // Refresh habits list
        }}
      />

      {/* Edit Habit Wizard Modal (for editing habit details) */}
      {editingHabit && (
        <EditHabitWizardModal
          isOpen={!!editingHabit}
          onClose={() => {
            setEditingHabit(null);
          }}
          habit={editingHabit}
          onHabitUpdated={async () => {
            // Invalidate all relevant queries to refresh the UI
            await Promise.all([
              refetch(),
              queryClient.invalidateQueries({ queryKey: ["habits"] }),
              queryClient.invalidateQueries({ queryKey: ["/api/goals"] }),
              queryClient.invalidateQueries({ queryKey: ["/api/goals/habits"] }),
              queryClient.invalidateQueries({ queryKey: ["/api/my-focus"] }),
            ]);
            setEditingHabit(null);
            toast({
              title: "Habit Updated!",
              description: "Your habit has been successfully updated.",
            });
          }}
        />
      )}
    </Wrapper>
  );
} 