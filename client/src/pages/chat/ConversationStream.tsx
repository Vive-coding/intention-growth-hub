import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [cta, setCta] = useState<string | undefined>(undefined);
  const [streamingStructuredData, setStreamingStructuredData] = useState<any | undefined>(undefined);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<string | undefined>(undefined);
  const [, navigate] = useLocation();
  const [recentlyCompleted, setRecentlyCompleted] = useState<Record<string, boolean>>({});

  // Fetch messages for the thread
  const { data: messages = [] } = useQuery({
    queryKey: ["/api/chat/threads", threadId, "messages"],
    enabled: !!threadId,
    queryFn: async () => {
      if (!threadId) return [];
      return apiRequest(`/api/chat/threads/${threadId}/messages`);
    },
    staleTime: 5_000,
  });

  // Clear optimistic message when we get fresh messages
  useEffect(() => {
    if (messages.length > 0) {
      setOptimisticUserMessage(undefined);
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, optimisticUserMessage, isThinking]);

  // Expose a tiny API for Composer to start/stop streaming
  // We keep this local for Phase 3.1; later can lift to context if needed
  (window as any).chatStream = {
    addUserMessage: (message: string) => {
      console.log('[ConversationStream] Setting optimistic message:', message);
      setOptimisticUserMessage(message);
      console.log('[ConversationStream] Optimistic message state set to:', message);
    },
    begin: () => {
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
                      return (
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                          <div className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Review Today's Habits</div>
                          <div className="space-y-3">
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
                                  {habit.description && <div className="text-sm text-gray-600">{habit.description}</div>}
                                  <div className="text-xs text-gray-500 mt-1">{habit.streak} day streak • {habit.points} point{habit.points !== 1 ? 's' : ''}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="mt-3">
                            <button
                              className="text-sm px-3 py-1.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                              onClick={() => {
                                if (!threadId) return;
                                // Tell the master agent to continue the conversation after marking completions
                                (window as any).chatStream?.begin?.();
                                (window as any).sendServerStream?.({ threadId, content: 'I have marked today\'s completed habits.', requestedAgentType: 'master' });
                              }}
                            >
                              Mark complete
                            </button>
                          </div>
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
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 shadow-sm">
                          <div className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Optimization Suggestions</div>
                          <div className="text-sm text-gray-700 mb-4">{payload.summary}</div>
                          <div className="space-y-2">
                            {(payload.recommendations || []).map((rec: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 p-2 bg-white rounded-lg">
                                <div className={`w-2 h-2 rounded-full mt-2 ${rec.type === 'archive' ? 'bg-red-500' : rec.type === 'modify' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                                <div>
                                  <div className="font-medium text-gray-900">{rec.title}</div>
                                  <div className="text-sm text-gray-600">{rec.description}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
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
                          items={payload.items || []}
                          onOpenReview={() => (window.location.href = '/habits')}
                          onLog={async (habitId: string) => {
                            try {
                              const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                              const url = `${apiBaseUrl}/api/goals/habits/${habitId}/complete`;
                              const token = localStorage.getItem('token');
                              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                              if (token) headers['Authorization'] = `Bearer ${token}`;
                              await fetch(url, { method: 'POST', headers, body: JSON.stringify({ completedAt: new Date().toISOString() }) });
                            } catch (e) {
                              console.error('Failed to log habit from card', e);
                            }
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
                    items={streamingStructuredData.items || []}
                    onOpenReview={() => (window.location.href = '/habits')}
                    onLog={async (habitId: string) => {
                      try {
                        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                        const url = `${apiBaseUrl}/api/goals/habits/${habitId}/complete`;
                        const token = localStorage.getItem('token');
                        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                        if (token) headers['Authorization'] = `Bearer ${token}`;
                        await fetch(url, { method: 'POST', headers, body: JSON.stringify({ completedAt: new Date().toISOString() }) });
                      } catch (e) {
                        console.error('Failed to log habit from card', e);
                      }
                    }}
                  />
                )}
                {streamingStructuredData.type === 'optimization' && (
                  <OptimizationCard summary={streamingStructuredData.summary} onOpenOptimize={() => (window.location.href = '/habits')} />
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


