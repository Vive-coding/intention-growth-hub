import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

interface Props {
	currentThreadId?: string;
}

export default function ConversationsList({ currentThreadId }: Props) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [visibleCount, setVisibleCount] = useState(6);
  const { data: threads = [] } = useQuery({
    queryKey: ["/api/chat/threads"],
    queryFn: async () => apiRequest("/api/chat/threads"),
    staleTime: 5_000, // Reduced from 30_000 to refresh more frequently
  });

	return (
		<div>
			<div className="px-4 pt-4 pb-2 flex items-center justify-between">
				<div className="text-[11px] tracking-wide uppercase text-gray-500">Conversations</div>
                <button
                    className="p-1 rounded hover:bg-gray-100"
                    onClick={() => navigate('/chat?new=1')}
					aria-label="New conversation"
				>
					<Plus className="w-4 h-4 text-gray-700" />
				</button>
			</div>
			<div className="border-t" />
			<div className="overflow-auto py-2">
    {threads.slice(0, visibleCount).map((t: any) => {
					const active = t.id === currentThreadId;
					return (
						<div
							key={t.id}
							className={`group relative w-full text-left px-4 py-3 hover:bg-gray-50 ${active ? 'bg-teal-50' : ''}`}
						>
							<button className="w-full text-left" onClick={() => navigate(`/chat/${t.id}`)}>
								<div className="flex items-center gap-2">
									<MessageSquare className={`w-4 h-4 ${active ? 'text-teal-700' : 'text-gray-400'}`} />
									<div className={`text-sm font-medium truncate ${active ? 'text-teal-800' : 'text-gray-800'}`}>{t.title || 'Daily Coaching'}</div>
								</div>
								<div className="text-[11px] text-gray-500 mt-0.5">{new Date(t.createdAt || t.updatedAt || Date.now()).toLocaleDateString()}</div>
                </button>
                <button
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      if (!confirm('Delete this conversation? This cannot be undone.')) return;
                      await apiRequest(`/api/chat/threads/${t.id}`, { method: 'DELETE' });
                      // Immediately invalidate and refetch to update the UI
                      await queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
                      await queryClient.refetchQueries({ queryKey: ["/api/chat/threads"] });
                      // If we deleted the active thread, navigate immediately
                      if (currentThreadId === t.id) {
                        navigate('/chat');
                      }
                    } catch (err) {
                      console.error('Failed to delete thread', err);
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
						</div>
					);
				})}
          {threads.length > visibleCount && (
            <div className="px-4 py-2">
              <button
                className="text-sm text-teal-600 hover:text-teal-800"
                onClick={() => setVisibleCount((c) => c + 6)}
              >
                View more
              </button>
            </div>
          )}
			</div>
		</div>
	);
}
