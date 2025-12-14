import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, CheckCircle2, Loader2, Flame, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface HabitsSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todaySummary?: { completed: number; total: number };
}

export function HabitsSidePanel({ open, onOpenChange, todaySummary }: HabitsSidePanelProps) {
  const queryClient = useQueryClient();
  const [completingHabitId, setCompletingHabitId] = useState<string | null>(null);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(() => new Set());

  const { data: focusData, isLoading: focusLoading } = useQuery({
    queryKey: ["/api/my-focus"],
    queryFn: async () => apiRequest("/api/my-focus"),
    staleTime: 0, // Always refetch when panel opens to ensure consistency
    enabled: open,
    refetchOnMount: true,
  });

  const { data: completedTodayData } = useQuery({
    queryKey: ["/api/goals/habits/completed-today"],
    queryFn: async () => apiRequest("/api/goals/habits/completed-today"),
    staleTime: 10_000,
    enabled: open,
  });

  // Only clear recently completed when panel opens, not when data changes
  useEffect(() => {
    if (open) {
      setRecentlyCompleted(new Set());
    }
  }, [open]);

  const completedTodaySet = useMemo(() => {
    const ids = new Set<string>();
    const completionTimes = new Map<string, string>();
    if (Array.isArray(completedTodayData)) {
      completedTodayData.forEach((item: any) => {
        const id = item?.id || item?.habitDefinitionId || item?.habitId;
        if (id) {
          ids.add(id);
          // Store completion time if available
          if (item?.completedAt) {
            completionTimes.set(id, item.completedAt);
          }
        }
      });
    }
    recentlyCompleted.forEach((id) => {
      ids.add(id);
      // Set current time for recently completed habits
      if (!completionTimes.has(id)) {
        completionTimes.set(id, new Date().toISOString());
      }
    });
    return { ids, completionTimes };
  }, [completedTodayData, recentlyCompleted]);

  const habits = useMemo(() => {
    const list = Array.isArray(focusData?.highLeverageHabits) ? focusData.highLeverageHabits : [];
    return [...list];
  }, [focusData?.highLeverageHabits]);

  const handleCompleteHabit = async (habit: any) => {
    if (!habit?.id || completingHabitId || completedTodaySet.ids.has(habit.id)) return;
    setCompletingHabitId(habit.id);
    try {
      const body: Record<string, any> = {};
      const firstGoal = Array.isArray(habit.linkedGoals) && habit.linkedGoals[0];
      if (firstGoal?.id) {
        body.goalId = firstGoal.id;
      }

      await apiRequest(`/api/goals/habits/${habit.id}/complete`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setRecentlyCompleted((prev) => {
        const next = new Set(prev);
        next.add(habit.id);
        return next;
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/my-focus"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/habits/today-completions"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/goals/habits/completed-today"] }),
      ]);
    } catch (error: any) {
      console.error("Failed to complete habit", error);
      if (error?.status === 409) {
        alert(error?.message || "Habit already completed for this period.");
      } else {
        alert("We couldn't complete that habit right now. Please try again.");
      }
    } finally {
      setCompletingHabitId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[90vw] sm:w-full sm:max-w-lg lg:max-w-xl p-0 flex flex-col bg-gradient-to-b from-emerald-50/60 via-white to-white"
      >
        <div className="px-4 sm:px-6 py-5 border-b border-emerald-100 bg-white/80 backdrop-blur-sm">
          <SheetHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <SheetTitle className="text-lg font-semibold text-gray-900">Focus Habits</SheetTitle>
                <SheetDescription className="text-sm text-gray-600">
                  Tap a habit to mark it complete for today.
                </SheetDescription>
              </div>
            </div>
            {todaySummary && todaySummary.total > 0 && (
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-medium w-fit">
                <CheckCircle2 className="w-4 h-4" />
                {todaySummary.completed}/{todaySummary.total} completed today
              </div>
            )}
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1 px-4 sm:px-6 py-5">
          {focusLoading ? (
            <div className="py-16 text-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3" />
              Loading habits…
            </div>
          ) : habits.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <p className="text-sm font-medium">No focus habits yet</p>
              <p className="text-xs text-gray-400 mt-2">
                Start a chat to set focus goals and unlock your daily habit flow.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {habits.map((habit: any) => {
                const isCompleted = completedTodaySet.ids.has(habit.id);
                const completionTime = completedTodaySet.completionTimes.get(habit.id);
                const isCompleting = completingHabitId === habit.id;
                const primaryGoalTitle =
                  Array.isArray(habit.linkedGoals) && habit.linkedGoals.length > 0
                    ? habit.linkedGoals[0].title
                    : null;
                const extraGoalCount =
                  Array.isArray(habit.linkedGoals) && habit.linkedGoals.length > 1
                    ? habit.linkedGoals.length - 1
                    : 0;

                return (
                  <div
                    key={habit.id}
                    className={`rounded-2xl border px-3 sm:px-4 py-3 transition-colors ${
                      isCompleted
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-white border-gray-200 hover:border-emerald-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3 w-full">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="text-sm sm:text-base font-semibold break-words">{habit.title}</div>
                        <div className="text-[11px] sm:text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>Streak {Math.max(0, habit.streak || 0)}d</span>
                          {primaryGoalTitle && (
                            <span className="inline-flex items-center gap-1">
                              Focus:&nbsp;
                              <span className="text-gray-700 truncate max-w-[100px] sm:max-w-[150px]">
                                {primaryGoalTitle}
                              </span>
                              {extraGoalCount > 0 && <span className="text-gray-400">+{extraGoalCount}</span>}
                            </span>
                          )}
                        </div>
                        {isCompleted && completionTime && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-700">
                            <Clock className="w-3 h-3" />
                            <span>
                              Completed at {format(new Date(completionTime), "h:mm a")}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCompleteHabit(habit)}
                        disabled={isCompleted || isCompleting}
                        className={`shrink-0 h-9 w-9 rounded-xl inline-flex items-center justify-center transition-colors ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-600 cursor-default"
                            : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
                        }`}
                        aria-label={
                          isCompleted ? "Habit already completed today" : `Mark ${habit.title} as completed`
                        }
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : isCompleting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Check className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

