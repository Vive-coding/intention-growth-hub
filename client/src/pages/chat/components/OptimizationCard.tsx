import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

interface Props {
	proposal: any; // { type: 'optimization', prioritization, optimizedHabits }
	threadId?: string;
	onApplied?: () => void;
	onDiscard?: () => void;
}

export default function OptimizationCard({ proposal, threadId, onApplied, onDiscard }: Props) {
	const [confirming, setConfirming] = useState(false);
	const [applying, setApplying] = useState(false);
	const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<"applied" | "discarded" | null>(null);
	const queryClient = useQueryClient();
  const [goalTitles, setGoalTitles] = useState<Record<string, string>>({});

  // Collect unique goal ids referenced in the proposal
  const goalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of proposal?.prioritization || []) ids.add(p.goalInstanceId);
    for (const h of proposal?.optimizedHabits || []) ids.add(h.goalInstanceId);
    return Array.from(ids);
  }, [proposal]);

  // Resolve goal titles for rendering
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(goalIds.map(async (id) => {
          try {
            const res = await apiRequest(`/api/goals/${id}`);
            const title = res?.goalDefinition?.title || res?.goal?.title || res?.title || 'Goal';
            return [id, title] as const;
          } catch {
            return [id, 'Goal'] as const;
          }
        }));
        if (!cancelled) {
          const map: Record<string, string> = {};
          for (const [id, t] of entries) map[id] = t;
          setGoalTitles(map);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [goalIds.join('|')]);

	const handleApply = async () => {
		if (!proposal) return;
		setApplying(true);
		setError(null);
		try {
			await apiRequest('/api/my-focus/optimization/apply', {
				method: 'POST',
				body: JSON.stringify({ proposal, sourceThreadId: threadId })
			});
			// Refresh My Focus and chat messages for this thread
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["/api/my-focus"] }),
				threadId ? queryClient.invalidateQueries({ queryKey: ["/api/chat/threads", threadId, "messages"] }) : Promise.resolve()
			]);
      setApplied("applied");
			onApplied?.();
		} catch (e: any) {
			setError(e?.message || 'Failed to apply optimization');
		} finally {
			setApplying(false);
			setConfirming(false);
		}
	};

  const handleDiscard = () => {
    setApplied("discarded");
    onDiscard?.();
  };

	return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-5 shadow-sm">
      <div className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Focus Optimization</div>

      {Array.isArray(proposal?.prioritization) && proposal.prioritization.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Priority Goals</div>
          <ol className="space-y-2">
            {proposal.prioritization.map((p: any, idx: number) => (
              <li key={`${p.goalInstanceId}-${idx}`} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{goalTitles[p.goalInstanceId] || 'Goal'}</div>
                    {p.reason && <div className="text-xs text-gray-600 mt-1">{p.reason}</div>}
                  </div>
                  <div className="text-xs text-gray-500">#{p.rank || (idx + 1)}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {Array.isArray(proposal?.optimizedHabits) && proposal.optimizedHabits.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Optimized Habits</div>
          <div className="space-y-2">
            {proposal.optimizedHabits.map((h: any, idx: number) => (
              <div key={`${h.goalInstanceId}-${h.habitDefinitionId}-${idx}`} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-500 mb-1">{goalTitles[h.goalInstanceId] || 'Goal'}</div>
                <div className="font-medium text-gray-900">{h?.newHabit?.title || 'New habit'}</div>
                {h?.newHabit?.description && <div className="text-sm text-gray-700">{h.newHabit.description}</div>}
                {h?.rationale && <div className="text-xs text-gray-500 mt-1">{h.rationale}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        {applied === "applied" ? (
          <span className="text-sm text-emerald-700">Applied</span>
        ) : applied === "discarded" ? (
          <span className="text-sm text-gray-600">Discarded</span>
        ) : !confirming ? (
          <>
            <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirming(true)}>Apply</Button>
            <Button variant="outline" className="rounded-xl" onClick={handleDiscard}>Discard</Button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">Confirm apply? This cannot be undone.</span>
            <Button disabled={applying} className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={handleApply}>{applying ? 'Applying…' : 'Confirm Apply'}</Button>
            <Button disabled={applying} variant="outline" className="rounded-xl" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        )}
      </div>
			{error && <div className="mt-3 text-xs text-red-600">{error}</div>}
		</div>
	);
}


