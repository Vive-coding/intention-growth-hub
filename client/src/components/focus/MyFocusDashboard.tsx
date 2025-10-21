import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
		<div className="p-6 space-y-8 max-w-6xl mx-auto">
			<header>
				<h1 className="text-2xl font-semibold text-gray-900">My Focus</h1>
				<p className="text-sm text-gray-600">Your top priorities and the habits that drive them</p>
			</header>

			<section className="space-y-3">
				<div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority Goals</div>
				<div className="grid gap-3">
					{priorityGoals.length === 0 && (
						<div className="text-sm text-gray-600">No priorities yet. Start a chat to set your top 3 goals.</div>
					)}
					{priorityGoals.map((g: any) => (
						<div key={g.id} className="rounded-2xl p-4 bg-white border border-gray-200 shadow-sm">
							<div className="flex items-center justify-between gap-3">
								<div className="font-semibold text-gray-900">{g.title}</div>
								{typeof g.rank === 'number' && (
									<div className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700">Priority {g.rank}</div>
								)}
							</div>
							{g.reason && <div className="text-xs text-gray-600 mt-1">{g.reason}</div>}
							<div className="mt-3">
								<div className="flex items-center justify-between text-xs text-gray-600 mb-1">
									<span>Progress</span>
									<span>{Math.round(Math.min(100, Math.max(0, g.progress || 0)))}%</span>
								</div>
								<div className="h-2 bg-gray-100 rounded-full overflow-hidden">
									<div className="h-full bg-teal-600" style={{ width: `${Math.min(100, Math.max(0, g.progress || 0))}%` }} />
								</div>
							</div>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-3">
				<div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Habits</div>
				<div className="grid gap-3 md:grid-cols-2">
					{activeHabits.length === 0 && (
						<div className="text-sm text-gray-600">No habits yet. Choose 2–3 high-leverage habits to track.</div>
					)}
					{activeHabits.map((h: any) => (
						<div key={h.id} className="rounded-xl p-3 bg-white border border-gray-200 shadow-sm">
							<div className="font-medium text-gray-900">{h.title}</div>
							<div className="text-xs text-gray-600">Streak: {h.streak}d</div>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-3">
				<div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Key Insights</div>
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
