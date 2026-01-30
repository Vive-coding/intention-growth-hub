import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface ModelSwitcherProps {
  threadId?: string;
  threadModel?: string | null;
  onModelChange?: (model: string) => void;
  disabled?: boolean;
}

export default function ModelSwitcher({ threadId, threadModel, onModelChange, disabled }: ModelSwitcherProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState<string>("gpt-5-mini");

  // Fetch user preferences and premium status
  const { data: preferences, error: prefError, isLoading } = useQuery({
    queryKey: ["/api/user/preferences/model"],
    queryFn: async () => {
      const data = await apiRequest("/api/user/preferences/model");
      return data as { preferredModel: string; isPremium: boolean };
    },
    retry: 2,
  });

  // Check if thread has messages (to determine if model is locked)
  const { data: messages } = useQuery({
    // IMPORTANT: Do NOT share the same query key as ConversationStream.
    // ConversationStream fetches full history; this is just a head probe (limit=1).
    queryKey: ["/api/chat/threads", threadId, "messages_head"],
    queryFn: async () => {
      if (!threadId) return [];
      const data = await apiRequest(`/api/chat/threads/${threadId}/messages?limit=1`);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!threadId,
  });

  // Model is locked if thread exists AND has messages
  const isLocked = threadId ? (messages && messages.length > 0) : false;
  const isPremium = preferences?.isPremium || false;

  // Update selected model when preferences load
  useEffect(() => {
    if (preferences?.preferredModel) {
      setSelectedModel(preferences.preferredModel);
    }
  }, [preferences]);

  const updateModelMutation = useMutation({
    mutationFn: async (model: string) => {
      if (threadId && !isLocked) {
        // Update thread model (will be saved on first message)
        // For now, we'll pass it when sending the first message
        return { model };
      } else {
        // Update user preference
        await apiRequest("/api/user/preferences/model", {
          method: "PUT",
          body: JSON.stringify({ model }),
        });
        return { model };
      }
    },
    onSuccess: (data) => {
      setSelectedModel(data.model);
      onModelChange?.(data.model);
      // Dispatch custom event for Composer to listen to
      window.dispatchEvent(new CustomEvent('modelChanged', { detail: { model: data.model } }));
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences/model"] });
    },
  });

  const handleModelChange = (model: string) => {
    if (disabled || isLocked) return;
    
    // Check if user has access to the selected model
    if (model === "claude-opus" && !isPremium) {
      // Show upgrade message or prevent selection
      alert("Claude Opus 4.5 requires a premium subscription. Please upgrade to access this model.");
      return;
    }

    updateModelMutation.mutate(model);
  };

  // Always show the switcher - it will be disabled if locked
  // Don't hide it completely, just disable it when locked
  
  // Use preferences if available, otherwise use defaults
  const effectivePremium = preferences?.isPremium || false;
  // If thread is locked, show the thread's stored model (not the user's default preference),
  // otherwise show the selectable model (preference / local state).
  const normalizedThreadModel = threadModel || "gpt-5-mini";
  const effectiveModel = (threadId && isLocked)
    ? normalizedThreadModel
    : (preferences?.preferredModel || selectedModel);

  return (
    <div className="flex items-center gap-2 shrink-0" data-testid="model-switcher">
      <label className="text-xs text-gray-600 whitespace-nowrap">Model:</label>
      <select
        value={effectiveModel}
        onChange={(e) => handleModelChange(e.target.value)}
        disabled={disabled || (isLocked && !!threadId) || updateModelMutation.isPending || isLoading}
        className="text-xs border rounded px-2 py-1 bg-white disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
        title={isLocked && threadId ? "Model is locked for this conversation" : "Select AI model"}
      >
        <option value="gpt-5-mini">GPT-5 Mini</option>
        <option value="claude-haiku">Claude Haiku 4.5</option>
        <option value="claude-opus" disabled={!effectivePremium}>
          Claude Opus 4.5 {!effectivePremium && "(Premium)"}
        </option>
      </select>
      {effectiveModel === "claude-opus" && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 whitespace-nowrap">
          Premium
        </span>
      )}
      {isLoading && (
        <span className="text-xs text-gray-400">Loading...</span>
      )}
      {prefError && (
        <span className="text-xs text-red-500" title="Error loading preferences">⚠️</span>
      )}
    </div>
  );
}
