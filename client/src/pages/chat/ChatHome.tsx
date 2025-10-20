import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConversationStream from "@/pages/chat/ConversationStream";
import Composer from "@/pages/chat/Composer";
import QuickActions from "@/pages/chat/QuickActions";
import SuggestionsPanel from "@/pages/chat/SuggestionsPanel";
import { OptimizeHabitsModal } from "@/components/OptimizeHabitsModal";
import CompleteHabitsModal from "@/pages/chat/CompleteHabitsModal";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { MessageSquare, Trash2 } from "lucide-react";

export default function ChatHome() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/chat/:threadId");
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

  // Ensure a valid thread is present: select latest or create one
  useEffect(() => {
    if (threadId) return;
    if (threads.length > 0) {
      navigate(`/chat/${threads[0].id}`, { replace: true });
      return;
    }
    // No threads yet – create the first one once
    if (!autoCreateGuard.current) {
      autoCreateGuard.current = true;
      (async () => {
        try {
          const t = await apiRequest("/api/chat/threads", { method: "POST" });
          await queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
          const newId = (t.id || t.threadId) as string;
          navigate(`/chat/${newId}`, { replace: true });
        } catch (e) {
          console.error("Failed to auto-create chat thread", e);
        }
      })();
    }
  }, [threadId, threads, navigate, queryClient]);

  // Create new thread when user clicks Home or + (simple handler)
  const handleStartNew = async () => {
    const t = await apiRequest("/api/chat/threads", { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
    // Some backends return {threadId}; normalize
    const newId = (t.id || t.threadId) as string;
    navigate(`/chat/${newId}`);
  };

  // Helper to send a quick action message and route to a special agent
  const sendAction = async (text: string, agent: 'review_progress' | 'suggest_goals' | 'prioritize_optimize' | 'surprise_me') => {
    if (!threadId || actionPendingRef.current) return;
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
      {/* Left conversations list */}
      <aside className="w-72 border-r bg-white hidden md:flex flex-col">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="text-[11px] tracking-wide uppercase text-gray-500">Conversations</div>
          <button className="text-sm text-teal-600" onClick={handleStartNew}>+ New</button>
        </div>
        <div className="border-t" />
        <div className="overflow-auto py-2">
          {threads.slice(0, 7).map((t: any) => {
            const active = t.id === threadId;
            return (
              <div
                key={t.id}
                className={`group relative w-full text-left px-4 py-3 hover:bg-gray-50 ${active ? "bg-teal-50" : ""}`}
              >
                <button
                  className="w-full text-left"
                  onClick={() => navigate(`/chat/${t.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className={`w-4 h-4 ${active ? "text-teal-700" : "text-gray-400"}`} />
                    <div className={`text-sm font-medium truncate ${active ? "text-teal-800" : "text-gray-800"}`}>{t.title || "Daily Coaching"}</div>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {(() => {
                      const d = new Date(t.createdAt || t.updatedAt || Date.now());
                      return d.toLocaleDateString();
                    })()}
                  </div>
                </button>
                <button
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm({
                      threadId: t.id,
                      title: t.title || "Daily Coaching"
                    });
                  }}
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main chat column */}
      <main className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="text-base md:text-lg font-semibold text-gray-800">Daily Coaching</div>
            <button
              onClick={async () => {
                try {
                  const res = await apiRequest('/api/chat/threads/test-cards', { method: 'POST' });
                  if (res?.threadId) {
                    navigate(`/chat/${res.threadId}`);
                  }
                } catch (e) {
                  console.error('Failed to create test cards thread', e);
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Create test cards thread
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <ConversationStream threadId={threadId} />
        </div>

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


