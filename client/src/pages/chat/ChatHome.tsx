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
import { MessageSquare } from "lucide-react";

export default function ChatHome() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/chat/:threadId");
  const threadId = match ? (params as any).threadId : undefined;
  const queryClient = useQueryClient();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showOptimize, setShowOptimize] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  // Fetch threads for left-nav list (top 5-7)
  const { data: threads = [] } = useQuery({
    queryKey: ["/api/chat/threads"],
    queryFn: async () => apiRequest("/api/chat/threads"),
    staleTime: 30_000,
  });

  // Auto-select latest thread if none provided
  useEffect(() => {
    // When a new thread is created, select it
    if (!threadId && threads.length > 0) {
      navigate(`/chat/${threads[0].id}`, { replace: true });
    }
  }, [threadId, threads, navigate]);

  // Create new thread when user clicks Home or + (simple handler)
  const handleStartNew = async () => {
    const t = await apiRequest("/api/chat/threads", { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
    // Some backends return {threadId}; normalize
    const newId = (t.id || t.threadId) as string;
    navigate(`/chat/${newId}`);
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
              <button
                key={t.id}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${active ? "bg-teal-50" : ""}`}
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
            );
          })}
        </div>
      </aside>

      {/* Main chat column */}
      <main className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b bg-white">
          <div className="text-base md:text-lg font-semibold text-gray-800">Daily Coaching</div>
        </div>

        <div className="flex-1 overflow-auto">
          <ConversationStream threadId={threadId} />
        </div>

        <div className="border-t bg-white px-4 py-3">
          <div className="mb-2">
            <QuickActions
              onReviewHabits={() => setShowComplete(true)}
              onViewSuggestions={() => setShowSuggestions(true)}
              onOptimize={() => setShowOptimize(true)}
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
    </div>
  );
}


