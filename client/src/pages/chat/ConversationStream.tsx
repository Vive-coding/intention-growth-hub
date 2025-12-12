import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Check, Target as TargetIcon, Trophy, Clock } from "lucide-react";
import GoalSuggestionCard from "@/pages/chat/components/GoalSuggestionCard";
import HabitCard from "@/pages/chat/components/HabitCard";
import PrioritizationCard from "@/pages/chat/components/PrioritizationCard";
import OptimizationCard from "@/pages/chat/components/OptimizationCard";

interface Props {
  threadId?: string;
}

export default function ConversationStream({ threadId }: Props) {
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [cta, setCta] = useState<string | undefined>(undefined);
  const [streamingStructuredData, setStreamingStructuredData] = useState<any | undefined>(undefined);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<string | undefined>(undefined);
  const [, navigate] = useLocation();
  const [recentlyCompleted, setRecentlyCompleted] = useState<Record<string, boolean>>({});
  const [habitCardSubmitted, setHabitCardSubmitted] = useState<Record<string, boolean>>({});
  const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const autoScrollRef = useRef(true);

  const resolveScrollContainer = () => {
    if (typeof window === "undefined") return null;
    if (scrollContainerRef.current && scrollContainerRef.current.isConnected) {
      return scrollContainerRef.current;
    }

    const bottomElement = bottomRef.current;
    if (!bottomElement) return null;

    const container = bottomElement.closest('[data-chat-scroll-container="true"]') as HTMLElement | null;
    if (container) {
      scrollContainerRef.current = container;
    }

    return container;
  };

  // Fetch messages for the thread
  const { data: messages = [], error: messagesError } = useQuery({
    queryKey: ["/api/chat/threads", threadId, "messages"],
    enabled: !!threadId,
    queryFn: async () => {
      if (!threadId) return [];
      return apiRequest(`/api/chat/threads/${threadId}/messages`);
    },
    staleTime: 5_000,
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 3;
    },
    gcTime: 0,
  });

  // Navigate away promptly on 404 without causing setState loops
  useEffect(() => {
    const status = (messagesError as any)?.status;
    if (status === 404 && threadId) {
      console.log('[ConversationStream] Thread deleted (404). Navigating to /chat');
      navigate('/', { replace: true });
    }
  }, [messagesError, threadId, navigate]);

  useEffect(() => {
    const container = resolveScrollContainer();
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      autoScrollRef.current = scrollHeight - (scrollTop + clientHeight) < 120;
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [threadId]);

  useEffect(() => {
    autoScrollRef.current = true;
    const container = resolveScrollContainer();
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [threadId]);

  // Clear optimistic message when we get fresh messages, but only if we're not currently streaming
  useEffect(() => {
    if (messages.length > 0 && !isStreaming && !isThinking) {
      setOptimisticUserMessage(undefined);
    }
  }, [messages, isStreaming, isThinking]);

  // Note: We navigate away on explicit 404 via onError above to avoid loops

  useIsomorphicLayoutEffect(() => {
    const container = resolveScrollContainer();
    if (!container) return;
    if (!autoScrollRef.current) return;

    container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
  }, [messages.length, streamingText, optimisticUserMessage, isThinking]);

  // Debug: Log when payloads are detected
  useEffect(() => {
    messages.forEach((m: any) => {
      if (m.role === 'assistant' && typeof m.content === 'string') {
        const marker = '\n---json---\n';
        const idx = m.content.indexOf(marker);
        if (idx !== -1) {
          try {
            const payload = JSON.parse(m.content.slice(idx + marker.length).trim());
            console.log('[ConversationStream] 📊 Card payload detected:', payload.type);
          } catch (e) {}
        }
      }
    });
  }, [messages]);

  // Expose a tiny API for Composer to start/stop streaming
  // We keep this local for Phase 3.1; later can lift to context if needed
  (window as any).chatStream = {
    addUserMessage: (message: string) => {
      console.log('[ConversationStream] Setting optimistic message:', message);
      setOptimisticUserMessage(message);
      console.log('[ConversationStream] Optimistic message state set to:', message);
    },
    begin: () => {
      console.log('[ConversationStream] Beginning stream');
      setStreamingText("");
      setIsThinking(true);
      setIsStreaming(false);
      setCta(undefined);
      setStreamingStructuredData(undefined);
    },
    append: (token: string) => {
      setIsThinking(false);
      setIsStreaming(true);
      setStreamingText((s) => s + token);
    },
    end: () => {
      console.log('[ConversationStream] Ending stream');
      setIsStreaming(false);
      setIsThinking(false);
      // Don't clear optimistic message here - let the query refresh handle it
    },
    cta: (label: string) => setCta(label),
    structuredData: (data: any) => setStreamingStructuredData(data),
  };

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-3 md:px-4 py-6 space-y-4 overflow-x-hidden w-full">
      {messages.map((m: any) => {
        const isAssistant = m.role === 'assistant';
        const marker = '\n---json---\n';
        let pre = String(m.content || '');
        let payload: any | undefined;
        if (isAssistant && typeof m.content === 'string') {
          const idx = m.content.indexOf(marker);
          if (idx !== -1) {
            pre = m.content.slice(0, idx).trim();
            try {
              payload = JSON.parse(m.content.slice(idx + marker.length).trim());
            } catch {}
          }
        }

        return (
          <div key={m.id} className="space-y-2">
            {pre && (
              <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[95%] sm:max-w-[88%] md:max-w-[85%] w-full min-w-0 rounded-2xl px-3 sm:px-4 py-3 shadow-sm ${m.role === 'user' ? 'bg-teal-600 text-white rounded-br-md' : 'bg-white text-gray-800 border rounded-bl-md'}`}>
                  <div className="text-xs opacity-70 mb-1">
                    {m.role === 'user' ? 'You' : 'Coach'} • {(() => {
                      try {
                        const tz = (localStorage.getItem('timezone') || 'America/New_York');
                        return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short', timeZone: tz }).format(new Date(m.createdAt));
                      } catch {
                        return new Date(m.createdAt).toLocaleString();
                      }
                    })()}
                  </div>
                  <div className="whitespace-pre-wrap break-words leading-relaxed">{pre}</div>
                </div>
              </div>
            )}

            {isAssistant && payload && (
              <div className="flex justify-start">
                <div className="max-w-[95%] sm:max-w-[88%] md:max-w-[85%] w-full min-w-0">
                  {(() => {
                    const type = String(payload.type || '').toLowerCase();
                    if (type === 'goal_suggestion') {
                      return (
                        <GoalSuggestionCard
                          threadId={threadId}
                          goal={payload.goal}
                          habits={payload.habits}
                        />
                      );
                    }
                    if (type === 'goal_suggestions') {
                      return (
                        <div className="grid gap-4">
                          {(payload.items || []).map((item: any, idx: number) => (
                            <GoalSuggestionCard
                              key={idx}
                              threadId={threadId}
                              goal={item.goal}
                              habits={item.habits}
                            />
                          ))}
                        </div>
                      );
                    }
                    if (type === 'habit_completion') {
                      const habit = payload.habit || {};
                      const completedAt = habit.completedAt ? new Date(habit.completedAt) : new Date();
                      const timeStr = completedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                      // Ensure streak is at least 1 since we just completed it
                      const streak = Math.max(1, habit.streak || 1);
                      
                      // Invalidate habits queries to update slide-out
                      queryClient.invalidateQueries({ queryKey: ["/api/habits/today-completions"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/goals/habits/completed-today"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/my-focus"] });
                      return (
                        <div className="bg-teal-50 border-2 border-teal-200 rounded-xl p-3 sm:p-4 shadow-sm min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 text-teal-700 mb-2">
                            <Check className="w-5 h-5" />
                            <span className="font-semibold">Habit Logged!</span>
                          </div>
                          <div className="text-base text-gray-900 font-semibold break-words mb-2">{habit.title || 'Habit'}</div>
                          <div className="text-[11px] sm:text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                            {habit.relatedGoal && (
                              <span className="inline-flex items-center gap-1">
                                Focus:&nbsp;
                                <span className="text-gray-700 truncate max-w-[150px] sm:max-w-[200px]">
                                  {habit.relatedGoal}
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] sm:text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>Streak {streak}d</span>
                            <span className="flex items-center gap-1.5 text-teal-700">
                              <Clock className="w-3 h-3" />
                              <span>Completed at {timeStr}</span>
                            </span>
                          </div>
                          {payload.already_completed && (
                            <div className="text-xs text-gray-500 mt-2 italic">
                              Already logged earlier today
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (type === 'progress_update') {
                      // Confirmation card when a goal's progress is updated
                      const title = payload.goal_title || "Goal";
                      const oldPct = typeof payload.old_progress === "number" ? payload.old_progress : undefined;
                      const newPct = typeof payload.new_progress === "number" ? payload.new_progress : undefined;
                      const milestone = !!payload.milestone_reached;
                      // Refresh My Focus so the updated goal progress shows there as well
                      queryClient.invalidateQueries({ queryKey: ["/api/my-focus"] });
                      return (
                        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-3 sm:p-4 shadow-sm min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 text-emerald-700 mb-2">
                            <TargetIcon className="w-5 h-5" />
                            <span className="font-semibold">Goal Progressed</span>
                          </div>
                          <div className="text-sm text-gray-900 font-semibold break-words">{title}</div>
                          {oldPct !== undefined && newPct !== undefined && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                <span>Progress</span>
                                <span>
                                  {oldPct}% →{" "}
                                  <span className="font-semibold text-emerald-700">{newPct}%</span>
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-emerald-100 overflow-hidden">
                                <div
                                  className="h-2 rounded-full bg-emerald-500 transition-all"
                                  style={{ width: `${Math.max(0, Math.min(100, newPct))}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {payload.update_text && (
                            <div className="mt-2 text-xs text-gray-700 break-words">
                              {payload.update_text}
                            </div>
                          )}
                          {milestone && (
                            <div className="mt-2 text-xs text-emerald-700 font-medium">
                              🎉 Milestone reached – nice momentum.
                            </div>
                          )}
                          <button
                            type="button"
                            className="mt-3 w-full text-sm font-medium text-emerald-700 border border-emerald-200 rounded-xl py-1.5 hover:bg-emerald-100 transition-colors"
                            onClick={() => {
                              window.location.href = "/focus";
                            }}
                          >
                            View in My Focus →
                          </button>
                        </div>
                      );
                    }
                    if (type === "goal_celebration") {
                      // Celebration card when a goal is completed
                      const title = payload.goal_title || "Goal completed";
                      const completedDate = payload.completed_date ? new Date(payload.completed_date) : null;
                      // Refresh My Focus so completed goals disappear from active focus
                      queryClient.invalidateQueries({ queryKey: ["/api/my-focus"] });
                      return (
                        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-3 sm:p-4 shadow-sm min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 text-indigo-700 mb-2">
                            <Trophy className="w-5 h-5" />
                            <span className="font-semibold">Goal Completed!</span>
                          </div>
                          <div className="text-sm text-gray-900 font-semibold break-words">{title}</div>
                          {completedDate && (
                            <div className="mt-1 text-xs text-gray-600">
                              Finished on {completedDate.toLocaleDateString()}
                            </div>
                          )}
                          {payload.reflection && (
                            <div className="mt-2 text-xs text-gray-700 break-words">
                              {payload.reflection}
                            </div>
                          )}
                          <button
                            type="button"
                            className="mt-3 w-full text-sm font-medium text-indigo-700 border border-indigo-200 rounded-xl py-1.5 hover:bg-indigo-100 transition-colors"
                            onClick={() => {
                              window.location.href = "/focus";
                            }}
                          >
                            View in My Focus →
                          </button>
                        </div>
                      );
                    }
                    if (type === 'habit_review') {
                      return (
                        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm min-w-0 overflow-hidden">
                          <div className="text-sm font-semibold text-gray-800 mb-2 uppercase tracking-wide">
                            Review Today's Habits
                          </div>
                          <div className="text-xs text-gray-600 mb-3">
                            Tap below to open your habits panel and check things off.
                          </div>
                          <button
                            type="button"
                            className="text-sm px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 font-medium"
                            onClick={() => {
                              try {
                                (window as any).openHabitsPanel?.();
                              } catch (e) {
                                console.error("Failed to open habits panel from habit_review card", e);
                              }
                            }}
                          >
                            Open habits panel
                          </button>
                        </div>
                      );
                    }
                    if (type === 'optimization') {
                      return (
                        <OptimizationCard
                          proposal={payload}
                          threadId={threadId}
                          onApplied={async () => {
                            try {
                              if (threadId) {
                                await apiRequest(`/api/chat/threads/${threadId}/system-message`, {
                                  method: 'POST',
                                  body: JSON.stringify({ content: 'Optimization applied to My Focus.' })
                                } as any);
                                await Promise.all([
                                  apiRequest(`/api/chat/threads/${threadId}/messages`),
                                ]);
                              }
                            } catch {}
                          }}
                          onDiscard={() => {}}
                        />
                      );
                    }
                    if (type === 'insight') {
                      return (
                        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-3 sm:p-4 shadow-sm min-w-0 overflow-hidden">
                          <div className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Pattern Insight</div>
                          <div className="text-base sm:text-lg font-bold text-gray-900 mb-2 break-words">{payload.title}</div>
                          <div className="text-sm text-gray-700 mb-3 break-words">{payload.explanation}</div>
                          <div className="text-xs text-gray-500">Confidence: {payload.confidence}%</div>
                        </div>
                      );
                    }
                    if (type === 'habit_suggestion') {
                      return (
                        <div className="grid gap-2">
                          {(payload.habits || []).map((h: any, i: number) => (
                            <HabitCard key={i} habit={{ title: h.title, description: h.description }} onAdd={() => (window.location.href = '/habits')} />
                          ))}
                        </div>
                      );
                    }
                    if (type === 'prioritization') {
                      return (
                        <PrioritizationCard
                          messageId={m.id} // Unique ID for this message/card instance
                          items={payload.items || []}
                          onAccept={async () => {
                            try {
                              // The prioritization was already persisted by the tool
                              // We just need to invalidate the My Focus cache to show updated data
                              queryClient.invalidateQueries({ queryKey: ['/api/my-focus'] });
                              console.log('Priorities accepted - My Focus should update');
                            } catch (e) {
                              console.error('Failed to accept priorities', e);
                            }
                          }}
                          onReject={() => {
                            console.log('User declined the prioritization proposal');
                          }}
                        />
                      );
                    }
                    if (type === 'goal_habit_swap') {
                      // When habits are swapped/removed from a goal, invalidate My Focus cache
                      queryClient.invalidateQueries({ queryKey: ['/api/my-focus'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
                      return (
                        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3 sm:p-4 shadow-sm min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 text-emerald-700 mb-2">
                            <Check className="w-5 h-5" />
                            <span className="font-semibold">Habits Updated</span>
                          </div>
                          <div className="text-sm text-gray-900 font-semibold break-words">
                            {payload.goal_title || 'Goal'}
                          </div>
                          {payload.removed_habit_ids && payload.removed_habit_ids.length > 0 && (
                            <div className="text-xs text-gray-600 mt-2">
                              Removed {payload.removed_habit_ids.length} habit{payload.removed_habit_ids.length > 1 ? 's' : ''}
                            </div>
                          )}
                          {payload.added_habits && payload.added_habits.length > 0 && (
                            <div className="text-xs text-gray-600 mt-2">
                              Added {payload.added_habits.length} new habit{payload.added_habits.length > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Show optimistic user message if it exists, after historical messages */}
      {optimisticUserMessage && (
        <div className="flex justify-end">
          <div className="max-w-[95%] sm:max-w-[88%] md:max-w-[85%] w-full min-w-0 rounded-2xl px-3 sm:px-4 py-3 bg-teal-600 text-white rounded-br-md shadow-sm">
            <div className="text-xs opacity-70 mb-1">You • now</div>
            <div className="whitespace-pre-wrap break-words leading-relaxed">{optimisticUserMessage}</div>
          </div>
        </div>
      )}
      {optimisticUserMessage && console.log('[ConversationStream] Rendering optimistic message:', optimisticUserMessage)}

      {(isThinking || isStreaming) && (
        <div className="flex justify-start">
          <div className="max-w-[95%] sm:max-w-[88%] md:max-w-[85%] w-full min-w-0 rounded-2xl px-3 sm:px-4 py-3 bg-white border rounded-bl-md shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Coach • now</div>
            {isThinking ? (
              <div className="flex items-center gap-2 text-gray-600">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words leading-relaxed text-gray-800">{streamingText}</div>
            )}
            {streamingStructuredData && (
              <div className="mt-3">
                {streamingStructuredData.type === 'goal_suggestion' && (
                  <GoalSuggestionCard
                    threadId={threadId}
                    goal={streamingStructuredData.goal}
                    habits={streamingStructuredData.habits}
                  />
                )}
                {streamingStructuredData.type === 'habit_suggestion' && (
                  <div className="grid gap-2">
                    {(streamingStructuredData.habits || []).map((h: any, i: number) => (
                      <HabitCard key={h.id || i} habit={{ title: h.title, description: h.description }} onAdd={() => (window.location.href = '/habits')}/>
                    ))}
                  </div>
                )}
                {streamingStructuredData.type === 'prioritization' && (
                  <PrioritizationCard
                    messageId={`streaming_${Date.now()}`} // Temporary ID for streaming card
                    items={streamingStructuredData.items || []}
                    onAccept={async () => {
                      try {
                        // The prioritization was already persisted by the tool
                        // We just need to invalidate the My Focus cache to show updated data
                        queryClient.invalidateQueries({ queryKey: ['/api/my-focus'] });
                        console.log('Priorities accepted - My Focus should update');
                      } catch (e) {
                        console.error('Failed to accept priorities', e);
                      }
                    }}
                    onReject={() => {
                      console.log('User declined the prioritization proposal');
                    }}
                  />
                )}
                                  {streamingStructuredData.type === 'habit_review' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm min-w-0 overflow-hidden">
                    <div className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Review Today's Habits</div>
                    <div className="space-y-3">
                      <div className="text-xs text-gray-600 mb-1">
                        {(() => {
                          const list = Array.isArray(streamingStructuredData.habits) ? streamingStructuredData.habits : [];
                          const completed = list.filter((h: any, idx: number) => h.completed || recentlyCompleted[h.id || idx]).length;
                          return `(${completed}/${list.length}) habits completed today`;
                        })()}
                      </div>
                      {(streamingStructuredData.habits || []).map((habit: any, idx: number) => (
                        <button
                          key={habit.id || idx}
                          className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border ${
                            habit.completed || recentlyCompleted[habit.id || idx]
                              ? 'bg-teal-50 border-teal-200'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                          onClick={async () => {
                            try {
                              const id = habit.id;
                              if (!id) return;
                              const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                              const url = `${apiBaseUrl}/api/goals/habits/${id}/complete`;
                              const token = localStorage.getItem('token');
                              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                              if (token) headers['Authorization'] = `Bearer ${token}`;
                              await fetch(url, { method: 'POST', headers, body: JSON.stringify({ completedAt: new Date().toISOString() }) });
                              setRecentlyCompleted((s) => ({ ...s, [id]: true }));
                              // Refresh header counter
                              queryClient.invalidateQueries({ queryKey: ["/api/habits/today-completions"] });
                            } catch (e) {
                              console.error('Failed to mark habit complete', e);
                            }
                          }}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            habit.completed || recentlyCompleted[habit.id || idx] ? 'bg-teal-600' : 'bg-gray-200'
                          }`}>
                            {(habit.completed || recentlyCompleted[habit.id || idx]) && <Check className="w-4 h-4 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 break-words">{habit.title}</div>
                            {habit.description && <div className="text-sm text-gray-600 mt-0.5 break-words">{habit.description}</div>}
                            <div className="text-xs text-gray-500 mt-1 break-words">{habit.streak} day streak • {habit.points} point{habit.points !== 1 ? 's' : ''}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="text-sm px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 font-medium"
                        onClick={async () => {
                          const list = Array.isArray(streamingStructuredData.habits) ? streamingStructuredData.habits : [];
                          const completedCount = list.filter((h: any, idx: number) => h.completed || recentlyCompleted[h.id || idx]).length;
                          
                          // Auto-send message to agent
                          const completedHabits = list
                            .filter((h: any, idx: number) => h.completed || recentlyCompleted[h.id || idx])
                            .map((h: any) => h.title);
                          
                          const message = completedCount > 0 
                            ? `I completed ${completedCount} habit${completedCount !== 1 ? 's' : ''} today: ${completedHabits.join(', ')}`
                            : "I haven't completed any habits yet today";
                          
                          // Send message via composer
                          if ((window as any).sendMessage) {
                            (window as any).sendMessage(message);
                          }
                          
                          // Clear streaming data to prevent duplicate cards
                          setStreamingStructuredData(undefined);
                        }}
                      >
                        Mark Completed
                      </button>
                    </div>
                  </div>
                )}
                {streamingStructuredData.type === 'optimization' && (
                  <OptimizationCard
                    proposal={streamingStructuredData}
                    threadId={threadId}
                    onApplied={async () => {
                      try {
                        if (threadId) {
                          await apiRequest(`/api/chat/threads/${threadId}/system-message`, {
                            method: 'POST',
                            body: JSON.stringify({ content: 'Optimization applied to My Focus.' })
                          } as any);
                          // Refresh messages and clear transient streaming state
                          await Promise.all([
                            apiRequest(`/api/chat/threads/${threadId}/messages`),
                          ]);
                        }
                      } catch {}
                      setStreamingStructuredData(undefined);
                      setStreamingText("");
                    }}
                    onDiscard={() => {
                      setStreamingStructuredData(undefined);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-message cards rendered above; no separate latest-message renderer needed */}

      <div ref={bottomRef} />
    </div>
  );
}


