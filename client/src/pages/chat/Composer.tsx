import { useCallback, useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface Props {
  threadId?: string;
}

export default function Composer({ threadId }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const pendingAgentTypeRef = useRef<string | undefined>(undefined);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [text]);

  // Shared streaming sender for buttons and Composer
  (window as any).sendServerStream = async (opts: { threadId: string; content: string; requestedAgentType?: string }) => {
    const { threadId: tid, content, requestedAgentType } = opts;
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const url = `${apiBaseUrl}/api/chat/respond`;

    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ threadId: tid, content, requestedAgentType }),
    });

    if (!resp.body) throw new Error('No response body');
    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;
        const json = line.slice(5).trim();
        try {
          const evt = JSON.parse(json);
          if (evt.type === 'delta' && typeof evt.content === 'string') {
            (window as any).chatStream?.append?.(evt.content);
          } else if (evt.type === 'cta' && typeof evt.label === 'string') {
            (window as any).chatStream?.cta?.(evt.label);
          } else if (evt.type === 'structured_data' && typeof evt.data === 'object') {
            console.log('[Composer] 🎴 RECEIVED CARD FROM SERVER:', evt.data.type);
            (window as any).chatStream?.structuredData?.(evt.data);
          } else if (evt.type === 'end') {
            (window as any).chatStream?.end?.();
            // Cancel and remove any cached messages for this thread in case it was deleted
            await queryClient.cancelQueries({ queryKey: ["/api/chat/threads", tid, "messages"] });
            await queryClient.removeQueries({ queryKey: ["/api/chat/threads", tid, "messages"], exact: true });
            await queryClient.invalidateQueries({ queryKey: ["/api/chat/threads", tid, "messages"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
            // Force refresh threads list to pick up any title changes
            await queryClient.refetchQueries({ queryKey: ["/api/chat/threads"] });
          }
        } catch {}
      }
    }
  };

  const send = useCallback(async () => {
    if (!text.trim()) return;
    setSending(true);

    try {
      // Clear text immediately when starting to send
      const messageText = text;
      setText("");

      // If no thread yet, create one lazily
      let targetThreadId = threadId;
      if (!targetThreadId) {
        const t = await apiRequest("/api/chat/threads", { method: "POST" } as any);
        await queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
        targetThreadId = (t.id || (t as any).threadId) as string;
        // Navigate to the new thread view
        navigate(`/${targetThreadId}`, { replace: true });
      }

      // Show user message immediately by adding it to the stream
      console.log('[Composer] Calling addUserMessage with:', messageText);
      console.log('[Composer] chatStream available?', !!(window as any).chatStream);
      console.log('[Composer] addUserMessage available?', !!(window as any).chatStream?.addUserMessage);
      
      // Wait a bit for ConversationStream to mount if we just navigated
      if (!targetThreadId || targetThreadId === threadId) {
        if ((window as any).chatStream?.addUserMessage) {
          (window as any).chatStream.addUserMessage(messageText);
          console.log('[Composer] Successfully called addUserMessage');
        } else {
          console.error('[Composer] chatStream.addUserMessage not available!');
        }
      } else {
        // We're navigating to a new thread, wait for it to mount
        setTimeout(() => {
          if ((window as any).chatStream?.addUserMessage) {
            (window as any).chatStream.addUserMessage(messageText);
            console.log('[Composer] Successfully called addUserMessage after navigation');
          }
          // Ensure thinking state begins only after ConversationStream is mounted
          (window as any).chatStream?.begin?.();
        }, 120);
      }

      // Start thinking state immediately when staying on same thread
      if (targetThreadId === threadId) {
        (window as any).chatStream?.begin?.();
      }

      await (window as any).sendServerStream({ threadId: targetThreadId as string, content: messageText, requestedAgentType: pendingAgentTypeRef.current });
      pendingAgentTypeRef.current = undefined;
            } catch (e) {
              console.error('Chat stream error', e);
              (window as any).chatStream?.end?.();
            } finally {
              setSending(false);
            }
  }, [text, threadId, navigate, queryClient]);

  // Expose a helper so QuickActions can trigger a send in blank state
  (window as any).composeAndSend = async (preset: string, agentType?: string) => {
    setText(preset);
    pendingAgentTypeRef.current = agentType;
    await new Promise((r) => setTimeout(r, 0));
    await send();
  };

  // Expose sendMessage for habit cards and other components
  (window as any).sendMessage = async (message: string) => {
    setText(message);
    await new Promise((r) => setTimeout(r, 0));
    await send();
  };

  return (
    <div className="max-w-3xl mx-auto w-full flex items-start gap-2 min-w-0 overflow-x-hidden px-2 sm:px-0">
      <textarea
        ref={textareaRef}
        className="flex-1 border rounded-xl p-3 min-h-[44px] resize-none overflow-hidden min-w-0 w-0"
        placeholder="Ask your coach..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        style={{ height: threadId ? '88px' : '96px' }}
      />
      <button
        className="w-11 h-11 rounded-2xl bg-teal-600 text-white disabled:opacity-50 flex items-center justify-center self-start"
        onClick={send}
        disabled={!text.trim() || sending}
        aria-label="Send"
        title="Send"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
}


