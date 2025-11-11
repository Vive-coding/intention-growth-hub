import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Check, Pencil, Loader2 } from "lucide-react";
import { GoalDetailModal } from "@/components/GoalDetailModal";
import { EditHabitWizardModal } from "@/components/EditHabitWizardModal";
import { Button } from "@/components/ui/button";

// Simple color helpers to keep chips consistent with the rest of the app
const getPillBg = (metricName?: string) => {
  if (!metricName) return 'bg-gray-100 text-gray-700';
  if (metricName.includes('Health')) return 'bg-green-50 text-green-700';
  if (metricName.includes('Career')) return 'bg-blue-50 text-blue-700';
  if (metricName.includes('Personal')) return 'bg-purple-50 text-purple-700';
  if (metricName.includes('Relationships')) return 'bg-orange-50 text-orange-700';
  if (metricName.includes('Finance')) return 'bg-red-50 text-red-700';
  if (metricName.includes('Mental')) return 'bg-teal-50 text-teal-700';
  return 'bg-gray-100 text-gray-700';
};

const getStoredFocusLimit = () => {
  if (typeof window === 'undefined') return 3;
  const stored = Number(window.localStorage.getItem('focusGoalLimit') || '3');
  return [3, 4, 5].includes(stored) ? stored : 3;
};

export default function MyFocusDashboard() {
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [selectedHabit, setSelectedHabit] = useState<any | null>(null);
  const queryClient = useQueryClient();
  const [updatingLimit, setUpdatingLimit] = useState(false);
  const [completingHabitId, setCompletingHabitId] = useState<string | null>(null);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(() => new Set());
  const [currentLimit, setCurrentLimit] = useState<number>(getStoredFocusLimit);

        const handleGoalClick = async (goal: any) => {
                try {
                        const goalResponse = await apiRequest(`/api/goals/${goal.id}`, { credentials: 'include' });
                        setSelectedGoal(goalResponse);
                } catch (error) {
                        console.error('Error fetching goal details:', error);
                        // Fallback to the goal data we have
                        setSelectedGoal(goal);
                }
        };
	
	const { data, isLoading, isError } = useQuery({
		queryKey: ["/api/my-focus"],
		queryFn: async () => apiRequest("/api/my-focus"),
		staleTime: 60_000,
		refetchOnWindowFocus: false,
	});

  const { data: completedTodayData } = useQuery({
    queryKey: ["/api/goals/habits/completed-today"],
    queryFn: async () => apiRequest("/api/goals/habits/completed-today"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const completedTodaySet = useMemo(() => {
    if (!Array.isArray(completedTodayData)) return new Set<string>();
    return new Set(
      completedTodayData
        .map((item: any) => item?.id || item?.habitDefinitionId || item?.habitId)
        .filter(Boolean)
    );
  }, [completedTodayData]);

  useEffect(() => {
    // Reset optimistic completions once the server data catches up
    setRecentlyCompleted(new Set());
  }, [completedTodayData]);

  const effectiveCompletedSet = useMemo(() => {
    const union = new Set<string>(completedTodaySet);
    recentlyCompleted.forEach((id) => union.add(id));
    return union;
  }, [completedTodaySet, recentlyCompleted]);

  const serverLimit = data?.config?.maxGoals;

  useEffect(() => {
    if (typeof serverLimit === 'number') {
      const normalized = Math.min(Math.max(serverLimit, 3), 5);
      if (normalized !== currentLimit) {
        setCurrentLimit(normalized);
      }
    }
  }, [serverLimit, currentLimit]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('focusGoalLimit', String(currentLimit));
    }
  }, [currentLimit]);

  if (isLoading) {
		return (
			<div className="p-6 space-y-6">
				<div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
				<div className="grid gap-6 md:grid-cols-2">
					<div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
					<div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
				</div>
			</div>
		);
	}

  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto rounded-2xl p-6 bg-white border border-gray-200 shadow-sm">
          <div className="text-base font-semibold text-gray-900 mb-1">My Focus</div>
          <div className="text-sm text-gray-600 mb-4">We couldn’t load your focus yet.</div>
          <div className="text-sm text-gray-700">Please refresh the page or try again later.</div>
        </div>
      </div>
    );
  }

  const handleLimitChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value);
    if (!([3, 4, 5] as number[]).includes(value) || updatingLimit) {
      return;
    }
    setUpdatingLimit(true);
    try {
      await apiRequest("/api/my-focus/config", {
        method: "POST",
        body: JSON.stringify({ maxGoals: value }),
      });
      setCurrentLimit(value);
      await queryClient.invalidateQueries({ queryKey: ["/api/my-focus"] });
    } catch (error) {
      console.error("Failed to update focus goal limit", error);
    } finally {
      setUpdatingLimit(false);
    }
  };

  const handleCompleteHabit = async (habit: any) => {
    if (!habit?.id || completingHabitId) return;
    if (effectiveCompletedSet.has(habit.id)) {
      return;
    }
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

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/my-focus"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/habits/today-completions"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/goals/habits/completed-today"] }),
      ]);
      setRecentlyCompleted((prev) => {
        const next = new Set(prev);
        next.add(habit.id);
        return next;
      });
      await queryClient.refetchQueries({ queryKey: ["/api/my-focus"], type: "active" });
      await queryClient.refetchQueries({ queryKey: ["/api/goals/habits/completed-today"], type: "active" });
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

  const priorityGoals = (data.priorityGoals || []).slice(0, currentLimit);
  const goalPriorityMap = new Map<string, number>();
  priorityGoals.forEach((goal, idx) => {
    const rank = typeof goal.rank === 'number' ? goal.rank : idx + 1;
    if (goal.id) goalPriorityMap.set(goal.id, rank);
  });
  const activeHabits = [...(data.highLeverageHabits || [])].sort((a: any, b: any) => {
    const ranksA = (a.linkedGoals || []).map((goal: any) => goalPriorityMap.get(goal.id) ?? Number.MAX_SAFE_INTEGER);
    const ranksB = (b.linkedGoals || []).map((goal: any) => goalPriorityMap.get(goal.id) ?? Number.MAX_SAFE_INTEGER);
    const minA = ranksA.length > 0 ? Math.min(...ranksA) : Number.MAX_SAFE_INTEGER;
    const minB = ranksB.length > 0 ? Math.min(...ranksB) : Number.MAX_SAFE_INTEGER;
    if (minA !== minB) return minA - minB;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
	const insights = (data.keyInsights || []).slice(0, 3);
	const optimization = data.pendingOptimization;

  const isEmpty = priorityGoals.length === 0 && activeHabits.length === 0 && insights.length === 0;

return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 p-3 sm:p-6 lg:p-8">
      <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto">
      <header className="space-y-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">My Focus</h1>
            <p className="text-xs sm:text-sm text-gray-600">Your top priorities and the habits that will help you achieve them</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="focus-goal-limit" className="text-xs text-gray-600">
                Focus goals
              </label>
              <select
                id="focus-goal-limit"
                value={currentLimit}
                onChange={handleLimitChange}
                disabled={updatingLimit}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                {[3, 4, 5].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs sm:text-sm hover:bg-emerald-700 whitespace-nowrap"
              title="Start chat to Optimize My Focus"
              onClick={() => { window.location.href = '/?new=1&optimize=1'; }}
            >
              Optimize focus
            </button>
          </div>
        </div>
      </header>

      {/* Empty state for first-time users */}
      {isEmpty && (
        <section className="mb-8">
          <div className="rounded-2xl p-6 bg-white border border-gray-200 shadow-sm">
            <div className="text-base font-semibold text-gray-900 mb-1">Set up your Focus</div>
            <div className="text-sm text-gray-600 mb-4">Optimize and prioritize to populate your priority goals, active habits, and key insights.</div>
            <button
              className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => (window as any).composeAndSend?.('Help me optimize and prioritize my focus.', 'prioritize_optimize')}
            >
              Optimize focus
            </button>
          </div>
        </section>
      )}

      {/* Compact two-column layout: Goals and Habits side by side */}
      <section className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {/* Priority Goals */}
        <div className="space-y-3 sm:space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-sm sm:text-base font-semibold text-gray-800">Priority Goals</div>
            <a href="/goals" className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline">All Goals →</a>
          </div>
          <div className="grid gap-3 sm:gap-4">
            {priorityGoals.length === 0 && (
              <div className="text-xs sm:text-sm text-gray-600">No priorities yet. Start a chat to set your top focus goals.</div>
            )}
            {priorityGoals.map((g: any) => (
              <button
                key={g.id}
                onClick={() => handleGoalClick(g)}
                className="rounded-2xl p-3 sm:p-5 bg-white border border-gray-200 shadow-sm min-w-0 hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer text-left w-full"
              >
                <div className="flex items-start gap-2 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
                      {typeof g.rank === 'number' && (
                        <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">Priority {g.rank}</span>
                      )}
                      {g.lifeMetric?.name && (
                        <span className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full border ${getPillBg(g.lifeMetric.name)} whitespace-nowrap`}>{g.lifeMetric.name}</span>
                      )}
                    </div>
                    <div className="font-semibold text-sm sm:text-base text-gray-900 break-words">{g.title}</div>
                  </div>
                  <div className="shrink-0 w-16 sm:w-20 text-right">
                    <div className="text-xs text-gray-600 mb-1">{Math.round(Math.min(100, Math.max(0, g.progress || 0)))}%</div>
                    <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, Math.max(0, g.progress || 0))}%` }} />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Active Habits */}
        <div className="space-y-3 sm:space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-sm sm:text-base font-semibold text-gray-800">Active Habits</div>
            <a href="/habits" className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline">All Habits →</a>
          </div>
          <div className="grid gap-2 sm:gap-3">
            {activeHabits.length === 0 && (
              <div className="text-xs sm:text-sm text-gray-600">No habits yet. Choose 2–3 high-leverage habits to track.</div>
            )}
            {activeHabits.map((h: any) => {
              const isCompletedToday = effectiveCompletedSet.has(h.id);
              const isCompleting = completingHabitId === h.id;
              const primaryGoalTitle =
                Array.isArray(h.linkedGoals) && h.linkedGoals.length > 0 ? h.linkedGoals[0].title : null;
              const extraGoalCount =
                Array.isArray(h.linkedGoals) && h.linkedGoals.length > 1 ? h.linkedGoals.length - 1 : 0;

              return (
                <div
                  key={h.id}
                  className={`rounded-xl border transition-all p-3 sm:p-4 flex items-center justify-between gap-3 ${
                    isCompletedToday
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-white border-gray-200 hover:border-emerald-300 hover:shadow-md"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm sm:text-base truncate">{h.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-gray-500">
                      <span>Streak {Math.max(0, h.streak || 0)}d</span>
                      {primaryGoalTitle && (
                        <span className="inline-flex items-center gap-1">
                          Focus goal:&nbsp;
                          <span className="text-gray-700 truncate max-w-[140px] sm:max-w-[220px]">
                            {primaryGoalTitle}
                          </span>
                          {extraGoalCount > 0 ? <span className="text-gray-400">+{extraGoalCount}</span> : null}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCompleteHabit(h)}
                      disabled={isCompletedToday || isCompleting}
                      aria-label={
                        isCompletedToday ? "Habit already completed today" : `Mark ${h.title} as completed`
                      }
                      className={`h-9 w-9 inline-flex items-center justify-center rounded-lg transition-colors ${
                        isCompletedToday
                          ? "bg-emerald-100 text-emerald-600 cursor-default"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {isCompletedToday ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isCompleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedHabit(h)}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
                      aria-label={`Edit ${h.title}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm sm:text-base font-semibold text-gray-800">Key Insights</div>
          <a href="/insights" className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline">All Insights →</a>
        </div>
				<div className="grid gap-2">
					{insights.length === 0 && (
						<div className="text-xs sm:text-sm text-gray-600">No insights yet. Chat with your coach to generate insights.</div>
					)}
					{insights.map((i: any) => (
						<div key={i.id} className="rounded-xl p-3 bg-white border border-gray-200 shadow-sm min-w-0">
							<div className="font-medium text-sm sm:text-base text-gray-900 break-words">{i.title}</div>
							<div className="text-xs text-gray-600 mt-1 break-words">{i.explanation}</div>
						</div>
					))}
				</div>
      </section>

      {optimization && (
				<section className="space-y-2 sm:space-y-3">
					<div className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">Optimization Proposal</div>
					<div className="rounded-xl p-3 sm:p-4 bg-white border border-gray-200 shadow-sm min-w-0">
						{optimization.summary && <div className="text-xs sm:text-sm text-gray-700 mb-2 break-words">{optimization.summary}</div>}
						<ul className="list-disc list-inside text-xs sm:text-sm text-gray-700 space-y-1">
							{optimization.recommendations.map((r: any, idx: number) => (
								<li key={idx} className="break-words"><span className="uppercase text-[10px] sm:text-[11px] text-gray-500">{r.type}:</span> {r.title} — {r.description}</li>
							))}
						</ul>
					</div>
				</section>
			)}
			
			                        {/* Modal for Goal Details */}
                        {selectedGoal && (
                                <GoalDetailModal
                                        isOpen={!!selectedGoal}
                                        goal={selectedGoal}
                                        onClose={() => setSelectedGoal(null)}
                                        onUpdateProgress={async (goalId: string, progress: number) => {                                                         
                                                // Refresh My Focus data after progress update                                                                  
                                                window.location.reload();
                                        }}
                                        onCompleteHabit={async (habitId: string) => {                                                                           
                                                // Refresh My Focus data after habit completion                                                                 
                                                window.location.reload();
                                        }}
                                        onRemoveHabit={async (goalId: string, habitId: string) => {                                                             
                                                // Refresh My Focus data after habit removal                                                                    
                                                window.location.reload();
                                        }}
                                        onAddHabit={async (goalId: string, habit: any) => {                                                                     
                                                // Refresh My Focus data after habit addition                                                                   
                                                window.location.reload();
                                        }}
                                />
                        )}

                        {/* Modal for Habit Editing */}
                        {selectedHabit && (
                                <EditHabitWizardModal
                                        isOpen={!!selectedHabit}
                                        onClose={() => setSelectedHabit(null)}
                                        habit={{
                                                id: selectedHabit.id,
                                                title: selectedHabit.title,
                                                description: selectedHabit.description,
                                                category: selectedHabit.category
                                        }}
                                        onHabitUpdated={() => {
                                                queryClient.invalidateQueries({ queryKey: ["/api/my-focus"] });
                                                queryClient.invalidateQueries({ queryKey: ["habits"] });
                                                queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
                                                setSelectedHabit(null);
                                        }}
                                />
                        )}
    </div>
    </div>
	);
}
