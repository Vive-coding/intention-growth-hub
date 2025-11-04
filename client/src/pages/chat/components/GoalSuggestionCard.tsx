import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Check, Zap } from "lucide-react";

interface Props {
  goal: { 
    id?: string; 
    title: string; 
    description?: string; 
    category?: string;
    priority?: string;
  };
  habits?: Array<{ 
    id?: string; 
    title: string; 
    description?: string; 
    frequency?: string;
    effortMinutes?: number;
    impact?: 'high' | 'medium' | 'low';
  }>;
  onAccept?: () => void;
  onView?: () => void;
}

export default function GoalSuggestionCard({ goal, habits = [], onAccept, onView }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    habits.forEach((h, i) => { init[(h.id || String(i))] = true; });
    return init;
  });
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [needsPrioritization, setNeedsPrioritization] = useState(false);
  
  // Persist accepted state
  useEffect(() => {
    const saved = localStorage.getItem(`goal_accepted_${goal.id || goal.title}`);
    if (saved === 'true') setAccepted(true);
  }, [goal.id, goal.title]);
  
  useEffect(() => {
    if (accepted) {
      localStorage.setItem(`goal_accepted_${goal.id || goal.title}`, 'true');
    }
  }, [accepted, goal.id, goal.title]);

  const toggle = (key: string) => setSelected(prev => ({ ...prev, [key]: !prev[key] }));

  const handleAccept = async () => {
    if (accepted) return;
    if (!confirm(`Add goal "${goal.title}" with selected habits?`)) return;
    setAccepting(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // 1) Count existing active goals BEFORE creating new one
      const countResp = await fetch(`${apiBaseUrl}/api/goals/count/active`, { headers });
      const countData = await countResp.json();
      const activeGoalCount = countData.count || 0;

      // 2) Create goal
      const createGoalResp = await fetch(`${apiBaseUrl}/api/goals`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: goal.title, description: goal.description || '' })
      });
      const created = await createGoalResp.json();
      const goalInstanceId = created?.goal?.id || created?.goal?.goalInstance?.id || created?.id;
      if (!goalInstanceId) throw new Error('Goal creation failed');

      // 3) For each selected habit → create habit definition then associate to goal
      const selectedHabits = habits.filter((h, i) => selected[h.id || String(i)]);
      for (let i = 0; i < selectedHabits.length; i++) {
        const h = selectedHabits[i];
        const createHabitResp = await fetch(`${apiBaseUrl}/api/goals/habits`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ title: h.title, description: h.description || '' })
        });
        const createdHabit = await createHabitResp.json();
        const habitDefinitionId = createdHabit?.id;
        if (!habitDefinitionId) continue;

        await fetch(`${apiBaseUrl}/api/goals/${goalInstanceId}/habits`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ habitDefinitionId, frequency: (h.frequency || 'daily'), perPeriodTarget: 1 })
        });
      }

      setAccepted(true);
      
      // 4) Check if prioritization needed and trigger if so
      const newGoalCount = activeGoalCount + 1;
      if (newGoalCount > 3) {
        // Need to trigger prioritization
        setNeedsPrioritization(true);
        // Send message to agent to trigger prioritize_optimize
        if ((window as any).sendMessage) {
          (window as any).sendMessage('I just added a new goal. Please help me prioritize my focus.');
        }
      }
      
      // Invalidate queries to refresh "My Focus"
      queryClient.invalidateQueries({ queryKey: ['/api/my-focus'] });
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/threads'] });
      
      onAccept?.();
    } catch (e) {
      console.error('Failed to accept goal suggestion', e);
      alert('Failed to add goal. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-3 sm:p-4 md:p-6 shadow-lg min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4 min-w-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Suggested Priority Goal</div>
            <div className="text-base sm:text-lg font-bold text-gray-900 mt-1 break-words">{goal.title}</div>
          </div>
        </div>
        {accepted && !needsPrioritization && (
          <Badge className="bg-teal-600 text-white text-xs px-3 py-1">Added to My Focus</Badge>
        )}
        {accepted && needsPrioritization && (
          <Badge className="bg-orange-600 text-white text-xs px-3 py-1">Needs Prioritization</Badge>
        )}
        {!accepted && goal.priority && (
          <Badge className="bg-gray-600 text-white text-xs px-3 py-1">
            {goal.priority}
          </Badge>
        )}
      </div>

      {/* Category */}
      {goal.category && (
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{goal.category}</span>
        </div>
      )}

      {/* Description */}
      {goal.description && (
        <div className="mb-6">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed break-words">{goal.description}</p>
          </div>
        </div>
      )}

      {/* Habits */}
      {habits.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">
            Habits to Support This Goal
          </div>
          <div className="space-y-3">
            {habits.map((habit, idx) => (
              <div key={`${habit.id || idx}`} className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 shadow-sm min-w-0">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                    <Check className="w-3 h-3 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                      <div className="font-semibold text-gray-900 break-words flex-1 min-w-0">{habit.title}</div>
                      {habit.impact && (
                        <Badge 
                          className={`text-xs px-2 py-1 ${
                            habit.impact === 'high' ? 'bg-red-100 text-red-700' :
                            habit.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {habit.impact === 'high' ? 'High Impact' :
                           habit.impact === 'medium' ? 'Medium Impact' : 'Low Impact'}
                        </Badge>
                      )}
                    </div>
                    {habit.description && (
                      <p className="text-sm text-gray-600 mb-2 break-words">{habit.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {habit.frequency && (
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {habit.frequency}
                        </div>
                      )}
                      {habit.effortMinutes && (
                        <div>{habit.effortMinutes} min</div>
                      )}
                    </div>
                  </div>
                  {!accepted && (
                    <div className="pl-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={selected[habit.id || String(idx)]}
                        onChange={() => toggle(habit.id || String(idx))}
                        aria-label="Include habit"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 sm:gap-3 flex-col sm:flex-row">
        {!accepted ? (
          <>
            <Button 
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? 'Adding...' : `Add Goal + ${Object.values(selected).filter(Boolean).length} Habits`}
            </Button>
            <Button 
              variant="outline" 
              className="px-4 sm:px-6 py-3 rounded-xl border-gray-300 w-full sm:w-auto"
              onClick={onView}
            >
              Dismiss
            </Button>
          </>
        ) : needsPrioritization ? (
          <div className="flex-1 bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800">
            You have 4+ active goals. Reprioritization is being triggered. This goal is not yet in "My Focus".
          </div>
        ) : (
          <Button 
            variant="outline"
            className="flex-1 px-6 py-3 rounded-xl border-teal-300 text-teal-700"
            onClick={() => (window.location.href = '/focus')}
          >
            View My Focus
          </Button>
        )}
      </div>
    </div>
  );
}


