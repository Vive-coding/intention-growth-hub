import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GoalDetailModal } from "@/components/GoalDetailModal";
import { Button } from "@/components/ui/button";
import { HabitsSidePanel } from "@/components/chat/HabitsSidePanel";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Home, Target, Sparkles } from "lucide-react";
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
  const [showMobileNav, setShowMobileNav] = useState(false);
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

  // Fetch today's habit completions for My Focus habits only
  const { data: todayCompletions } = useQuery({
    queryKey: ["/api/habits/today-completions"],
    queryFn: async () => {
      try {
        const resp = await apiRequest("/api/habits/today-completions");
        return resp || { completed: 0, total: 0 };
      } catch {
        return { completed: 0, total: 0 };
      }
    },
    staleTime: 0,
    refetchInterval: 10_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

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
  const totalGoalCount = data.totalGoalCount || 0;

  const totalHabits = todayCompletions?.total || 0;
  const completedHabits = todayCompletions?.completed || 0;

  const hasNoGoals = totalGoalCount === 0;
  const hasGoalsButNoPriorities = totalGoalCount > 0 && priorityGoals.length === 0;
  const isEmpty = priorityGoals.length === 0 && totalHabits === 0 && insights.length === 0;

return (
    <>
      {/* Mobile header with hamburger and habit pill */}
      <div className="lg:hidden px-3 sm:px-4 py-3 border-b bg-white z-30 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Sheet open={showMobileNav} onOpenChange={setShowMobileNav}>
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
                    <a href="/?new=1" className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50" onClick={() => setShowMobileNav(false)}>
                      <Home className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Home</span>
                    </a>
                    <a href="/focus" className="flex items-center gap-3 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700" onClick={() => setShowMobileNav(false)}>
                      <Target className="w-4 h-4 text-emerald-700" />
                      <span className="text-sm font-medium">My Focus</span>
                    </a>
                    <div className="mt-4 px-2">
                      <ConversationsList onThreadClick={() => setShowMobileNav(false)} />
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

      {/* Empty state for first-time users - no goals at all */}
      {hasNoGoals && (
        <section className="mb-8">
          <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="text-base sm:text-lg font-semibold text-white">Start a conversation with coach to create your first goal and begin your journey.</div>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-base font-semibold hover:from-purple-600 hover:to-blue-600 shadow-md transition-all duration-200 hover:shadow-lg self-center sm:self-auto"
                onClick={() => window.location.href = '/?new=1'}
              >
                Start a chat
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Empty state for users with goals but no priorities */}
      {hasGoalsButNoPriorities && (
        <section className="mb-8">
          <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
                <div className="text-lg sm:text-xl font-semibold text-white">You have {totalGoalCount} goal{totalGoalCount !== 1 ? 's' : ''} created.</div>
                <div className="text-xs sm:text-sm text-white/90">Set and actively track top priority goals as focus with coach.</div>
              </div>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-base font-semibold hover:from-purple-600 hover:to-blue-600 shadow-md transition-all duration-200 hover:shadow-lg self-center sm:self-auto"
                onClick={() => window.location.href = '/?new=1&setfocus=1'}
              >
                <Sparkles className="w-4 h-4" />
                Set your focus
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Compact two-column layout: Goals and supportive info */}
      <section className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {/* Priority Goals */}
        <div className="space-y-3 sm:space-y-4 min-w-0">
          <div className="text-sm sm:text-base font-semibold text-gray-800">Priority Goals</div>
          <div className="grid gap-3 sm:gap-4">
            {hasNoGoals && (
              <div className="space-y-3 opacity-40 pointer-events-none">
                {/* Placeholder goal cards */}
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl p-3 sm:p-5 bg-white border border-gray-200 shadow-sm">
                    <div className="flex items-start gap-2 sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                          <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Priority {i}</span>
                          <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border">Category</span>
                        </div>
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                      </div>
                      <div className="shrink-0 w-16 sm:w-20 text-right">
                        <div className="h-3 bg-gray-200 rounded mb-1"></div>
                        <div className="h-2 bg-gray-100 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!hasNoGoals && priorityGoals.length === 0 && (
              <div className="space-y-3 opacity-40 pointer-events-none">
                {/* Placeholder goal cards - same as hasNoGoals state */}
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl p-3 sm:p-5 bg-white border border-gray-200 shadow-sm">
                    <div className="flex items-start gap-2 sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                          <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Priority {i}</span>
                          <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border">Category</span>
                        </div>
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                      </div>
                      <div className="shrink-0 w-16 sm:w-20 text-right">
                        <div className="h-3 bg-gray-200 rounded mb-1"></div>
                        <div className="h-2 bg-gray-100 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                        <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap flex items-center justify-center text-center">Priority {g.rank}</span>
                      )}
                      {g.lifeMetric?.name && (
                        <span className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full border ${getPillBg(g.lifeMetric.name)} whitespace-nowrap flex items-center justify-center text-center`}>{g.lifeMetric.name}</span>
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
                {g.targetDate && (
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-2">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Target: {new Date(g.targetDate).toLocaleDateString()}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            {!hasNoGoals && (
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-300 text-gray-700 text-xs sm:text-sm hover:bg-gray-50 transition-colors"
                title={priorityGoals.length > 0 ? "Optimize My Focus" : "Set your focus"}
                onClick={() => { window.location.href = '/?new=1&optimize=1'; }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {priorityGoals.length > 0 ? 'Optimize focus' : 'Set your focus'}
              </button>
            )}
            {hasNoGoals && (
              <div className="opacity-40 pointer-events-none">
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-300 text-gray-700 text-xs sm:text-sm"
                  disabled
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Set your focus
                </button>
              </div>
            )}
            <a href="/goals" className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline">All goals and habits →</a>
          </div>
        </div>

        {/* Key Insights */}
        <div className="space-y-3 sm:space-y-4 min-w-0">
          <div className="text-sm sm:text-base font-semibold text-gray-800">Key Insights</div>
          <div className="grid gap-2">
            {hasNoGoals && (
              <div className="space-y-2 opacity-40 pointer-events-none">
                {/* Placeholder insight cards */}
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl p-3 bg-white border border-gray-200 shadow-sm">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-full mb-1"></div>
                    <div className="h-3 bg-gray-100 rounded w-4/5"></div>
                  </div>
                ))}
              </div>
            )}
            {!hasNoGoals && insights.length === 0 && (
              <div className="space-y-2 opacity-40 pointer-events-none">
                {/* Placeholder insight cards - same as hasNoGoals state */}
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl p-3 bg-white border border-gray-200 shadow-sm">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-full mb-1"></div>
                    <div className="h-3 bg-gray-100 rounded w-4/5"></div>
                  </div>
                ))}
              </div>
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
                                        isInFocus={true}
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
