import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GoalDetailModal } from "@/components/GoalDetailModal";
import { Button } from "@/components/ui/button";
import { HabitsSidePanel } from "@/components/chat/HabitsSidePanel";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Home, Target } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import ConversationsList from "@/components/chat/ConversationsList";

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

export default function MyFocusDashboard() {
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const queryClient = useQueryClient();
  const [showHabitsPanel, setShowHabitsPanel] = useState(false);
  const { user } = useAuth();

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

  const completedTodayCount = useMemo(() => {
    if (!Array.isArray(completedTodayData)) return 0;
    const uniqueIds = new Set<string>();
    completedTodayData.forEach((item: any) => {
      const id = item?.id || item?.habitDefinitionId || item?.habitId;
      if (id) uniqueIds.add(id);
    });
    return uniqueIds.size;
  }, [completedTodayData]);

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

  // For now, always show the top 3 priority goals (fixed focus slots)
  const priorityGoals = (data.priorityGoals || []).slice(0, 3);
  const activeHabits = Array.isArray(data.highLeverageHabits) ? data.highLeverageHabits : [];
	const insights = (data.keyInsights || []).slice(0, 3);
	const optimization = data.pendingOptimization;

  const totalHabits = activeHabits.length;
  const completedHabits = Math.min(completedTodayCount, totalHabits);

  const isEmpty = priorityGoals.length === 0 && totalHabits === 0 && insights.length === 0;

return (
    <>
      {/* Mobile header with hamburger and habit pill */}
      <div className="lg:hidden px-3 sm:px-4 py-3 border-b bg-white z-30 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Sheet>
              <SheetTrigger asChild>
                <button aria-label="Open menu" className="w-9 h-9 rounded-lg border flex items-center justify-center text-gray-700 shrink-0">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <div className="flex flex-col h-full">
                  <div className="px-4 py-4 border-b shrink-0">
                    <img src="/goodhabit.ai(200 x 40 px).png" alt="GoodHabit" className="h-6" />
                  </div>
                  <nav className="px-2 py-2 space-y-1 flex-1 overflow-y-auto min-h-0">
                    <a href="/?new=1" className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50">
                      <Home className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Home</span>
                    </a>
                    <a href="/focus" className="flex items-center gap-3 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700">
                      <Target className="w-4 h-4 text-emerald-700" />
                      <span className="text-sm font-medium">My Focus</span>
                    </a>
                    <div className="mt-4 px-2">
                      <ConversationsList />
                    </div>
                  </nav>
                  <div className="p-3 border-t shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                          <div className="w-10 h-10 rounded-full border-2 border-black bg-white flex items-center justify-center text-sm font-bold shrink-0">
                            {`${((user as any)?.firstName?.[0] || 'U').toUpperCase()}${((user as any)?.lastName?.[0] || '').toUpperCase()}`}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{(user as any)?.firstName || 'User'} {(user as any)?.lastName || ''}</div>
                            <div className="text-xs text-gray-500 truncate">{(user as any)?.email || ''}</div>
                          </div>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuItem onClick={() => window.location.assign('/profile')}>Your account</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { localStorage.setItem('onboardingCompleted', 'false'); localStorage.removeItem('bypassOnboarding'); window.location.assign('/journal'); }}>Return to Onboarding</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('token'); window.location.reload(); }}>Log Out</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">My Focus</h1>
          </div>
          {totalHabits > 0 && (
            <button
              type="button"
              onClick={() => setShowHabitsPanel(true)}
              className="px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium shrink-0 hover:bg-teal-200 transition-colors"
            >
              {completedHabits}/{totalHabits} ✓
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto">
      <header className="space-y-1 hidden lg:block">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">My Focus</h1>
            <p className="text-xs sm:text-sm text-gray-600">Your top priorities and the habits that will help you achieve them</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {totalHabits > 0 && (
              <button
                type="button"
                onClick={() => setShowHabitsPanel(true)}
                className="px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium shrink-0 hover:bg-teal-200 transition-colors"
              >
                {completedHabits}/{totalHabits} ✓
              </button>
            )}
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

      {/* Compact two-column layout: Goals and supportive info */}
      <section className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {/* Priority Goals */}
        <div className="space-y-3 sm:space-y-4 min-w-0">
          <div className="text-sm sm:text-base font-semibold text-gray-800">Priority Goals</div>
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
          <div className="flex items-center justify-between pt-2">
            <button
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs sm:text-sm hover:bg-emerald-700 transition-colors"
              title="Start chat to Optimize My Focus"
              onClick={() => { window.location.href = '/?new=1&optimize=1'; }}
            >
              Optimize focus
            </button>
            <a href="/goals" className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline">All Goals →</a>
          </div>
        </div>

        {/* Key Insights */}
        <div className="space-y-3 sm:space-y-4 min-w-0">
          <div className="text-sm sm:text-base font-semibold text-gray-800">Key Insights</div>
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
          <div className="flex justify-end pt-2">
            <a href="/insights" className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline">All Insights →</a>
          </div>
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

      <HabitsSidePanel
        open={showHabitsPanel}
        onOpenChange={setShowHabitsPanel}
        todaySummary={totalHabits > 0 ? { completed: completedHabits, total: totalHabits } : undefined}
      />
        </div>
      </div>
    </>
	);
}
