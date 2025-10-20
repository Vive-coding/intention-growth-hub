import { useCallback, useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";

interface Props {
  threadId?: string;
}

export default function Composer({ threadId }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

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
            (window as any).chatStream?.structuredData?.(evt.data);
          } else if (evt.type === 'end') {
            (window as any).chatStream?.end?.();
            await queryClient.invalidateQueries({ queryKey: ["/api/chat/threads", tid, "messages"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
          }
        } catch {}
      }
    }
  };

  const send = useCallback(async () => {
    if (!text.trim()) return;
    if (!threadId) return;
    setSending(true);

    try {
      // Clear text immediately when starting to send
      const messageText = text;
      setText("");

      // Show user message immediately by adding it to the stream
      console.log('[Composer] Calling addUserMessage with:', messageText);
      console.log('[Composer] chatStream available?', !!(window as any).chatStream);
      console.log('[Composer] addUserMessage available?', !!(window as any).chatStream?.addUserMessage);
      
      if ((window as any).chatStream?.addUserMessage) {
        (window as any).chatStream.addUserMessage(messageText);
        console.log('[Composer] Successfully called addUserMessage');
      } else {
        console.error('[Composer] chatStream.addUserMessage not available!');
      }

      // Start thinking state
      (window as any).chatStream?.begin?.();

      await (window as any).sendServerStream({ threadId, content: messageText });
            } catch (e) {
              console.error('Chat stream error', e);
              (window as any).chatStream?.end?.();
            } finally {
              setSending(false);
            }
  }, [text, threadId]);

  return (
    <div className="max-w-3xl mx-auto flex items-start gap-2">
      <textarea
        ref={textareaRef}
        className="flex-1 border rounded-xl p-3 min-h-[44px] resize-none overflow-hidden"
        placeholder="Ask your coach..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        style={{ height: '44px' }}
      />
      <button
        className="w-11 h-11 rounded-2xl bg-teal-600 text-white disabled:opacity-50 flex items-center justify-center self-start"
        onClick={send}
        disabled={!text.trim() || sending || !threadId}
        aria-label="Send"
        title="Send"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
}


