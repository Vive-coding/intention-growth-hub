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

  // Fetch threads for left-nav list (top 5-7)
  const { data: threads = [] } = useQuery({
    queryKey: ["/api/chat/threads"],
    queryFn: async () => apiRequest("/api/chat/threads"),
    staleTime: 30_000,
  });

  // Default behavior: if no thread selected, show empty chat home (do not create a thread)
  useEffect(() => {
    if (threadId) return;
    // If URL has ?new=1 (initiated from +), stay blank even if threads exist
    const urlHasNew = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1';
    if (urlHasNew) return;
    if (threads.length > 0) navigate(`/chat/${threads[0].id}`, { replace: true });
  }, [threadId, threads, navigate]);

  // Defer creation; creation happens when sending first message
  const handleStartNew = async () => {
    navigate('/chat');
  };

  // Helper to send a quick action message and route to a special agent
  const sendAction = async (text: string, agent: 'review_progress' | 'suggest_goals' | 'prioritize_optimize' | 'surprise_me') => {
    if (actionPendingRef.current) return;
    if (!threadId) {
      // Blank state: let the composer lazily create the thread and send
      (window as any).composeAndSend?.(text);
      return;
    }
    actionPendingRef.current = true;
    try {
      // Show optimistic user message and thinking state just like Composer
      (window as any).chatStream?.addUserMessage?.(text);
      (window as any).chatStream?.begin?.();
      await (window as any).sendServerStream({ threadId, content: text, requestedAgentType: agent });
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
      
      // If we're currently viewing the deleted thread, navigate to a new one
      if (threadId === deleteConfirm.threadId) {
        navigate("/chat");
      }
      
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Shared left nav + conversations list */}
      <SharedLeftNav>
        <ConversationsList currentThreadId={threadId} />
      </SharedLeftNav>

      {/* Main chat column */}
      <main className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="text-base md:text-lg font-semibold text-gray-800">
              {(() => {
                if (!threadId) return 'Daily Coaching';
                const active = (threads as any[]).find((t: any) => t.id === threadId);
                return active?.title || 'Daily Coaching';
              })()}
            </div>
            {/* Removed top-right New Chat; use + within Conversations header */}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {threadId ? (
            <ConversationStream threadId={threadId} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-16">
              <div className="text-center text-gray-600 mb-6">Start a conversation with your coach</div>
              <div className="mb-3">
                <QuickActions
                  onReviewHabits={() => sendAction('Let me review my habits and progress.', 'review_progress')}
                  onViewSuggestions={() => sendAction('Please suggest some goals based on our conversation so far.', 'suggest_goals')}
                  onOptimize={() => sendAction('Help me optimize and prioritize my focus.', 'prioritize_optimize')}
                  onSurpriseMe={() => sendAction('Surprise me with some insights about myself.', 'surprise_me')}
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
        <div className="border-t bg-white px-4 py-3">
          <div className="mb-2">
            <QuickActions
              onReviewHabits={() => sendAction('Let me review my habits and progress.', 'review_progress')}
              onViewSuggestions={() => sendAction('Please suggest some goals based on our conversation so far.', 'suggest_goals')}
              onOptimize={() => sendAction('Help me optimize and prioritize my focus.', 'prioritize_optimize')}
              onSurpriseMe={() => sendAction('Surprise me with some insights about myself.', 'surprise_me')}
            />
          </div>
          <Composer threadId={threadId} />
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


