import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Check } from "lucide-react";
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
      navigate('/chat', { replace: true });
    }
  }, [messagesError, threadId, navigate]);

  // Clear optimistic message when we get fresh messages, but only if we're not currently streaming
  useEffect(() => {
    if (messages.length > 0 && !isStreaming && !isThinking) {
      setOptimisticUserMessage(undefined);
    }
  }, [messages, isStreaming, isThinking]);

  // Note: We navigate away on explicit 404 via onError above to avoid loops

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, optimisticUserMessage, isThinking]);

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
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
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
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${m.role === 'user' ? 'bg-teal-600 text-white rounded-br-md' : 'bg-white text-gray-800 border rounded-bl-md'}`}>
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
                  <div className="whitespace-pre-wrap leading-relaxed">{pre}</div>
                </div>
              </div>
            )}

            {isAssistant && payload && (
              <div className="flex justify-start">
                <div className="max-w-[88%] w-full">
                  {(() => {
                    const type = String(payload.type || '').toLowerCase();
                    if (type === 'goal_suggestion') {
                      return (
                        <GoalSuggestionCard
                          goal={payload.goal}
                          habits={payload.habits}
                          onAccept={() => (window.location.href = '/goals')}
                          onView={() => (window.location.href = '/goals')}
                        />
                      );
                    }
                    if (type === 'goal_suggestions') {
                      return (
                        <div className="grid gap-4">
                          {(payload.items || []).map((item: any, idx: number) => (
                            <GoalSuggestionCard
                              key={idx}
                              goal={item.goal}
                              habits={item.habits}
                              onAccept={() => (window.location.href = '/goals')}
                              onView={() => (window.location.href = '/goals')}
                            />
                          ))}
                        </div>
                      );
                    }
                    if (type === 'habit_review') {
                      const cardId = `habit_review_${m.id}`;
                      const isSubmitted = habitCardSubmitted[cardId];
                      
                      return (
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                          <div className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Review Today's Habits</div>
                          {!isSubmitted ? (
                            <>
                              <div className="space-y-3">
                                <div className="text-xs text-gray-600 mb-1">
                                  {(() => {
                                    const list = Array.isArray(payload.habits) ? payload.habits : [];
                                    const completed = list.filter((h: any, idx: number) => h.completed || recentlyCompleted[h.id || idx]).length;
                                    return `(${completed}/${list.length}) habits completed today`;
                                  })()}
                                </div>
                                {(payload.habits || []).map((habit: any, idx: number) => (
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
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{habit.title}</div>
                                      {habit.description && <div className="text-sm text-gray-600 mt-0.5">{habit.description}</div>}
                                      <div className="text-xs text-gray-500 mt-1">{habit.streak} day streak • {habit.points} point{habit.points !== 1 ? 's' : ''}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                              <div className="mt-3 flex gap-2">
                                <button
                                  className="text-sm px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 font-medium"
                                  onClick={async () => {
                                    const list = Array.isArray(payload.habits) ? payload.habits : [];
                                    const completedCount = list.filter((h: any, idx: number) => h.completed || recentlyCompleted[h.id || idx]).length;
                                    
                                    // Mark as submitted
                                    setHabitCardSubmitted((s) => ({ ...s, [cardId]: true }));
                                    
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
                                  }}
                                >
                                  Mark Completed
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 text-teal-700 py-2">
                              <Check className="w-5 h-5" />
                              <span className="font-medium">
                                ✅ Added {(() => {
                                  const list = Array.isArray(payload.habits) ? payload.habits : [];
                                  return list.filter((h: any, idx: number) => h.completed || recentlyCompleted[h.id || idx]).length;
                                })()} habit{(() => {
                                  const list = Array.isArray(payload.habits) ? payload.habits : [];
                                  const count = list.filter((h: any, idx: number) => h.completed || recentlyCompleted[h.id || idx]).length;
                                  return count !== 1 ? 's' : '';
                                })()}
                              </span>
                            </div>
                          )}
                          {Array.isArray(payload.goalsProgressed) && payload.goalsProgressed.length > 0 && (
                            <div className="mt-4 border-t pt-3">
                              <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Goals progressed today</div>
                              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                {payload.goalsProgressed.map((g: any) => (
                                  <li key={g.id}>{g.title}</li>
                                ))}
                              </ul>
                            </div>
                          )}
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
                        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4 shadow-sm">
                          <div className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Pattern Insight</div>
                          <div className="text-lg font-bold text-gray-900 mb-2">{payload.title}</div>
                          <div className="text-sm text-gray-700 mb-3">{payload.explanation}</div>
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
          <div className="max-w-[88%] rounded-2xl px-4 py-3 bg-teal-600 text-white rounded-br-md shadow-sm">
            <div className="text-xs opacity-70 mb-1">You • now</div>
            <div className="whitespace-pre-wrap leading-relaxed">{optimisticUserMessage}</div>
          </div>
        </div>
      )}
      {optimisticUserMessage && console.log('[ConversationStream] Rendering optimistic message:', optimisticUserMessage)}

      {(isThinking || isStreaming) && (
        <div className="flex justify-start">
          <div className="max-w-[88%] rounded-2xl px-4 py-3 bg-white border rounded-bl-md shadow-sm">
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
              <div className="whitespace-pre-wrap leading-relaxed text-gray-800">{streamingText}</div>
            )}
            {streamingStructuredData && (
              <div className="mt-3">
                {streamingStructuredData.type === 'goal_suggestion' && (
                  <GoalSuggestionCard goal={streamingStructuredData.goal} habits={streamingStructuredData.habits}
                    onAccept={() => (window.location.href = '/goals')}
                    onView={() => (window.location.href = '/goals')}
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
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{habit.title}</div>
                            {habit.description && <div className="text-sm text-gray-600 mt-0.5">{habit.description}</div>}
                            <div className="text-xs text-gray-500 mt-1">{habit.streak} day streak • {habit.points} point{habit.points !== 1 ? 's' : ''}</div>
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


