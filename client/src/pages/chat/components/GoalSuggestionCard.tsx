import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Check, Zap, Loader2 } from "lucide-react";

interface Props {
  threadId?: string;
  goal: { 
    id?: string; 
    title: string; 
    description?: string; 
    category?: string;
    priority?: string;
    lifeMetricId?: string;
    lifeMetricName?: string;
    targetDate?: string;
    startTimeline?: 'now' | 'soon' | 'later';
    isInFocus?: boolean;
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

const NOTIFICATION_FREQUENCY_LABELS: Record<string, string> = {
  weekday: "weekdays",
  twice_per_week: "twice per week",
  weekly: "weekly",
};

const NOTIFICATION_TIME_LABELS: Record<string, string> = {
  morning: "the morning",
  afternoon: "the afternoon",
  evening: "the evening",
};

const NOTIFICATION_FREQUENCY_OPTIONS = [
  { value: "weekday", label: "Weekdays", description: "Quick weekday nudges" },
  { value: "twice_per_week", label: "Twice per week", description: "Two check-ins to stay aligned" },
  { value: "weekly", label: "Weekly", description: "One end-of-week reflection" },
] as const;

const NOTIFICATION_TIME_OPTIONS = [
  { value: "morning", label: "Morning", description: "8–11am" },
  { value: "afternoon", label: "Afternoon", description: "2–5pm" },
  { value: "evening", label: "Evening", description: "6–9pm" },
] as const;


export default function GoalSuggestionCard({ threadId, goal, habits = [], onAccept, onView }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    habits.forEach((h, i) => { init[(h.id || String(i))] = true; });
    return init;
  });
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptedThisSession, setAcceptedThisSession] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [createdGoalInstanceId, setCreatedGoalInstanceId] = useState<string | null>(null);
  const [addedToFocus, setAddedToFocus] = useState(false);
  const [needsPrioritization, setNeedsPrioritization] = useState(false);
  const [shouldOfferPrioritization, setShouldOfferPrioritization] = useState(false);
  const [autoPrioritizationRequested, setAutoPrioritizationRequested] = useState(false);
  const [goalCountAfterAdd, setGoalCountAfterAdd] = useState<number | null>(null);
  const { data: onboardingProfile, isLoading: onboardingProfileLoading, refetch: refetchOnboardingProfile } = useQuery({
    queryKey: ["/api/users/onboarding-profile"],
    queryFn: async () => {
      try {
        return await apiRequest("/api/users/onboarding-profile");
      } catch (error) {
        console.warn("[GoalSuggestionCard] Failed to fetch onboarding profile", error);
        return null;
      }
    },
    staleTime: 60_000,
  });
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [notificationOptInChoice, setNotificationOptInChoice] = useState<"question" | "opt_in">("question");
  const [notificationFrequency, setNotificationFrequency] = useState("weekday");
  const [notificationTime, setNotificationTime] = useState("morning");
  const [savingNotification, setSavingNotification] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  
  const defaultLimit = typeof window !== "undefined" ? Number(localStorage.getItem('focusGoalLimit') || '3') : 3;
  const normalizedDefaultLimit = Math.min(Math.max(defaultLimit, 3), 5);
  const [focusGoalLimit, setFocusGoalLimit] = useState(normalizedDefaultLimit);
  
  // Persist per-card state (dismissed/accepted/created goal id/my-focus status) so threads can be reopened safely.
  // Use a simple hash instead of btoa to handle Unicode characters (emojis, etc.)
  const simpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  };

  const cardStateKey = useMemo(() => {
    const basis = [
      threadId || "global",
      goal.id || "",
      goal.title || "",
      goal.description || "",
      goal.category || "",
      goal.lifeMetricId || "",
      goal.lifeMetricName || "",
      goal.targetDate || "",
    ].join("|");
    return `goal_card_state_${simpleHash(basis)}`;
  }, [
    threadId,
    goal.id,
    goal.title,
    goal.description,
    goal.category,
    goal.lifeMetricId,
    goal.lifeMetricName,
    goal.targetDate,
  ]);

  const readCardState = () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(cardStateKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed as any;
    } catch {
      return null;
    }
  };

  const writeCardState = (patch: Record<string, any>) => {
    if (typeof window === "undefined") return;
    const prev = readCardState() || {};
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    try {
      window.localStorage.setItem(cardStateKey, JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    const s = readCardState();
    if (!s) return;
    if (typeof s.dismissed === "boolean") setDismissed(!!s.dismissed);
    if (typeof s.accepted === "boolean") setAccepted(!!s.accepted);
    if (typeof s.createdGoalInstanceId === "string") setCreatedGoalInstanceId(s.createdGoalInstanceId);
    if (typeof s.addedToFocus === "boolean") setAddedToFocus(!!s.addedToFocus);
    if (s.accepted) setAcceptedThisSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardStateKey]);

  // Persist key state transitions so mobile reloads keep the same card state
  useEffect(() => {
    writeCardState({
      dismissed,
      accepted,
      createdGoalInstanceId,
      addedToFocus,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed, accepted, createdGoalInstanceId, addedToFocus]);

  useEffect(() => {
    if (!onboardingProfile) return;
    if (typeof onboardingProfile.notificationFrequency === "string") {
      setNotificationFrequency(onboardingProfile.notificationFrequency);
    }
    if (typeof onboardingProfile.preferredNotificationTime === "string") {
      const [primaryTime] = onboardingProfile.preferredNotificationTime
        .split(",")
        .map((entry: string) => entry.trim())
        .filter(Boolean);
      if (primaryTime) {
        setNotificationTime(primaryTime);
      }
    } else if (
      Array.isArray(onboardingProfile.preferredNotificationTime) &&
      onboardingProfile.preferredNotificationTime.length > 0
    ) {
      setNotificationTime(onboardingProfile.preferredNotificationTime[0]);
    }
  }, [onboardingProfile?.notificationFrequency, onboardingProfile?.preferredNotificationTime]);

  useEffect(() => {
    if (!acceptedThisSession) return;
    if (onboardingProfileLoading) return;
    if (typeof onboardingProfile?.notificationEnabled === "boolean") {
      setShowNotificationPrompt(false);
      return;
    }
    setNotificationOptInChoice("question");
    setNotificationError(null);
    setShowNotificationPrompt(true);
  }, [acceptedThisSession, onboardingProfile?.notificationEnabled, onboardingProfileLoading]);

  const notificationFollowUpMessage = useMemo(() => {
    if (!onboardingProfile?.notificationEnabled) {
      return null;
    }

    const frequencyValue = onboardingProfile.notificationFrequency || undefined;
    const rawTimes = typeof onboardingProfile.preferredNotificationTime === "string"
      ? onboardingProfile.preferredNotificationTime.split(",").map((entry: string) => entry.trim()).filter(Boolean)
      : Array.isArray(onboardingProfile.preferredNotificationTime)
        ? onboardingProfile.preferredNotificationTime
        : [];

    const frequencyPhrase = frequencyValue
      ? frequencyValue === "twice_per_week"
        ? "twice per week"
        : frequencyValue === "weekly"
          ? "once a week"
          : `on ${NOTIFICATION_FREQUENCY_LABELS[frequencyValue] ?? frequencyValue}`
      : null;
    const timePhrase = rawTimes.length > 0
      ? `in ${rawTimes.map((time) => NOTIFICATION_TIME_LABELS[time] ?? time).join(" & the ")}`
      : null;
    const cadence = [frequencyPhrase, timePhrase].filter(Boolean).join(" ");

    return `Your coach will follow up via email${cadence ? ` ${cadence}` : ""}.`;
  }, [
    onboardingProfile?.notificationEnabled,
    onboardingProfile?.notificationFrequency,
    onboardingProfile?.preferredNotificationTime,
  ]);

  const sendPrioritizeRequest = (message?: string) => {
    const text =
      message ?? "I just added a new goal. Please help me reprioritize my focus goals.";
    if ((window as any).composeAndSend) {
      (window as any).composeAndSend(text, 'prioritize_optimize');
    } else if ((window as any).sendMessage) {
      (window as any).sendMessage(text);
    }
  };

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
      let limitForDecision = focusGoalLimit;
      if (typeof countData.focusGoalLimit === 'number') {
        const nextLimit = Math.min(Math.max(Number(countData.focusGoalLimit), 3), 5);
        setFocusGoalLimit(nextLimit);
        limitForDecision = nextLimit;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('focusGoalLimit', String(nextLimit));
        }
      }

      // 2) Create goal
      const payload: Record<string, any> = {
        title: goal.title,
        description: goal.description || '',
      };

      const inferredLifeMetric =
        goal.lifeMetricId ||
        goal.lifeMetricName ||
        goal.category ||
        (Array.isArray(onboardingProfile?.focusLifeMetrics) && onboardingProfile.focusLifeMetrics[0]);

      if (goal.lifeMetricId) {
        payload.lifeMetricId = goal.lifeMetricId;
      } else if (typeof inferredLifeMetric === "string" && inferredLifeMetric.length > 0) {
        payload.lifeMetricName = inferredLifeMetric;
      }

      // When user accepts from the chat card, treat it as "start now" by default.
      // This ensures the goal lands in Focus and shows up as "In focus" immediately.
      payload.startTimeline = 'now';

      if (typeof goal.targetDate === "string" && goal.targetDate.trim().length > 0) {
        payload.targetDate = goal.targetDate;
      }

      console.log('[GoalSuggestionCard] Creating goal with payload:', payload);
      const createGoalResp = await fetch(`${apiBaseUrl}/api/goals`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (!createGoalResp.ok) {
        const errorText = await createGoalResp.text();
        console.error('[GoalSuggestionCard] Goal creation failed:', createGoalResp.status, errorText);
        throw new Error(`Goal creation failed: ${createGoalResp.status}`);
      }
      
      const created = await createGoalResp.json();
      console.log('[GoalSuggestionCard] Goal created:', created);
      const goalInstanceId = created?.goal?.id || created?.goal?.goalInstance?.id || created?.id;
      if (!goalInstanceId) {
        console.error('[GoalSuggestionCard] No goal ID in response:', created);
        throw new Error('Goal creation failed - no ID returned');
      }
      setCreatedGoalInstanceId(goalInstanceId);
      writeCardState({ createdGoalInstanceId: goalInstanceId });

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

        // Let backend calculate proper targets based on goal's target date
        // Don't pass perPeriodTarget - backend will use calculateFrequencySettings
        await fetch(`${apiBaseUrl}/api/goals/${goalInstanceId}/habits`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            habitDefinitionId, 
            frequency: (h.frequency || 'daily')
            // perPeriodTarget omitted - backend will calculate based on frequency and goal target date
          })
        });
      }

      setAccepted(true);
      setAcceptedThisSession(true);
      writeCardState({ accepted: true });

      // If starting now, automatically add to My Focus (priority snapshot) so "View in My Focus" is real.
      if (payload.startTimeline === 'now') {
        try {
          const focusResp = await fetch(`${apiBaseUrl}/api/my-focus`, { headers });
          let existingIds: string[] = [];
          if (focusResp.ok) {
            const focusData = await focusResp.json();
            if (Array.isArray(focusData?.priorityGoals)) {
              existingIds = focusData.priorityGoals.map((g: any) => g?.id).filter(Boolean);
            }
          }

          const nextIds = [...existingIds.filter((id) => id !== goalInstanceId), goalInstanceId];
          const items = nextIds.map((id, idx) => ({ goalInstanceId: id, rank: idx + 1 }));

          const applyResp = await fetch(`${apiBaseUrl}/api/my-focus/priorities/apply`, {
            method: "POST",
            headers,
            body: JSON.stringify({ items, sourceThreadId: threadId || null }),
          });

          if (applyResp.ok) {
            setAddedToFocus(true);
            writeCardState({ addedToFocus: true });
            queryClient.invalidateQueries({ queryKey: ['/api/my-focus'] });
          } else {
            console.warn('[GoalSuggestionCard] Failed to add to My Focus:', applyResp.status);
          }
        } catch (e) {
          console.warn('[GoalSuggestionCard] Failed to add to My Focus:', e);
        }
      }

      const newGoalCount = activeGoalCount + 1;
      setGoalCountAfterAdd(newGoalCount);
      const shouldAutoPrioritize = newGoalCount > limitForDecision;
      setNeedsPrioritization(shouldAutoPrioritize);
      setShouldOfferPrioritization(shouldAutoPrioritize ? false : newGoalCount >= 2);
      if (shouldAutoPrioritize) {
        setAutoPrioritizationRequested(true);
        sendPrioritizeRequest("I just added a new goal. Please help me reprioritize my focus goals.");
      } else {
        setAutoPrioritizationRequested(false);
      }
      
      // Invalidate queries to refresh "My Focus"
      queryClient.invalidateQueries({ queryKey: ['/api/my-focus'] });
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/threads'] });
      
      onAccept?.();
    } catch (e: any) {
      console.error('[GoalSuggestionCard] Failed to accept goal suggestion:', e);
      alert(`Failed to add goal: ${e?.message || 'Unknown error'}. Please try again.`);
    } finally {
      setAccepting(false);
    }
  };

  const handleSaveNotificationPreference = async () => {
    if (savingNotification) return;
    setSavingNotification(true);
    setNotificationError(null);
    try {
      await apiRequest("/api/users/notification-preferences", {
        method: "POST",
        body: JSON.stringify({
          enabled: true,
          frequency: notificationFrequency,
          preferredTime: notificationTime,
        }),
      });
      await refetchOnboardingProfile();
      setShowNotificationPrompt(false);
      setNotificationOptInChoice("question");
      setAcceptedThisSession(false);
    } catch (error: any) {
      setNotificationError(error?.message ?? "Failed to save notification preference.");
    } finally {
      setSavingNotification(false);
    }
  };

  const handleDeclineNotification = async () => {
    if (savingNotification) return;
    setSavingNotification(true);
    setNotificationError(null);
    try {
      await apiRequest("/api/users/notification-preferences", {
        method: "POST",
        body: JSON.stringify({
          enabled: false,
          frequency: null,
          preferredTime: null,
        }),
      });
      await refetchOnboardingProfile();
      setShowNotificationPrompt(false);
      setNotificationOptInChoice("question");
      setAcceptedThisSession(false);
    } catch (error: any) {
      setNotificationError(error?.message ?? "Failed to update notification preference.");
    } finally {
      setSavingNotification(false);
    }
  };

  const handlePrioritizeClick = () => {
    setShouldOfferPrioritization(false);
    setNeedsPrioritization(false);
    setAutoPrioritizationRequested(true);
    sendPrioritizeRequest("Let's prioritize my focus goals.");
  };

  // Show dismissed state
  if (dismissed) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center text-gray-500">
        <p className="text-sm">Goal suggestion dismissed</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-3 sm:p-4 md:p-6 shadow-lg min-w-0 overflow-hidden w-full max-w-[95vw]">
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
          <Badge className="bg-teal-600 text-white text-xs px-3 py-1 flex items-center justify-center text-center">Goal accepted</Badge>
        )}
        {accepted && needsPrioritization && (
          <Badge className="bg-orange-600 text-white text-xs px-3 py-1 flex items-center justify-center text-center">Needs Prioritization</Badge>
        )}
        {!accepted && goal.priority && (
          <Badge className="bg-gray-600 text-white text-xs px-3 py-1 flex items-center justify-center text-center">
            {goal.priority}
          </Badge>
        )}
      </div>

      {/* Category and Target Date */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {goal.category && (
          <Badge className="text-xs px-2.5 py-1 flex items-center justify-center text-center bg-blue-50 text-blue-700 border border-blue-200">
            {goal.category}
          </Badge>
        )}
        {goal.targetDate && (
          <Badge className="text-xs px-2.5 py-1 flex items-center justify-center text-center bg-gray-50 text-gray-700 border border-gray-200 gap-1.5">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>
          </Badge>
        )}
      </div>

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
                          className={`text-xs px-2 py-1 flex items-center justify-center text-center ${
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
              <span className="truncate">
                {accepting ? 'Adding...' : `Add Goal + ${Object.values(selected).filter(Boolean).length} Habit${Object.values(selected).filter(Boolean).length !== 1 ? 's' : ''}`}
              </span>
            </Button>
            <Button 
              variant="outline" 
              className="px-4 sm:px-6 py-3 rounded-xl border-gray-300 w-full sm:w-auto"
              onClick={() => {
                setDismissed(true);
                writeCardState({ dismissed: true });
              }}
            >
              Dismiss
            </Button>
          </>
        ) : needsPrioritization ? (
          <div className="flex-1 bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800">
            You now have more than {focusGoalLimit} active focus goals.{" "}
            {autoPrioritizationRequested
              ? "I asked your coach to reprioritize them so you can stay focused."
              : "Let’s prioritize to decide which ones stay in \"My Focus\"."}
          </div>
        ) : accepted && addedToFocus ? (
          <div className="flex-1 space-y-2">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm text-teal-800">
              Goal added to My Focus. I’ll keep this thread open so we can plan next steps whenever you’re ready.
            </div>
            <Button
              variant="outline"
              className="w-full border-emerald-500 text-emerald-700 hover:bg-emerald-50"
              onClick={() => window.location.href = '/focus'}
            >
              View in My Focus
            </Button>
          </div>
        ) : (
          <div className="flex-1 bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm text-teal-800">
            Goal created. I’ll keep this thread open so we can plan next steps whenever you’re ready.
          </div>
        )}
      </div>

      {accepted && notificationFollowUpMessage && (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-white/80 p-4 text-sm text-emerald-800 shadow-sm">
          {notificationFollowUpMessage}
        </div>
      )}

      {accepted && shouldOfferPrioritization && (
        <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="text-sm font-semibold text-blue-900">
            {goalCountAfterAdd && goalCountAfterAdd > 1
              ? `You now have ${goalCountAfterAdd} active focus goals${focusGoalLimit ? ` (limit ${focusGoalLimit})` : ''}. Want help prioritizing them?`
              : "Want help prioritizing your focus goals?"}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handlePrioritizeClick}
            >
              Yes, prioritize my focus
            </Button>
            <Button
              variant="ghost"
              className="text-blue-700"
              onClick={() => setShouldOfferPrioritization(false)}
            >
              Maybe later
            </Button>
          </div>
        </div>
      )}

      {accepted && !showNotificationPrompt && !notificationFollowUpMessage && !onboardingProfileLoading && (
        <div className="mt-4 text-xs text-emerald-700">
          Want gentle reminders later? You can enable email check-ins anytime from settings.
        </div>
      )}

      {accepted && !showNotificationPrompt && onboardingProfile?.notificationEnabled !== true && !onboardingProfileLoading && (
        <div className="mt-3">
          <Button
            variant="ghost"
            className="px-0 text-sm text-emerald-700 hover:text-emerald-800"
            onClick={() => {
              setNotificationOptInChoice("question");
              setNotificationError(null);
              setShowNotificationPrompt(true);
            }}
          >
            Enable email check-ins
          </Button>
        </div>
      )}

      {accepted && showNotificationPrompt && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-inner">
          {notificationOptInChoice === "question" ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-emerald-900">
                Stay accountable with gentle email check-ins?
              </div>
              <p className="text-sm text-emerald-800">
                Your coach can nudge you by email when it’s time to review progress on your focus goals.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setNotificationOptInChoice("opt_in");
                  }}
                >
                  Yes, enable check-ins
                </Button>
                <Button
                  variant="outline"
                  className="border-emerald-400 text-emerald-700"
                  onClick={handleDeclineNotification}
                  disabled={savingNotification}
                >
                  {savingNotification ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Not now"
                  )}
                </Button>
              </div>
              <p className="text-xs text-emerald-700">
                You can adjust or disable these anytime from Settings → Notifications.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Best time of day</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {NOTIFICATION_TIME_OPTIONS.map((option) => {
                    const isSelected = notificationTime === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setNotificationTime(option.value)}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-emerald-500 bg-white shadow"
                            : "border-emerald-200 bg-white/70 hover:bg-white"
                        }`}
                      >
                        <div className="text-sm font-semibold text-emerald-900">{option.label}</div>
                        <div className="text-xs text-emerald-700">{option.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Follow-up cadence</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {NOTIFICATION_FREQUENCY_OPTIONS.map((option) => {
                    const isSelected = notificationFrequency === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setNotificationFrequency(option.value)}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-emerald-500 bg-white shadow"
                            : "border-emerald-200 bg-white/70 hover:bg-white"
                        }`}
                      >
                        <div className="text-sm font-semibold text-emerald-900">{option.label}</div>
                        <div className="text-xs text-emerald-700">{option.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {notificationError && (
                <p className="text-xs text-rose-600">{notificationError}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSaveNotificationPreference}
                  disabled={savingNotification}
                >
                  {savingNotification ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save email follow-ups"
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="border-emerald-300 text-emerald-700"
                  onClick={() => {
                    setNotificationOptInChoice("question");
                    setNotificationError(null);
                  }}
                  disabled={savingNotification}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


