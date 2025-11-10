import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Sparkles } from "lucide-react";
import { GoalDetailModal } from "@/components/GoalDetailModal";
import { EditHabitWizardModal } from "@/components/EditHabitWizardModal";

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
        const [selectedHabit, setSelectedHabit] = useState<any | null>(null);
        const queryClient = useQueryClient();

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

  const priorityGoals = (data.priorityGoals || []).slice(0, 3);
	const activeHabits = (data.highLeverageHabits || []).slice(0, 6);
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
              <div className="text-xs sm:text-sm text-gray-600">No priorities yet. Start a chat to set your top 3 goals.</div>
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
                        {activeHabits.map((h: any) => (
              <button
                key={h.id}
                onClick={() => setSelectedHabit(h)}
                className="rounded-xl p-3 bg-white border border-gray-200 shadow-sm flex items-center justify-between gap-2 min-w-0 hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer text-left w-full"                    
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm sm:text-base text-gray-900 truncate">{h.title}</div>                                                      
                  <div className="text-xs text-gray-600">Streak: {h.streak}d</div>                                                                              
                </div>
                <CheckCircle2 className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
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
