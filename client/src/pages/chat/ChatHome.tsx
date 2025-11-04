import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConversationStream from "@/pages/chat/ConversationStream";
import SharedLeftNav from "@/components/layout/SharedLeftNav";
import Composer from "@/pages/chat/Composer";
import QuickActions from "@/pages/chat/QuickActions";
import SuggestionsPanel from "@/pages/chat/SuggestionsPanel";
import { OptimizeHabitsModal } from "@/components/OptimizeHabitsModal";
import CompleteHabitsModal from "@/pages/chat/CompleteHabitsModal";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { MessageSquare, Trash2 } from "lucide-react";
import ConversationsList from "@/components/chat/ConversationsList";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Home, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ChatHome() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/chat/:threadId");
  const [isNew] = useRoute("/chat");
  const threadId = match ? (params as any).threadId : undefined;
  const queryClient = useQueryClient();
  const autoCreateGuard = useRef(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showOptimize, setShowOptimize] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{threadId: string, title: string} | null>(null);
  const actionPendingRef = useRef(false);
  const { user } = useAuth();

  // Fetch threads for left-nav list (top 5-7)
  const { data: threads = [] } = useQuery({
    queryKey: ["/api/chat/threads"],
    queryFn: async () => apiRequest("/api/chat/threads"),
    staleTime: 30_000,
  });
  const activeThread = useMemo(() => threads.find((t: any) => t.id === threadId), [threads, threadId]);

  // Fetch today's habit completions for header counter
  const { data: todayCompletions } = useQuery({
    queryKey: ["/api/habits/today-completions"],
    queryFn: async () => {
      try {
        const resp = await apiRequest("/api/habits/today-completions");
        return resp || { completed: 0, total: 0 };
      } catch {
        return { completed: 0, total: 0 };
      }
    },
    staleTime: 0, // Always consider stale so it refetches
    refetchInterval: 10_000, // Refresh every 10s
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Default behavior: if no thread selected, show empty chat home (do not create a thread)
  useEffect(() => {
    if (threadId) return;
    // If URL has ?new=1 (initiated from +), stay blank even if threads exist
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined;
    const urlHasNew = !!urlParams && urlParams.get('new') === '1';
    if (urlHasNew) return;
    if (threads.length > 0) navigate(`/chat/${threads[0].id}`, { replace: true });
  }, [threadId, threads.length, navigate]);

  // If optimize=1 on blank state, auto-send optimize prompt to agent after mount
  useEffect(() => {
    if (threadId) return;
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined;
    if (!params) return;
    const optimize = params.get('optimize') === '1';
    const isNewChat = params.get('new') === '1';
    if (optimize && isNewChat) {
      (window as any).composeAndSend?.('Help me optimize and prioritize my focus.', 'prioritize_optimize');
    }
  }, [threadId]);

  // Defer creation; creation happens when sending first message
  const handleStartNew = async () => {
    navigate('/chat');
  };

  // Helper to send a quick action message and route to a special agent
  const sendAction = async (text: string, agent: 'review_progress' | 'suggest_goals' | 'prioritize_optimize' | 'surprise_me') => {
    if (actionPendingRef.current) return;
    if (!threadId) {
      // Blank state: let the composer lazily create the thread and send
      (window as any).composeAndSend?.(text, agent);
      return;
    }
    actionPendingRef.current = true;
    try {
      // For these actions, don't show the user message - let the agent initiate
      // Instead, send a simple trigger message that the agent will interpret
      const triggerMessage = agent === 'suggest_goals' ? 'Let\'s plan ahead' : 
                            agent === 'review_progress' ? 'Let\'s review my progress' :
                            agent === 'prioritize_optimize' ? 'Help me optimize my focus' :
                            'Surprise me with insights';
      
      // Show optimistic user message and thinking state just like Composer
      (window as any).chatStream?.addUserMessage?.(triggerMessage);
      (window as any).chatStream?.begin?.();
      console.log('[ChatHome] Sending action:', { triggerMessage, agent });
      await (window as any).sendServerStream({ threadId, content: triggerMessage, requestedAgentType: agent });
    } catch (e) {
      console.error('Quick action failed', e);
      (window as any).chatStream?.end?.();
    } finally {
      actionPendingRef.current = false;
    }
  };

  // Handle thread deletion
  const handleDeleteThread = async () => {
    if (!deleteConfirm) return;
    try {
      await apiRequest(`/api/chat/threads/${deleteConfirm.threadId}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
      if (threadId === deleteConfirm.threadId) {
        navigate("/chat");
      }
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-x-hidden">
      {/* Desktop left nav + conversations list */}
      <SharedLeftNav>
        <ConversationsList currentThreadId={threadId} />
      </SharedLeftNav>

      {/* Main chat column */}
      <main className="flex-1 flex flex-col">
        {/* Mobile header: hamburger + logo, sticky */}
        <div className="px-4 sm:px-6 py-3 border-b bg-white sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="lg:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <button aria-label="Open menu" className="w-9 h-9 rounded-lg border flex items-center justify-center text-gray-700 shrink-0">
                      <Menu className="w-5 h-5" />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-80">
                    <div className="flex flex-col h-full">
                      <div className="px-4 py-4 border-b">
                        <img src="/goodhabit.ai(200 x 40 px).png" alt="GoodHabit" className="h-6" />
                      </div>
                      <nav className="px-2 py-2 space-y-1 flex-1 overflow-y-auto">
                        <a href="/chat?new=1" className="flex items-center gap-3 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700">
                          <Home className="w-4 h-4 text-emerald-700" />
                          <span className="text-sm font-medium">Home</span>
                        </a>
                        <a href="/focus" className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50">
                          <Target className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium">My Focus</span>
                        </a>
                        <div className="mt-4 px-2">
                          <ConversationsList currentThreadId={threadId} />
                        </div>
                      </nav>
                      <div className="p-3 border-t">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50">
                              <div className="text-sm font-semibold text-gray-900">{(user as any)?.firstName || 'User'} {(user as any)?.lastName || ''}</div>
                              <div className="text-xs text-gray-500">{(user as any)?.email || ''}</div>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuItem onClick={() => window.location.assign('/profile')}>Your account</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('token'); window.location.reload(); }}>Log Out</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              {/* Chat title */}
              <div className="text-base md:text-lg font-semibold text-gray-800 truncate">
                {activeThread?.title || 'Daily Coaching'}
              </div>
              {/* Habits completed counter */}
              {todayCompletions && todayCompletions.total > 0 && (
                <div className="ml-2 px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium shrink-0">
                  {todayCompletions.completed}/{todayCompletions.total} ✓
                </div>
              )}
            </div>
            {/* Mobile profile icon */}
            <div className="lg:hidden shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-9 h-9 rounded-full border-2 border-black bg-white flex items-center justify-center text-xs font-bold">
                    {`${((user as any)?.firstName?.[0] || 'U').toUpperCase()}${((user as any)?.lastName?.[0] || '').toUpperCase()}`}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2">
                    <div className="text-sm font-semibold">{(user as any)?.firstName || ''} {(user as any)?.lastName || ''}</div>
                    <div className="text-xs text-gray-500">{(user as any)?.email}</div>
                  </div>
                  <DropdownMenuItem onClick={() => window.location.assign('/profile')}>Your account</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('token'); window.location.reload(); }}>Log Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto overflow-x-hidden">
          {threadId ? (
            <ConversationStream threadId={threadId} />
          ) : (
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-16 overflow-x-hidden">
              <div className="text-center text-gray-600 mb-6">Start a conversation with your coach</div>
              {/* New chat: show full agent buttons directly */}
              <div className="mb-3">
                <QuickActions
                  mode="full"
                  onReviewHabits={() => sendAction('Review progress', 'review_progress')}
                  onViewSuggestions={() => sendAction('Plan ahead', 'suggest_goals')}
                  onOptimize={() => sendAction('Optimize focus', 'prioritize_optimize')}
                  onSurpriseMe={() => sendAction('Surprise me', 'surprise_me')}
                />
              </div>
              <div className="border-2 border-transparent bg-gradient-to-r from-purple-500 to-blue-500 p-[2px] rounded-2xl">
                <div className="bg-white rounded-2xl p-4">
                  <Composer threadId={undefined as any} />
                </div>
              </div>
            </div>
          )}
        </div>

        {threadId && (
        <div className="border-t bg-white px-4 py-3 sticky bottom-0">
          {/* Desktop: full actions above composer */}
          <div className="hidden lg:block mb-2">
            <QuickActions
              mode="full"
              onReviewHabits={() => sendAction('Review progress', 'review_progress')}
              onViewSuggestions={() => sendAction('Plan ahead', 'suggest_goals')}
              onOptimize={() => sendAction('Optimize focus', 'prioritize_optimize')}
              onSurpriseMe={() => sendAction('Surprise me', 'surprise_me')}
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile: show "+" next to composer */}
            <div className="lg:hidden">
              <QuickActions
                mode="plus"
                onReviewHabits={() => sendAction('Let me review my habits and progress.', 'review_progress')}
                onViewSuggestions={() => sendAction('Please suggest some goals based on our conversation so far.', 'suggest_goals')}
                onOptimize={() => sendAction('Help me optimize and prioritize my focus.', 'prioritize_optimize')}
                onSurpriseMe={() => sendAction('Surprise me with some insights about myself.', 'surprise_me')}
              />
            </div>
            <div className="flex-1">
              <Composer threadId={threadId} />
            </div>
          </div>
        </div>
        )}
      </main>

      <SuggestionsPanel open={showSuggestions} onClose={() => setShowSuggestions(false)} />
      <OptimizeHabitsModal
        open={showOptimize}
        onClose={() => setShowOptimize(false)}
        onSuccess={async () => {
          setShowOptimize(false);
          // Refresh relevant data post-optimization if needed later
        }}
      />
      <CompleteHabitsModal open={showComplete} onClose={() => setShowComplete(false)} />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteThread}
        title="Delete Conversation"
        description={`Are you sure you want to delete "${deleteConfirm?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}


