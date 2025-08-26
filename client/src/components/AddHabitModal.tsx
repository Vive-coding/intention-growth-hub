import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
// Targets step will be rendered inline in this dialog
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button as UIButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AddHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalId?: string;
  onHabitAdded?: () => void;
  onHabitAssociatedWithGoal?: (goalId: string) => void;
  onHabitAddedWithSelections?: (data: { habitId: string; associatedGoalIds: string[]; suggestedGoalIds: string[] }) => void;
  prefillData?: {
    title?: string;
    description?: string;
    lifeMetricId?: string;
    lifeMetricName?: string;
    suggestedHabitId?: string;
    recommendedGoalId?: string;
    recommendedGoalIds?: string[];
    recommendedSuggestedGoalIds?: string[];
  };
}

interface LifeMetric {
  id: string;
  name: string;
  color: string;
}

export const AddHabitModal = ({ isOpen, onClose, goalId, onHabitAdded, onHabitAssociatedWithGoal, onHabitAddedWithSelections, prefillData }: AddHabitModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Frequency and count are set in the next step; omit from the initial form
  const [lifeMetricId, setLifeMetricId] = useState("");
  const [lifeMetrics, setLifeMetrics] = useState<LifeMetric[]>([]);
  const [availableGoals, setAvailableGoals] = useState<any[]>([]);
  const [availableSuggestedGoals, setAvailableSuggestedGoals] = useState<any[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]); // active goals
  const [selectedSuggestedGoalIds, setSelectedSuggestedGoalIds] = useState<string[]>([]); // suggested goals
  const [recommendedActiveIds, setRecommendedActiveIds] = useState<string[]>([]);
  const [recommendedSuggestedIds, setRecommendedSuggestedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showGoalsOpen, setShowGoalsOpen] = useState(false);
  const [createdHabitDefinitionId, setCreatedHabitDefinitionId] = useState<string | null>(null);
  // Inline step navigation and targets state
  const [step, setStep] = useState<"form" | "targets">("form");
  type Frequency = "daily" | "weekly" | "monthly";
  const [rows, setRows] = useState<Array<{ goalId: string; goalTitle: string; goalTargetDate?: string; frequency: Frequency; perPeriodTarget: number; periodsCount: number | "" }>>([]);
  const [savingTargets, setSavingTargets] = useState(false);

  function computePeriodsCount(frequency: Frequency, targetDate?: string): number | "" {
    if (!targetDate) return "";
    const now = new Date();
    const end = new Date(targetDate);
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msPerDay));
    if (diffDays <= 0) return 1;
    if (frequency === "daily") return Math.max(1, diffDays);
    if (frequency === "weekly") return Math.max(1, Math.ceil(diffDays / 7));
    return Math.max(1, Math.ceil(diffDays / 30)); // monthly (approx)
  }

  useEffect(() => {
    if (isOpen) {
      console.log('🟣 AddHabitModal open', { goalId, prefillData });
      fetchLifeMetrics();
      // Force re-initialization each open so recommendations are recomputed
      setInitialized(false);
      setRecommendedActiveIds([]);
      setRecommendedSuggestedIds([]);
      setShowGoalsOpen(false);
      if (goalId) setSelectedGoalIds([goalId]);
      else setSelectedGoalIds([]);
      if (prefillData?.lifeMetricId) setLifeMetricId(prefillData.lifeMetricId);
      setStep("form");
    } else {
      // reset init flag when closed so it re-inits next open
      setInitialized(false);
      setSelectedGoalIds([]);
      setSelectedSuggestedGoalIds([]);
      setRecommendedActiveIds([]);
      setRecommendedSuggestedIds([]);
      setRows([]);
    }
  }, [isOpen, goalId, prefillData?.recommendedGoalId, prefillData?.lifeMetricId]);

  // Prefill form data when modal opens
  useEffect(() => {
    if (isOpen && prefillData) {
      if (prefillData.title) {
        setTitle(prefillData.title);
      }
      if (prefillData.description) {
        setDescription(prefillData.description);
      }
      if (prefillData.lifeMetricId) {
        setLifeMetricId(prefillData.lifeMetricId);
      }
    }
  }, [isOpen, prefillData]);

  // When a goal is chosen, align life metric with that goal (never overwrite explicit prefill)
  useEffect(() => {
    if (!selectedGoalIds || selectedGoalIds.length === 0) return;
    const firstId = selectedGoalIds[0];
    const goal = availableGoals.find((g: any) => (g.goalInstance?.id || g.id) === firstId || g.id === firstId);
    const lmId = goal?.lifeMetricId || goal?.lifeMetric?.id;
    if (lmId && !prefillData?.lifeMetricId) setLifeMetricId(lmId);
  }, [selectedGoalIds, availableGoals]);

  const fetchLifeMetrics = async () => {
    try {
      console.time('🟣 fetchLifeMetrics');
      const response = await apiRequest('/api/life-metrics');
      setLifeMetrics(response);
      console.log('🟣 lifeMetrics loaded', response.map((m: any) => ({ id: m.id, name: m.name })));
      console.timeEnd('🟣 fetchLifeMetrics');
    } catch (error) {
      console.error('Error fetching life metrics:', error);
    }
  };

  // Fallback: once life metrics load, try to resolve prefilled lifeMetricId that might be a name
  useEffect(() => {
    if (!isOpen) return;
    if (lifeMetricId) return;
    if (!prefillData?.lifeMetricId && !prefillData?.lifeMetricName) return;
    if (!Array.isArray(lifeMetrics) || lifeMetrics.length === 0) return;

    const byId = prefillData?.lifeMetricId ? lifeMetrics.find((m: any) => m.id === prefillData.lifeMetricId) : undefined;
    if (byId) {
      console.log('🟣 resolved metric by id', byId);
      setLifeMetricId(byId.id);
      return;
    }
    const nameCandidate = prefillData?.lifeMetricName || prefillData?.lifeMetricId;
    const byName = nameCandidate ? lifeMetrics.find((m: any) => m.name?.toLowerCase() === String(nameCandidate).toLowerCase()) : undefined;
    if (byName) {
      console.log('🟣 resolved metric by name', byName);
      setLifeMetricId(byName.id);
    }
  }, [isOpen, lifeMetrics, prefillData?.lifeMetricId, lifeMetricId]);

  // Ordered initialization after life metrics are available
  useEffect(() => {
    (async () => {
      if (!isOpen || initialized) return;
      if (!Array.isArray(lifeMetrics) || lifeMetrics.length === 0) return;

      console.time('🟣 AddHabitModal init');
      // Resolve metric id once (support both id and name from prefill)
      let resolvedMetricId = lifeMetricId;
      const incomingId = prefillData?.lifeMetricId;
      const incomingName = prefillData?.lifeMetricName;
      if (!resolvedMetricId && (incomingId || incomingName)) {
        const byId = incomingId ? lifeMetrics.find((m: any) => m.id === incomingId) : undefined;
        const byName = !byId && (incomingName || incomingId)
          ? lifeMetrics.find((m: any) => m.name?.toLowerCase() === String(incomingName || incomingId).toLowerCase())
          : undefined;
        if (byId) resolvedMetricId = byId.id;
        else if (byName) resolvedMetricId = byName.id;
      }
      console.log('🟣 init resolve', { incoming: incomingId || incomingName, lifeMetricIdState: lifeMetricId, resolvedMetricId, hasOption: lifeMetrics.some((m: any) => m.id === resolvedMetricId) });
      if (resolvedMetricId && resolvedMetricId !== lifeMetricId) setLifeMetricId(resolvedMetricId);

      // Fetch goals and select recommendation if needed
      try {
        console.time('🟣 loadGoals');
        const goalsResponse = await apiRequest('/api/goals');
        console.log('🟣 goals loaded', goalsResponse.length);
        const lm = resolvedMetricId || incomingId || incomingName;
        const sorted = [...goalsResponse].sort((a: any, b: any) => {
          const aMatch = lm && (a.lifeMetricId === lm || a.lifeMetric?.id === lm || (a.lifeMetric?.name && a.lifeMetric?.name.toLowerCase() === String(lm).toLowerCase())) ? 1 : 0;
          const bMatch = lm && (b.lifeMetricId === lm || b.lifeMetric?.id === lm || (b.lifeMetric?.name && b.lifeMetric?.name.toLowerCase() === String(lm).toLowerCase())) ? 1 : 0;
          if (aMatch !== bMatch) return bMatch - aMatch;
          const aActive = a.status === 'active' ? 1 : 0;
          const bActive = b.status === 'active' ? 1 : 0;
          if (aActive !== bActive) return bActive - aActive;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setAvailableGoals(sorted);

        // Load suggested goals as well
        try {
          console.time('🟣 loadSuggestedGoals');
          const suggested = await apiRequest('/api/goals/suggested');
          const list = Array.isArray(suggested) ? suggested : [];
          setAvailableSuggestedGoals(list);
          console.log('🟣 suggested goals loaded', list.length);
          // Recommended suggested goals should come from agent (prefill)
          const agentRecommendedSuggested = Array.isArray(prefillData?.recommendedSuggestedGoalIds)
            ? prefillData!.recommendedSuggestedGoalIds!
            : [];
          setRecommendedSuggestedIds(agentRecommendedSuggested);
          setSelectedSuggestedGoalIds(agentRecommendedSuggested);
          console.timeEnd('🟣 loadSuggestedGoals');
        } catch (e) {
          console.warn('No suggested goals endpoint or failed to load (non-blocking)');
        }

        // Recommended active goal ids (agent provided preferred). Normalize any form of id to instance id
        const agentRecommendedRaw = Array.isArray((prefillData as any)?.recommendedActiveGoalIds) && (prefillData as any).recommendedActiveGoalIds.length > 0
          ? (prefillData as any).recommendedActiveGoalIds as string[]
          : (Array.isArray(prefillData?.recommendedGoalIds) && prefillData!.recommendedGoalIds!.length > 0
              ? prefillData!.recommendedGoalIds!
              : (prefillData?.recommendedGoalId ? [prefillData.recommendedGoalId] : []));

        const toInstanceId = new Map<string, string>();
        sorted.forEach((g:any) => {
          const instanceId = String(g.goalInstance?.id || g.id);
          toInstanceId.set(instanceId, instanceId);
          if (g.id) toInstanceId.set(String(g.id), instanceId);
          if (g.goalDefinition?.id) toInstanceId.set(String(g.goalDefinition.id), instanceId);
        });

        let recActive = (agentRecommendedRaw as string[])
          .map((id: string) => toInstanceId.get(String(id)))
          .filter((id): id is string => Boolean(id));

        if (recActive.length === 0 && lm) {
          recActive = sorted
            .filter((g: any) => (g.lifeMetricId === lm || g.lifeMetric?.id === lm || (g.lifeMetric?.name && g.lifeMetric?.name.toLowerCase() === String(lm).toLowerCase())))
            .map((g:any)=> String(g.goalInstance?.id || g.id));
        }
        const normalizedActive = Array.from(new Set(recActive)) as string[];
        setRecommendedActiveIds(normalizedActive);
        setSelectedGoalIds(normalizedActive);
        console.log('🟣 normalized active recommendations', { lm, count: normalizedActive.length, sample: normalizedActive.slice(0,3) });
        console.timeEnd('🟣 loadGoals');
      } catch (error) {
        console.error('Error initializing goals for AddHabitModal:', error);
      }

      console.log('🟣 init complete (pre-state flush)', { finalLifeMetricId: lifeMetricId, finalSelectedGoalIds: selectedGoalIds });
      setInitialized(true);
      // Log a tick later to capture flushed state
      setTimeout(() => {
        console.log('🟣 init state after flush', {
          lifeMetricId,
          selectedGoalIds,
          selectedSuggestedGoalIds,
          recommendedActiveIds,
          recommendedSuggestedIds,
          availableGoalsCount: availableGoals.length,
          availableSuggestedGoalsCount: availableSuggestedGoals.length,
          initialized: true,
        });
        console.timeEnd('🟣 AddHabitModal init');
      }, 0);
    })();
  }, [isOpen, lifeMetrics, initialized]);

  // Expose a quick probe for manual debugging in DevTools
  useEffect(() => {
    if (!isOpen) return;
    (window as any).__AHM__ = () => ({
      isOpen,
      initialized,
      lifeMetricId,
      lifeMetrics,
      availableGoals,
      availableSuggestedGoals,
      selectedGoalIds,
      selectedSuggestedGoalIds,
      recommendedActiveIds,
      recommendedSuggestedIds,
      goalId,
      prefillData,
    });
  }, [isOpen, initialized, lifeMetricId, lifeMetrics, availableGoals, availableSuggestedGoals, selectedGoalIds, selectedSuggestedGoalIds, recommendedActiveIds, recommendedSuggestedIds, goalId, prefillData]);

  const fetchAvailableGoals = async () => {
    try {
      const response = await apiRequest('/api/goals');
      const lm = prefillData?.lifeMetricId;
      // Sort: matching life metric first, then active, then createdAt desc
      const sorted = [...response].sort((a: any, b: any) => {
        const aMatch = lm && (a.lifeMetricId === lm || a.lifeMetric?.id === lm) ? 1 : 0;
        const bMatch = lm && (b.lifeMetricId === lm || b.lifeMetric?.id === lm) ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        const aActive = a.status === 'active' ? 1 : 0;
        const bActive = b.status === 'active' ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setAvailableGoals(sorted);
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create the habit only once; if already created, skip
      if (!createdHabitDefinitionId) {
        const habitData = {
          title,
          description,
          category: lifeMetrics.find(m => m.id === lifeMetricId)?.name || null,
        };
        const habitResponse = await apiRequest('/api/goals/habits', {
          method: 'POST',
          body: JSON.stringify(habitData),
        });
        console.log('Created habit:', habitResponse);
        setCreatedHabitDefinitionId(habitResponse.id);
      }
      // Initialize targets rows and proceed to inline targets step
      const goalRows = [
        ...(goalId
          ? [{ 
              goalId, 
              goalTitle: availableGoals.find((g:any)=> (g.goalInstance?.id||g.id)===goalId)?.goalDefinition?.title || 'Selected goal',
              goalTargetDate: availableGoals.find((g:any)=> (g.goalInstance?.id||g.id)===goalId)?.goalInstance?.targetDate || availableGoals.find((g:any)=> (g.goalInstance?.id||g.id)===goalId)?.targetDate
            }]
          : selectedGoalIds.map((gid) => ({ 
              goalId: gid, 
              goalTitle: availableGoals.find((g:any)=> (g.goalInstance?.id||g.id)===gid)?.goalDefinition?.title || availableGoals.find((g:any)=> (g.goalInstance?.id||g.id)===gid)?.title || 'Selected goal',
              goalTargetDate: availableGoals.find((g:any)=> (g.goalInstance?.id||g.id)===gid)?.goalInstance?.targetDate || availableGoals.find((g:any)=> (g.goalInstance?.id||g.id)===gid)?.targetDate
            }))
        ),
        // Include suggested goals as rows as well; create actual goals on save
        ...selectedSuggestedGoalIds.map((sid) => ({
          goalId: `suggested:${sid}`,
          goalTitle: availableSuggestedGoals.find((s:any)=> s.id === sid)?.title || 'Suggested Goal',
          goalTargetDate: undefined,
        })),
      ];
      const initial = goalRows.map((g) => ({
        goalId: g.goalId,
        goalTitle: g.goalTitle,
        goalTargetDate: g.goalTargetDate,
        frequency: 'daily' as Frequency,
        perPeriodTarget: 1,
        periodsCount: computePeriodsCount('daily', g.goalTargetDate),
      }));
      setRows(initial);
      setStep("targets");

      // Auto-archive the suggestion if we created it from a suggested habit
      if (prefillData?.suggestedHabitId) {
        try {
          await apiRequest(`/api/insights/habits/${prefillData.suggestedHabitId}/archive`, { method: 'POST' });
        } catch (e) {
          console.warn('Failed to auto-archive suggested habit (non-blocking)', e);
        }
      }
    } catch (error) {
      console.error('Error creating habit:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToGoal = async () => {
    if (!goalId) return;

    setLoading(true);

    try {
      const habitData = {
        title,
        description,
        lifeMetricId,
      };

      const response = await apiRequest(`/api/goals/${goalId}/habits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(habitData),
      });

      if (response) {
        setTitle("");
        setDescription("");
        // targets are configured in the next step
        setLifeMetricId("");
        onClose();
        onHabitAdded?.();
      }
    } catch (error) {
      console.error('Error adding habit to goal:', error);
    } finally {
      setLoading(false);
    }
  };

  const allTargetsValid = rows.length > 0 && rows.every((r) => (r.perPeriodTarget || 0) >= 1 && Number(r.periodsCount) >= 1);

  const handleSaveTargets = async () => {
    if (!createdHabitDefinitionId || !allTargetsValid) return;
    setSavingTargets(true);
    try {
      for (const r of rows) {
        const totalTarget = (r.perPeriodTarget || 1) * Number(r.periodsCount);
        // If this row is for a suggested goal, promote to a real goal first
        let finalGoalId = r.goalId;
        if (String(r.goalId).startsWith('suggested:')) {
          const sid = String(r.goalId).slice('suggested:'.length);
          const sg = availableSuggestedGoals.find((s:any)=> s.id === sid);
          if (sg) {
            const created = await apiRequest('/api/goals', {
              method: 'POST',
              body: JSON.stringify({
                title: sg.title,
                description: sg.description || '',
                lifeMetricId: sg.lifeMetric?.id || lifeMetricId,
                targetValue: 1,
              }),
            });
            finalGoalId = String(created.goal?.id || created?.id);
            // Archive the suggested goal now that it has been promoted
            try {
              await apiRequest(`/api/insights/goals/${sid}/archive`, { method: 'POST' });
            } catch (e) {
              console.warn('Failed to archive suggested goal after promotion', e);
            }
          }
        }
        await apiRequest(`/api/goals/${finalGoalId}/habits`, {
          method: 'POST',
          body: JSON.stringify({ habitDefinitionId: createdHabitDefinitionId, targetValue: totalTarget }),
        });
      }
      onHabitAddedWithSelections && createdHabitDefinitionId && onHabitAddedWithSelections({ habitId: createdHabitDefinitionId, associatedGoalIds: goalId ? [goalId] : selectedGoalIds, suggestedGoalIds: selectedSuggestedGoalIds });
      setCreatedHabitDefinitionId(null);
      setRows([]);
      onClose();
      onHabitAdded?.();
    } catch (e) {
      console.error('Failed saving habit targets', e);
    } finally {
      setSavingTargets(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {step === "form" ? (
            <>
              <DialogTitle className="text-xl font-bold">Add Habit to Goal</DialogTitle>
              <DialogDescription>Create a habit and associate it to a goal so it contributes to your progress.</DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle className="text-xl font-bold">Set target for <span className="text-primary font-semibold">{title}</span></DialogTitle>
              <DialogDescription>Define how this habit contributes to each selected goal.</DialogDescription>
            </>
          )}
        </DialogHeader>

        {step === "form" ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="habit-title">Habit Title *</Label>
            <Input
              id="habit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Morning meditation"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="habit-description">Description (optional)</Label>
            <Textarea
              id="habit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the habit"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="habit-category">Life Metric Category (optional)</Label>
            <Select value={lifeMetricId} onValueChange={setLifeMetricId} disabled={loading || lifeMetrics.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {lifeMetrics.map((metric: LifeMetric) => (
                  <SelectItem key={metric.id} value={metric.id}>
                    {metric.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!goalId && (
          <div className="space-y-2">
            <Label>Associate with Goal(s) (required)</Label>
            <UIButton type="button" disabled={!initialized} variant="outline" className="w-full justify-between" onClick={() => setShowGoalsOpen((v)=>!v)}>
              {!initialized ? 'Loading goals…' : (selectedGoalIds.length + selectedSuggestedGoalIds.length > 0 ? `${selectedGoalIds.length + selectedSuggestedGoalIds.length} goals selected` : 'Select goals')}
            </UIButton>
            {showGoalsOpen ? (
              <div className="w-full rounded-md border bg-white shadow-sm max-h-80 overflow-y-auto p-3">
                  {(recommendedActiveIds && recommendedActiveIds.length > 0) || (recommendedSuggestedIds && recommendedSuggestedIds.length > 0) ? (
                    <>
                      <div className="text-xs text-gray-500">Recommended</div>
                      {Array.from(new Set([
                        ...recommendedActiveIds.map((id: string) => ({ type: 'active' as const, id })),
                        ...recommendedSuggestedIds.map((id: string) => ({ type: 'suggested' as const, id })),
                      ] as Array<{type:'active'|'suggested'; id:string}>)).map(({ type, id }) => {
                        const checked = type === 'active' ? selectedGoalIds.includes(id) : selectedSuggestedGoalIds.includes(id);
                        const label = type === 'active'
                          ? (availableGoals.find((g:any) => (g.goalInstance?.id || g.id) === id)?.goalDefinition?.title || availableGoals.find((g:any) => (g.goalInstance?.id || g.id) === id)?.title)
                          : (availableSuggestedGoals.find((s:any) => s.id === id)?.title || availableSuggestedGoals.find((s:any) => s.id === id)?.goalTitle || 'Suggested Goal');
                        return (
                          <label key={`${type}-${id}`} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={checked} onCheckedChange={(v) => {
                              if (type === 'active') setSelectedGoalIds(prev => v ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
                              else setSelectedSuggestedGoalIds(prev => v ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
                            }} />
                            <span className="text-sm">{label}</span>
                          </label>
                        );
                      })}
                      <div className="h-px bg-gray-200 my-2" />
                    </>
                  ) : null}
                  <div className="text-xs text-gray-500">Active Goals</div>
                  {availableGoals.filter((g:any)=> !recommendedActiveIds.includes(g.goalInstance?.id || g.id)).map((goal: any) => {
                    const id = goal.goalInstance?.id || goal.id;
                    const checked = selectedGoalIds.includes(id);
                    return (
                      <label key={id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={(v) => {
                          setSelectedGoalIds((prev) => v ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id));
                        }} />
                        <span className="text-sm">{goal.goalDefinition?.title || goal.title}</span>
                      </label>
                    );
                  })}
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-gray-500">Suggested Goals</div>
                  {availableSuggestedGoals.filter((s:any)=> !recommendedSuggestedIds.includes(s.id)).length === 0 ? (
                    <div className="text-xs text-gray-400">No suggestions</div>
                  ) : (
                    availableSuggestedGoals.filter((s:any)=> !recommendedSuggestedIds.includes(s.id)).map((s: any) => {
                      const sid = s.id;
                      const checked = selectedSuggestedGoalIds.includes(sid);
                      return (
                        <label key={sid} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={checked} onCheckedChange={(v) => {
                            setSelectedSuggestedGoalIds((prev) => v ? Array.from(new Set([...prev, sid])) : prev.filter((x) => x !== sid));
                          }} />
                          <span className="text-sm">{s.title || s.goalTitle || 'Suggested Goal'}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
          )}

          {/* Frequency and target count are configured in the next step; removed here to avoid duplication */}

          <Button type="submit" onClick={handleSubmit} disabled={!title || loading || (!goalId && (selectedGoalIds.length + selectedSuggestedGoalIds.length === 0))} className="w-full">
            {loading ? 'Creating…' : 'Next: Set habit targets'}
          </Button>
        </form>
        ) : (
          <div className="space-y-4">
            {description ? (
              <div className="text-xs text-gray-600 bg-gray-50 border rounded p-2">{description}</div>
            ) : null}
            <div className="text-xs text-gray-600">{rows.length} goal{rows.length === 1 ? '' : 's'} selected • Per-goal plan</div>
            <div className="grid grid-cols-1 gap-3">
              {rows.map((r, idx) => {
                const unit = r.frequency === 'daily' ? 'days' : r.frequency === 'weekly' ? 'weeks' : 'months';
                const total = (r.perPeriodTarget || 0) * (Number(r.periodsCount) || 0);
                return (
                  <div key={r.goalId} className="rounded-md border p-3 bg-white">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="secondary"><Target className="h-3 w-3 mr-1" /> Goal</Badge>
                      <div className="font-medium">{r.goalTitle}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label>Frequency</Label>
                        <Select value={r.frequency} onValueChange={(val: Frequency) => setRows((prev) => prev.map((row, i) => {
                          if (i !== idx) return row;
                          const nextCount = computePeriodsCount(val, row.goalTargetDate);
                          return { ...row, frequency: val, periodsCount: nextCount };
                        }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Target per period</Label>
                        <Input type="number" min={1} value={r.perPeriodTarget} onChange={(e) => setRows((prev) => prev.map((row, i) => i === idx ? { ...row, perPeriodTarget: Number(e.target.value) } : row))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Number of {unit}</Label>
                        <Input type="number" min={1} value={r.periodsCount} onChange={(e) => setRows((prev) => prev.map((row, i) => i === idx ? { ...row, periodsCount: e.target.value === '' ? '' : Number(e.target.value) } : row))} />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      {r.goalTargetDate ? (
                        <span className="mr-2">Target: {new Date(r.goalTargetDate).toLocaleDateString()} • </span>
                      ) : null}
                      {r.perPeriodTarget || 0} per {r.frequency} × {Number(r.periodsCount) || 0} {unit} = <span className="font-medium">{total}</span> total
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between gap-2">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep("form")}>Back</Button>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              </div>
              <Button type="button" onClick={handleSaveTargets} disabled={!allTargetsValid || savingTargets}>{savingTargets ? 'Saving…' : 'Save targets and add habit to goals'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}; 