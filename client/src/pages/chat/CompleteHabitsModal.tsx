import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Clock, TrendingUp, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CompleteHabitsModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);

  const { data: todaysHabits = [] } = useQuery({
    queryKey: ["/api/goals/habits/today"],
    queryFn: async () => apiRequest('/api/goals/habits/today'),
    enabled: open,
    staleTime: 5_000,
  });

  const { data: smartSuggestions = [] } = useQuery({
    queryKey: ["/api/smart-suggestions"],
    queryFn: async () => apiRequest('/api/smart-suggestions'),
    enabled: open,
    staleTime: 10_000,
  });

  const prioritizedHabits = useMemo(() => {
    return (todaysHabits as any[]).map((h) => {
      const suggestion = (smartSuggestions as any[]).find((s) => s.habitId === h.id);
      const base = suggestion?.priorityScore ?? 50;
      const streakBoost = (h.currentStreak || 0) * 2; // modest boost per streak day
      const final = base + streakBoost;
      return { ...h, priorityScore: final, suggestion };
    }).sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
  }, [todaysHabits, smartSuggestions]);

  const completeMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await apiRequest(`/api/goals/habits/${id}/complete`, {
          method: 'POST',
          body: JSON.stringify({ completedAt: new Date().toISOString() }),
        });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/goals/habits/today"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/goals/habits/completed-today"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/smart-suggestions"] }),
      ]);
      setSelected([]);
      onClose();
    }
  });

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  if (!open) return null;

  const group = (min: number, max?: number) => prioritizedHabits.filter((h: any) => {
    const p = h.priorityScore ?? 0;
    return max === undefined ? p >= min : p >= min && p < max;
  });

  const Top = group(80);
  const High = group(60, 80);
  const Standard = group(0, 60);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-orange-600" />
            <div className="font-semibold">Complete Today's Habits</div>
          </div>
          <div className="text-xs text-gray-600 mt-1">Select the habits you've completed today</div>
        </div>

        <div className="p-6 space-y-6 overflow-auto">
          {Top.length > 0 && (
            <Section title="Needle Moving" icon={<Zap className="w-4 h-4 text-red-500" />} badgeClass="bg-red-50 text-red-700 border-red-200" items={Top} selected={selected} onToggle={toggle} />
          )}
          {High.length > 0 && (
            <Section title="High Priority" icon={<TrendingUp className="w-4 h-4 text-orange-500" />} badgeClass="bg-orange-50 text-orange-700 border-orange-200" items={High} selected={selected} onToggle={toggle} />
          )}
          {Standard.length > 0 && (
            <Section title="Standard" icon={<Clock className="w-4 h-4 text-gray-500" />} badgeClass="bg-gray-50 text-gray-700 border-gray-200" items={Standard} selected={selected} onToggle={toggle} />
          )}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={selected.length === 0 || completeMutation.isPending} onClick={() => completeMutation.mutate(selected)} className="bg-orange-600 hover:bg-orange-700">
            Complete Selected ({selected.length})
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, badgeClass, items, selected, onToggle }: any) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-800">{title}</span>
        <Badge variant="outline" className={`text-xs ${badgeClass}`}>{items.length} habits</Badge>
      </div>
      <div className="space-y-3">
        {items.map((h: any) => (
          <div key={h.id} className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <Checkbox checked={selected.includes(h.id)} onCheckedChange={() => onToggle(h.id)} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-800 text-sm truncate">{h.title}</div>
                {h.suggestion && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-blue-200 bg-white text-blue-700">
                    {h.suggestion.impact >= 70 ? 'High' : h.suggestion.impact >= 40 ? 'Medium' : 'Low'} impact • {h.suggestion.effortMinutes}m
                  </span>
                )}
              </div>
              {h.description && <div className="text-xs text-gray-600 mt-1 line-clamp-2">{h.description}</div>}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                <span>Streak: {h.currentStreak ?? 0}</span>
                <span>Total: {h.totalCompletions ?? 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


