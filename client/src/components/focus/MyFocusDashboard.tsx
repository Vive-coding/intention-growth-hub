import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Sparkles } from "lucide-react";

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
		return <div className="p-6 text-sm text-red-600">Failed to load My Focus.</div>;
	}

  const priorityGoals = (data.priorityGoals || []).slice(0, 3);
	const activeHabits = (data.highLeverageHabits || []).slice(0, 6);
	const insights = (data.keyInsights || []).slice(0, 3);
	const optimization = data.pendingOptimization;

	return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">My Focus</h1>
        <p className="text-sm text-gray-600">Your top priorities and the habits that will help you achieve them</p>
      </header>

      <section className="space-y-4">
        <div className="text-base font-semibold text-gray-800">Priority Goals</div>
        <div className="grid gap-4">
					{priorityGoals.length === 0 && (
						<div className="text-sm text-gray-600">No priorities yet. Start a chat to set your top 3 goals.</div>
					)}
					{priorityGoals.map((g: any) => (
            <div key={g.id} className="rounded-2xl p-5 bg-white border border-gray-200 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {typeof g.rank === 'number' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Priority {g.rank}</span>
                    )}
                    {g.lifeMetric?.name && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${getPillBg(g.lifeMetric.name)}`}>{g.lifeMetric.name}</span>
                    )}
                  </div>
                  <div className="font-semibold text-gray-900 truncate">{g.title}</div>
                  {g.reason && (
                    <div className="mt-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-gray-500 mt-0.5" />
                      <span className="leading-relaxed">{g.reason}</span>
                    </div>
                  )}
                </div>
                <div className="shrink-0 w-28 text-right">
                  <div className="text-xs text-gray-600 mb-1">{Math.round(Math.min(100, Math.max(0, g.progress || 0)))}%</div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-900" style={{ width: `${Math.min(100, Math.max(0, g.progress || 0))}%` }} />
                  </div>
                </div>
              </div>
            </div>
					))}
				</div>
			</section>

      <section className="space-y-4">
        <div className="text-base font-semibold text-gray-800">Active Habits</div>
        <div className="grid gap-3 md:grid-cols-2">
					{activeHabits.length === 0 && (
						<div className="text-sm text-gray-600">No habits yet. Choose 2–3 high-leverage habits to track.</div>
					)}
					{activeHabits.map((h: any) => (
            <div key={h.id} className="rounded-xl p-3 bg-white border border-gray-200 shadow-sm flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{h.title}</div>
                <div className="text-xs text-gray-600">Streak: {h.streak}d</div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-gray-300" />
						</div>
					))}
				</div>
			</section>

      <section className="space-y-4">
        <div className="text-base font-semibold text-gray-800">Key Insights</div>
				<div className="grid gap-2">
					{insights.length === 0 && (
						<div className="text-sm text-gray-600">No insights yet. Chat with your coach to generate insights.</div>
					)}
					{insights.map((i: any) => (
						<div key={i.id} className="rounded-xl p-3 bg-white border border-gray-200 shadow-sm">
							<div className="font-medium text-gray-900">{i.title}</div>
							<div className="text-xs text-gray-600 mt-1">{i.explanation}</div>
						</div>
					))}
				</div>
			</section>

			{optimization && (
				<section className="space-y-3">
					<div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Optimization Proposal</div>
					<div className="rounded-xl p-4 bg-white border border-gray-200 shadow-sm">
						{optimization.summary && <div className="text-sm text-gray-700 mb-2">{optimization.summary}</div>}
						<ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
							{optimization.recommendations.map((r: any, idx: number) => (
								<li key={idx}><span className="uppercase text-[11px] text-gray-500">{r.type}:</span> {r.title} — {r.description}</li>
							))}
						</ul>
					</div>
				</section>
			)}
		</div>
	);
}
