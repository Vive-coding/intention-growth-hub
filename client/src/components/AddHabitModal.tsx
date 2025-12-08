import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button as UIButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, ChevronRight, ChevronLeft, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
  
  // Wizard step management
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  
  type Frequency = "daily" | "weekly" | "monthly";
  const [rows, setRows] = useState<Array<{ goalId: string; goalTitle: string; goalTargetDate?: string; frequency: Frequency; perPeriodTarget: number; periodsCount: number | ""; weekdaysOnly?: boolean }>>([]);
  const [savingTargets, setSavingTargets] = useState(false);

  // Step titles for the wizard
  const stepTitles = [
    "Basic Information",
    "Goal Association", 
    "Set Targets"
  ];

  function computePeriodsCount(frequency: Frequency, targetDate?: string, weekdaysOnly?: boolean): number | "" {
    if (!targetDate) return "";
    const now = new Date();
    const end = new Date(targetDate);
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msPerDay));
    if (diffDays <= 0) return 1;
    if (frequency === "daily") {
      if (weekdaysOnly) {
        // Count only weekdays between now and target date
        let weekdayCount = 0;
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        for (let i = 0; i < diffDays; i++) {
          const d = new Date(today.getTime());
          d.setDate(today.getDate() + i);
          const day = d.getDay();
          if (day !== 0 && day !== 6) {
            weekdayCount++;
          }
        }
        return Math.max(1, weekdayCount);
      }
      return Math.max(1, diffDays);
    }
    if (frequency === "weekly") return Math.max(1, Math.ceil(diffDays / 7));
    return Math.max(1, Math.ceil(diffDays / 30)); // monthly (approx)
  }

  // Navigation functions
  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return title.trim().length > 0;
      case 2:
        return selectedGoalIds.length + selectedSuggestedGoalIds.length > 0;
      case 3:
        return rows.length > 0 && rows.every((r) => (r.perPeriodTarget || 0) >= 1 && Number(r.periodsCount) >= 1);
      default:
        return false;
    }
  };

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
      setCurrentStep(1);
    } else {
      // reset init flag when closed so it re-inits next open
      setInitialized(false);
      setSelectedGoalIds([]);
      setSelectedSuggestedGoalIds([]);
      setRecommendedActiveIds([]);
      setRecommendedSuggestedIds([]);
      setRows([]);
      setCurrentStep(1);
    }
  }, [isOpen, goalId, prefillData?.recommendedGoalId, prefillData?.lifeMetricId]);

  // Prefill form data when modal opens
  useEffect(() => {
    if (isOpen && prefillData) {
      console.log('🟣 AddHabitModal - Prefill data received:', prefillData);
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
          const suggested = await apiRequest('/api/goals/suggested');
          const list = Array.isArray(suggested) ? suggested : [];
          setAvailableSuggestedGoals(list);
          console.log('🟣 suggested goals loaded', list.length);
        } catch (e) {
          console.warn('Failed to load suggested goals', e);
        }

        // Set recommendations if we have them
        if (prefillData?.recommendedGoalId) {
          const recommended = sorted.find((g: any) => (g.goalInstance?.id || g.id) === prefillData.recommendedGoalId);
          if (recommended) {
            setRecommendedActiveIds([prefillData.recommendedGoalId]);
            setSelectedGoalIds([prefillData.recommendedGoalId]);
          }
        }
        if (prefillData?.recommendedGoalIds) {
          console.log('🟣 Setting recommended goal IDs:', prefillData.recommendedGoalIds);
          console.log('🟣 Available goals structure:', availableGoals.map(g => ({ 
            id: g.id, 
            goalInstanceId: g.goalInstance?.id, 
            title: g.title || g.goalDefinition?.title 
          })));
          setRecommendedActiveIds(prefillData.recommendedGoalIds);
          setSelectedGoalIds(prefillData.recommendedGoalIds);
          console.log('🟣 Selected goal IDs set to:', prefillData.recommendedGoalIds);
        }
        if (prefillData?.recommendedSuggestedGoalIds) {
          setRecommendedSuggestedIds(prefillData.recommendedSuggestedGoalIds);
          setSelectedSuggestedGoalIds(prefillData.recommendedSuggestedGoalIds);
        }
      } catch (e) {
        console.error('Failed to load goals', e);
      }

      setInitialized(true);
    })();
  }, [isOpen, lifeMetrics, prefillData, initialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // For step 1, we just need to validate and move to next step
    // The actual habit creation happens in step 3
    nextStep();
  };

  const handleStep2Next = () => {
    // Prepare rows for the targets step when moving from step 2 to step 3
    const newRows = [];
    
    // Add selected active goals
    for (const goalId of selectedGoalIds) {
      console.log('🟣 Looking for goal with ID:', goalId);
      const goal = availableGoals.find((g: any) => {
        const match = (g.goalInstance?.id || g.id) === goalId;
        console.log('🟣 Goal match check:', { 
          goalId, 
          gId: g.id, 
          gGoalInstanceId: g.goalInstance?.id, 
          match 
        });
        return match;
      });
      if (goal) {
        console.log('🟣 Found goal:', goal);
        newRows.push({
          goalId,
          goalTitle: goal.goalDefinition?.title || goal.title,
          goalTargetDate: goal.goalInstance?.targetDate || goal.targetDate,
          frequency: 'daily' as Frequency,
          perPeriodTarget: 1,
          periodsCount: computePeriodsCount('daily', goal.goalInstance?.targetDate || goal.targetDate),
        });
      } else {
        console.error('🟣 Goal not found for ID:', goalId);
        console.error('🟣 Available goal IDs:', availableGoals.map(g => g.goalInstance?.id || g.id));
      }
    }
    
    // Add selected suggested goals
    for (const suggestedId of selectedSuggestedGoalIds) {
      const suggested = availableSuggestedGoals.find((s: any) => s.id === suggestedId);
      if (suggested) {
        newRows.push({
          goalId: `suggested:${suggestedId}`,
          goalTitle: suggested.title || suggested.goalTitle || 'Suggested Goal',
          goalTargetDate: suggested.targetDate,
          frequency: 'daily' as Frequency,
          perPeriodTarget: 1,
          periodsCount: computePeriodsCount('daily', suggested.targetDate),
        });
      }
    }
    
    setRows(newRows);
    nextStep();
  };

  const allTargetsValid = rows.length > 0 && rows.every((r) => (r.perPeriodTarget || 0) >= 1 && Number(r.periodsCount) >= 1);

  const handleSaveTargets = async () => {
    if (!allTargetsValid) return;
    setSavingTargets(true);
    try {
      // Create the habit definition first
      const habitData = {
        title: title.trim(),
        description: description.trim() || null,
        category: lifeMetricId || null,
      };

      console.log('🟣 Creating habit definition with data:', habitData);

      const habitResponse = await apiRequest('/api/goals/habits', {
        method: 'POST',
        body: JSON.stringify(habitData),
      });

      if (habitResponse?.id) {
        const habitId = habitResponse.id;
        
        // Now associate the habit with each goal
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
          // Find the row data for this goal to get frequency settings
          const rowData = rows.find(r => r.goalId === r.goalId || r.goalId === `suggested:${finalGoalId}`);
          const frequency = rowData?.frequency || 'daily';
          const perPeriodTarget = rowData?.perPeriodTarget || 1;
          const periodsCount = rowData?.periodsCount || 1;
          const weekdaysOnly = !!rowData?.weekdaysOnly;
          
          await apiRequest(`/api/goals/${finalGoalId}/habits`, {
            method: 'POST',
            body: JSON.stringify({ 
              habitDefinitionId: habitId, 
              targetValue: totalTarget,
              frequencySettings: {
                frequency,
                perPeriodTarget,
                periodsCount,
                ...(frequency === 'daily' && weekdaysOnly ? { weekdaysOnly: true } : {}),
              }
            }),
          });
        }
        
        // Dismiss the suggested habit if it was one
        if (prefillData?.suggestedHabitId) {
          try {
            console.log('🟣 Dismissing suggested habit:', prefillData.suggestedHabitId);
            await apiRequest('/api/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'suggested_habit',
                itemId: prefillData.suggestedHabitId,
                action: 'dismiss', // Use 'dismiss' to match existing filtering logic
                context: { 
                  dismissedAt: new Date().toISOString(),
                  reason: 'implemented'
                }
              })
            });
            console.log('🟣 Successfully dismissed suggested habit');
            
            // Invalidate feedback status queries to refresh the UI
            queryClient.invalidateQueries({ queryKey: ['/api/feedback/status'] });
            // Also invalidate the specific query with suggestedHabits dependency
            queryClient.invalidateQueries({ 
              predicate: (query) => 
                Array.isArray(query.queryKey) && 
                query.queryKey[0] === '/api/feedback/status'
            });
            // Also invalidate suggested habits query to refresh the list
            queryClient.invalidateQueries({ queryKey: ['/api/goals/habits/suggested'] });
          } catch (error) {
            console.warn('🟣 Failed to dismiss suggested habit:', error);
          }
        }
        
        onHabitAddedWithSelections && onHabitAddedWithSelections({ 
          habitId: habitId, 
          associatedGoalIds: goalId ? [goalId] : selectedGoalIds, 
          suggestedGoalIds: selectedSuggestedGoalIds 
        });
        
        setRows([]);
        onClose();
        onHabitAdded?.();
      } else {
        console.error('Failed to create habit:', habitResponse);
      }
    } catch (e) {
      console.error('Failed saving habit targets', e);
    } finally {
      setSavingTargets(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
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
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              {!goalId && (
                <div className="space-y-4">
                  <Label className="text-base font-medium">Associate with Goal(s) *</Label>
                  <UIButton 
                    type="button" 
                    disabled={!initialized} 
                    variant="outline" 
                    className="w-full justify-between" 
                    onClick={() => setShowGoalsOpen((v)=>!v)}
                  >
                    {!initialized ? 'Loading goals…' : (selectedGoalIds.length + selectedSuggestedGoalIds.length > 0 ? `${selectedGoalIds.length + selectedSuggestedGoalIds.length} goals selected` : 'Select goals')}
                  </UIButton>
                  
                  {showGoalsOpen && (
                    <div className="w-full rounded-md border bg-white shadow-sm max-h-80 overflow-y-auto p-4 space-y-4">
                      {(recommendedActiveIds && recommendedActiveIds.length > 0) || (recommendedSuggestedIds && recommendedSuggestedIds.length > 0) ? (
                        <div className="space-y-3">
                          <div className="text-sm font-medium text-gray-700">Recommended</div>
                          {Array.from(new Set([
                            ...recommendedActiveIds.map((id: string) => ({ type: 'active' as const, id })),
                            ...recommendedSuggestedIds.map((id: string) => ({ type: 'suggested' as const, id })),
                          ] as Array<{type:'active'|'suggested'; id:string}>)).map(({ type, id }) => {
                            const checked = type === 'active' ? selectedGoalIds.includes(id) : selectedSuggestedGoalIds.includes(id);
                            const label = type === 'active'
                              ? (availableGoals.find((g:any) => (g.goalInstance?.id || g.id) === id)?.goalDefinition?.title || availableGoals.find((g:any) => (g.goalInstance?.id || g.id) === id)?.title)
                              : (availableSuggestedGoals.find((s:any) => s.id === id)?.title || availableSuggestedGoals.find((s:any) => s.id === id)?.goalTitle || 'Suggested Goal');
                            return (
                              <label key={`${type}-${id}`} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
                                <Checkbox 
                                  checked={checked} 
                                  onCheckedChange={(v) => {
                                    if (type === 'active') setSelectedGoalIds(prev => v ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
                                    else setSelectedSuggestedGoalIds(prev => v ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
                                  }} 
                                />
                                <span className="text-sm">{label}</span>
                              </label>
                            );
                          })}
                          <div className="h-px bg-gray-200" />
                        </div>
                      ) : null}
                      
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-gray-700">Active Goals</div>
                        {availableGoals.filter((g:any)=> !recommendedActiveIds.includes(g.goalInstance?.id || g.id)).map((goal: any) => {
                          const id = goal.goalInstance?.id || goal.id;
                          const checked = selectedGoalIds.includes(id);
                          return (
                            <label key={id} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
                              <Checkbox 
                                checked={checked} 
                                onCheckedChange={(v) => {
                                  setSelectedGoalIds((prev) => v ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id));
                                }} 
                              />
                              <span className="text-sm">{goal.goalDefinition?.title || goal.title}</span>
                            </label>
                          );
                        })}
                      </div>
                      
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-gray-700">Suggested Goals</div>
                        {availableSuggestedGoals.filter((s:any)=> !recommendedSuggestedIds.includes(s.id)).length === 0 ? (
                          <div className="text-sm text-gray-400">No suggestions</div>
                        ) : (
                          availableSuggestedGoals.filter((s:any)=> !recommendedSuggestedIds.includes(s.id)).map((s: any) => {
                            const sid = s.id;
                            const checked = selectedSuggestedGoalIds.includes(sid);
                            return (
                              <label key={sid} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
                                <Checkbox 
                                  checked={checked} 
                                  onCheckedChange={(v) => {
                                    setSelectedSuggestedGoalIds((prev) => v ? Array.from(new Set([...prev, sid])) : prev.filter((x) => x !== sid));
                                  }} 
                                />
                                <span className="text-sm">{s.title || s.goalTitle || 'Suggested Goal'}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {goalId && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-800">
                    <strong>Goal:</strong> {availableGoals.find((g: any) => (g.goalInstance?.id || g.id) === goalId)?.goalDefinition?.title || availableGoals.find((g: any) => g.id === goalId)?.title || 'Selected Goal'}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {description && (
              <div className="text-sm text-gray-600 bg-gray-50 border rounded-lg p-3">
                <strong>Habit:</strong> {description}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                {rows.length} goal{rows.length === 1 ? '' : 's'} selected • Per-goal plan
              </div>
              
              <div className="space-y-4">
                {rows.map((r, idx) => {
                  const unit = r.frequency === 'daily' ? 'days' : r.frequency === 'weekly' ? 'weeks' : 'months';
                  const total = (r.perPeriodTarget || 0) * (Number(r.periodsCount) || 0);
                  return (
                    <div key={r.goalId} className="rounded-lg border p-4 bg-white shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <Badge variant="secondary">
                          <Target className="h-3 w-3 mr-1" /> Goal
                        </Badge>
                        <div className="font-medium">{r.goalTitle}</div>
                      </div>
                      
                                             <div className="space-y-4">
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                           <div className="space-y-2">
                             <Label>Frequency</Label>
                             <Select 
                               value={r.frequency} 
                               onValueChange={(val: Frequency) => setRows((prev) => prev.map((row, i) => {
                                 if (i !== idx) return row;
                                 const nextCount = computePeriodsCount(val, row.goalTargetDate, row.weekdaysOnly);
                                 return { ...row, frequency: val, periodsCount: nextCount };
                               }))}
                             >
                               <SelectTrigger>
                                 <SelectValue />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="daily">Daily</SelectItem>
                                 <SelectItem value="weekly">Weekly</SelectItem>
                                 <SelectItem value="monthly">Monthly</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
                           
                           <div className="space-y-2">
                             <Label>Target per period</Label>
                             <Input 
                               type="number" 
                               min={1} 
                               value={r.perPeriodTarget} 
                               onChange={(e) => setRows((prev) => prev.map((row, i) => i === idx ? { ...row, perPeriodTarget: Number(e.target.value) } : row))} 
                             />
                           </div>
                           
                           <div className="space-y-2">
                             <Label>Number of {unit}</Label>
                             <Input 
                               type="number" 
                               min={1} 
                               value={r.periodsCount} 
                               onChange={(e) => setRows((prev) => prev.map((row, i) => i === idx ? { ...row, periodsCount: e.target.value === '' ? '' : Number(e.target.value) } : row))} 
                             />
                           </div>
                         </div>
                        
                        {r.frequency === 'daily' && (
                          <div className="flex items-center gap-2 mt-1 text-sm">
                            <input
                              id={`weekdays-only-${idx}`}
                              type="checkbox"
                              className="h-4 w-4"
                              checked={!!r.weekdaysOnly}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setRows((prev) => prev.map((row, i) => {
                                  if (i !== idx) return row;
                                  const nextCount = computePeriodsCount(row.frequency, row.goalTargetDate, checked);
                                  return { ...row, weekdaysOnly: checked, periodsCount: nextCount };
                                }));
                              }}
                            />
                            <Label htmlFor={`weekdays-only-${idx}`} className="text-xs sm:text-sm font-normal">
                              Only count weekdays (Mon–Fri)
                            </Label>
                          </div>
                        )}
                        
                        <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
                          {r.goalTargetDate ? (
                            <span className="mr-2">Target: {new Date(r.goalTargetDate).toLocaleDateString()} • </span>
                          ) : null}
                          {r.perPeriodTarget || 0} per {r.frequency} × {Number(r.periodsCount) || 0} {unit} = <span className="font-medium">{total}</span> total
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader className="space-y-3">
          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-3">
            {stepTitles.map((stepTitle, index) => (
              <div key={index} className="flex items-center">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 ${
                  index + 1 < currentStep 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : index + 1 === currentStep 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}>
                  {index + 1 < currentStep ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>
                <span className={`ml-1 text-xs font-medium ${
                  index + 1 === currentStep ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {stepTitle}
                </span>
                {index < stepTitles.length - 1 && (
                  <ChevronRight className="w-3 h-3 mx-1 text-gray-300" />
                )}
              </div>
            ))}
          </div>

          <div>
            <DialogTitle className="text-lg font-bold">
              {currentStep === 1 && "Add Habit to Goal"}
              {currentStep === 2 && "Associate with Goals"}
              {currentStep === 3 && `Set Targets for ${title}`}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {currentStep === 1 && "Create a habit and associate it to a goal so it contributes to your progress."}
              {currentStep === 2 && "Select which goals this habit will contribute to."}
              {currentStep === 3 && "Define how this habit contributes to each selected goal."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="py-4">
          {renderStepContent()}
        </div>

        {/* Navigation Footer */}
        <div className="flex justify-between items-center pt-6 border-t">
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={prevStep}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
          
          <div className="flex gap-2">
            {currentStep < totalSteps ? (
              <Button 
                type="button" 
                onClick={currentStep === 1 ? handleSubmit : handleStep2Next}
                disabled={!canProceedToNext() || loading}
              >
                {loading ? 'Creating…' : 'Next'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                type="button" 
                onClick={handleSaveTargets} 
                disabled={!allTargetsValid || savingTargets}
              >
                {savingTargets ? 'Saving…' : 'Save and Add Habit'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 