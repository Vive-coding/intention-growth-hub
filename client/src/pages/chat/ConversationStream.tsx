import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Props {
  threadId?: string;
}

export default function ConversationStream({ threadId }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [cta, setCta] = useState<string | undefined>(undefined);
  const [, navigate] = useLocation();

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Expose a tiny API for Composer to start/stop streaming
  // We keep this local for Phase 3.1; later can lift to context if needed
  (window as any).chatStream = {
    begin: () => {
      setStreamingText("");
      setIsStreaming(true);
      setCta(undefined);
    },
    append: (token: string) => setStreamingText((s) => s + token),
    end: () => setIsStreaming(false),
    cta: (label: string) => setCta(label),
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {messages.map((m: any) => (
        <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${m.role === 'user' ? 'bg-teal-600 text-white rounded-br-md' : 'bg-white text-gray-800 border rounded-bl-md'}`}>
            <div className="text-xs opacity-70 mb-1">{m.role === 'user' ? 'You' : 'Coach'} • {new Date(m.createdAt).toLocaleString()}</div>
            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
          </div>
        </div>
      ))}

      {isStreaming && (
        <div className="flex justify-start">
          <div className="max-w-[88%] rounded-2xl px-4 py-3 bg-white border rounded-bl-md shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Coach • now</div>
            <div className="whitespace-pre-wrap leading-relaxed text-gray-800">{streamingText}<span className="ml-1 inline-block animate-pulse">▍</span></div>
          </div>
        </div>
      )}

      {/* Intentionally no inline CTA bubble chips; footer quick actions provide entry points */}

      <div ref={bottomRef} />
    </div>
  );
}


