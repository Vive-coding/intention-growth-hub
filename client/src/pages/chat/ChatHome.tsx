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
import { MessageSquare, Trash2, MoreVertical } from "lucide-react";
import ConversationsList from "@/components/chat/ConversationsList";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Home, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NotificationSetupModal } from "@/components/NotificationSetupModal";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { HabitsSidePanel } from "@/components/chat/HabitsSidePanel";

export default function ChatHome() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/:threadId");
  const [isNew] = useRoute("/");
  const threadId = match ? (params as any).threadId : undefined;
  const queryClient = useQueryClient();
  const autoCreateGuard = useRef(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showOptimize, setShowOptimize] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{threadId: string, title: string} | null>(null);
  const actionPendingRef = useRef(false);
  const welcomeTriggeredRef = useRef(false);
  const [welcomePoll, setWelcomePoll] = useState(0);
  const hasShownNotificationModal = useRef(false);
  const [showNotificationSetup, setShowNotificationSetup] = useState(false);
  const [showHabitsPanel, setShowHabitsPanel] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const followupHandledRef = useRef(false);
  const { user, isLoading, isAuthenticated } = useAuth();

  // Expose a global helper so agent cards can open the habits panel
  useEffect(() => {
    (window as any).openHabitsPanel = () => setShowHabitsPanel(true);
    return () => {
      if ((window as any).openHabitsPanel === setShowHabitsPanel) {
        (window as any).openHabitsPanel = undefined;
      }
    };
  }, []);

  const handleReturnToOnboarding = () => {
    localStorage.setItem("onboardingCompleted", "false");
    localStorage.removeItem("bypassOnboarding");
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    window.location.assign("/journal");
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.reload();
  };

  // NOTE: We previously tried to manually track viewport height for mobile browsers
  // using visualViewport, but this caused large white areas while typing.
  // We now rely on standard flex + min-h-screen layout and let the browser manage height.

  // Redirect to landing if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/landing", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Fetch threads for left-nav list (top 5-7)
  const { data: threads = [] } = useQuery({
    queryKey: ["/api/chat/threads"],
    queryFn: async () => apiRequest("/api/chat/threads"),
    staleTime: 30_000,
    enabled: !isLoading && isAuthenticated,
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
    enabled: !isLoading && isAuthenticated,
  });

  // Default behavior: if no thread selected, show empty chat home (do not create a thread)
  useEffect(() => {
    if (threadId) return;
    // If URL has ?new=1 (initiated from +), stay blank even if threads exist
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined;
    const urlHasNew = !!urlParams && urlParams.get('new') === '1';
    if (urlHasNew) return;
    if (threads.length > 0) navigate(`/${threads[0].id}`, { replace: true });
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
    navigate('/');
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
      // Force immediate refetch to remove deleted thread from list
      await queryClient.refetchQueries({ queryKey: ["/api/chat/threads"] });
      // Also remove message cache for this thread
      queryClient.removeQueries({ queryKey: ["/api/chat/threads", deleteConfirm.threadId, "messages"] });
      if (threadId === deleteConfirm.threadId) {
        navigate("/");
      }
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  };

  useEffect(() => {
    if (!user) return;

    if (user.onboardingStep === "ready_for_notifications" && !hasShownNotificationModal.current) {
      hasShownNotificationModal.current = true;
      const timer = setTimeout(() => setShowNotificationSetup(true), 1200);
      return () => clearTimeout(timer);
    }

    if (user.onboardingStep === "completed") {
      setShowNotificationSetup(false);
    }
  }, [user?.onboardingStep]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!threadId) return;

    const params = new URLSearchParams(window.location.search);
    const pendingThread = sessionStorage.getItem("pendingWelcomeThread");
    const shouldWelcome = params.get("welcome") === "1" || (pendingThread && pendingThread === threadId);

    if (!shouldWelcome || welcomeTriggeredRef.current) {
      return;
    }

    const sendFn = (window as any).sendServerStream;
    const stream = (window as any).chatStream;

    if (typeof sendFn !== "function" || !stream) {
      const timer = setTimeout(() => setWelcomePoll((n) => n + 1), 150);
      return () => clearTimeout(timer);
    }

    welcomeTriggeredRef.current = true;
    stream.begin?.();

    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    sendFn({
      threadId,
      content: "I'm ready to begin our first coaching conversation.",
      requestedAgentType: "onboarding_welcome",
    })
      .then(() => {
        sessionStorage.removeItem("pendingWelcomeThread");
        if (params.get("welcome") === "1") {
          params.delete("welcome");
          const nextQuery = params.toString();
          navigate(nextQuery ? `/${threadId}?${nextQuery}` : `/${threadId}`);
        }
      })
      .catch((error: any) => {
        console.error("[ChatHome] Failed to trigger onboarding welcome message", error);
        welcomeTriggeredRef.current = false;
        retryTimer = setTimeout(() => setWelcomePoll((n) => n + 1), 300);
      });

    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [threadId, navigate, welcomePoll]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (followupHandledRef.current) return;
    if (isLoading || !isAuthenticated) return;

    const params = new URLSearchParams(window.location.search);
    const followupToken = params.get("followup");
    if (!followupToken) return;

    followupHandledRef.current = true;

    const redeem = async () => {
      try {
        const result = await apiRequest("/api/chat/followups/redeem", {
          method: "POST",
          body: JSON.stringify({ token: followupToken }),
        });

        if (result?.prefill) {
          (window as any).chatComposer?.setDraft?.(result.prefill);
          (window as any).chatComposer?.focus?.();
        }

        if (result?.threadId) {
          await queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
          navigate(`/${result.threadId}`, { replace: true });
        }
      } catch (error) {
        console.error("[ChatHome] Follow-up redemption failed", error);
        if (typeof window !== "undefined" && typeof window.alert === "function") {
          window.alert("We couldn't open that coach check-in link. It may have expired.");
        }
      } finally {
        params.delete("followup");
        const next = params.toString();
        const basePath = window.location.pathname.split("?")[0];
        const nextUrl = next ? `${basePath}?${next}` : basePath;
        window.history.replaceState({}, "", nextUrl);
      }
    };

    redeem();
  }, [isLoading, isAuthenticated, navigate, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const showModeToggle = !threadId;

  const currentTime = new Date().getHours();
  const greeting =
    currentTime < 12 ? "Good morning" : currentTime < 18 ? "Good afternoon" : "Good evening";
  const userName =
    (user as any)?.firstName ||
    ((user as any)?.email?.split("@")[0] as string | undefined) ||
    "there";

  return (
    <>
      <NotificationSetupModal
        open={showNotificationSetup}
        onClose={() => setShowNotificationSetup(false)}
        onSaved={async () => {
          setShowNotificationSetup(false);
          await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        }}
      />

      <div
        className="flex bg-gradient-to-br from-green-50 via-white to-blue-50 overflow-hidden"
        style={{ height: "100dvh" }}
      >
      {/* Desktop left nav + conversations list */}
      <SharedLeftNav
        onReturnToOnboarding={handleReturnToOnboarding}
        onLogout={handleLogout}
      >
        <ConversationsList currentThreadId={threadId} />
      </SharedLeftNav>

      {/* Main chat column */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top header: hamburger + mode toggle + habit pill (no bottom border for seamless surface) */}
        <div className="px-3 sm:px-4 py-3 bg-gradient-to-br from-green-50 via-white to-blue-50 z-30 overflow-x-hidden shrink-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="lg:hidden">
                <Sheet open={showMobileNav} onOpenChange={setShowMobileNav}>
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
                        <a href="/?new=1" className="flex items-center gap-3 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700" onClick={() => setShowMobileNav(false)}>
                          <Home className="w-4 h-4 text-emerald-700" />
                          <span className="text-sm font-medium">Home</span>
                        </a>
                        <a href="/focus" className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50" onClick={() => setShowMobileNav(false)}>
                          <Target className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium">My Focus</span>
                        </a>
                        <div className="mt-4 px-2">
                          <ConversationsList currentThreadId={threadId} onThreadClick={() => setShowMobileNav(false)} />
                        </div>
                      </nav>
                      <div className="p-3 border-t">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                              <div className="w-10 h-10 rounded-full border-2 border-black bg-white flex items-center justify-center text-sm font-bold shrink-0">
                                {`${((user as any)?.firstName?.[0] || 'U').toUpperCase()}${((user as any)?.lastName?.[0] || '').toUpperCase()}`}
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">{(user as any)?.firstName || 'User'} {(user as any)?.lastName || ''}</div>
                                <div className="text-xs text-gray-500 truncate">{(user as any)?.email || ''}</div>
                              </div>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuItem onClick={() => window.location.assign('/profile')}>Your account</DropdownMenuItem>
                            <DropdownMenuItem onClick={handleReturnToOnboarding}>Return to Onboarding</DropdownMenuItem>
                            <DropdownMenuItem onClick={handleLogout}>Log Out</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              {/* Chat title (thread title only; no generic page title) */}
              <div className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 truncate min-w-0">
                {activeThread?.title ?? ""}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0 pr-1 sm:pr-2">
              {showModeToggle && (
                <ModeToggle className="hidden md:flex shrink-0" />
              )}
              {todayCompletions && todayCompletions.total > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHabitsPanel(true)}
                  className="px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium shrink-0 hover:bg-teal-200 transition-colors"
                >
                  {todayCompletions.completed}/{todayCompletions.total} ✓
                </button>
              )}
              {/* Mobile: More menu with new conversation and delete */}
              {threadId && activeThread && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                      aria-label="More options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => { navigate('/?new=1'); setShowMobileNav(false); }}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      New conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {/* Desktop: Simple delete button */}
              {threadId && activeThread && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ threadId, title: activeThread.title || 'Daily Coaching' })}
                  className="hidden lg:flex p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  title="Delete conversation"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Mobile toggle */}
            {showModeToggle && (
              <div className="lg:hidden shrink-0 flex items-center">
                <ModeToggle className="md:hidden flex" />
              </div>
            )}
          </div>
        </div>

        <div
          data-chat-scroll-container="true"
          className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
        >
          {threadId ? (
            <ConversationStream threadId={threadId} />
          ) : (
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-10 overflow-x-hidden">
              <div className="mb-6 text-left">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
                  {greeting}, {userName}
                </h1>
                <p className="text-sm lg:text-base text-gray-600">
                  Start a conversation with your coach.
                </p>
              </div>
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
        <div className="border-t bg-white px-3 sm:px-4 py-3 shrink-0 overflow-x-hidden">
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
                onDelete={threadId && activeThread ? () => setDeleteConfirm({ threadId, title: activeThread.title || 'Daily Coaching' }) : undefined}
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
      <HabitsSidePanel
        open={showHabitsPanel}
        onOpenChange={setShowHabitsPanel}
        todaySummary={
          todayCompletions
            ? { completed: todayCompletions.completed, total: todayCompletions.total }
            : undefined
        }
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
    </>
  );
}


