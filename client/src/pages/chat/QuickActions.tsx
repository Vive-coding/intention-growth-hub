import { useEffect, useState } from "react";
import { CheckSquare, Lightbulb, Sparkles, Zap, Plus, MoreHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";

interface Props {
  onReviewHabits: () => void;
  onViewSuggestions: () => void;
  onOptimize: () => void;
  onSurpriseMe: () => void;
  mode?: 'plus' | 'full';
}

export default function QuickActions({ onReviewHabits, onViewSuggestions, onOptimize, onSurpriseMe, mode = 'full' }: Props) {
  const defaultLimit = typeof window !== 'undefined' ? Number(window.localStorage.getItem('focusGoalLimit') || '3') : 3;
  const normalizedDefault = Math.min(Math.max(defaultLimit, 3), 5);
  const [focusLimit, setFocusLimit] = useState(normalizedDefault);
  const [updatingLimit, setUpdatingLimit] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = Number(window.localStorage.getItem('focusGoalLimit') || focusLimit);
      const normalized = Math.min(Math.max(stored, 3), 5);
      setFocusLimit(normalized);
    }
  }, []);

  const updateLimit = async (nextLimit: number) => {
    if (updatingLimit) return;
    setUpdatingLimit(true);
    try {
      await apiRequest('/api/my-focus/config', {
        method: 'POST',
        body: JSON.stringify({ maxGoals: nextLimit }),
      });
      setFocusLimit(nextLimit);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('focusGoalLimit', String(nextLimit));
      }
      const compose = (window as any).composeAndSend;
      if (typeof compose === 'function') {
        compose(`Help me optimize my focus with ${nextLimit} goals.`, 'prioritize_optimize');
      } else if (typeof (window as any).sendMessage === 'function') {
        (window as any).sendMessage(`Help me optimize my focus with ${nextLimit} goals.`);
      }
    } catch (error) {
      console.error('Failed to update focus goal limit', error);
    } finally {
      setUpdatingLimit(false);
    }
  };

  const handleDecrease = () => {
    if (focusLimit <= 3) return;
    updateLimit(focusLimit - 1);
  };

  const handleIncrease = () => {
    if (focusLimit >= 5) return;
    updateLimit(focusLimit + 1);
  };

  return (
    <div className="max-w-3xl mx-auto px-0 pb-2">
      {mode === 'plus' ? (
        <div className="flex">
          <Popover>
            <PopoverTrigger asChild>
              <button aria-label="Quick actions" className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow hover:bg-emerald-700">
                <Plus className="w-5 h-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-0 overflow-hidden">
              <div className="py-1">
                <button onClick={onReviewHabits} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" /> Review progress
                </button>
                <button onClick={onViewSuggestions} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" /> Plan ahead
                </button>
                <button onClick={onOptimize} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Optimize focus
                </button>
                <div className="border-t my-1" />
                <div className="px-3 py-2 text-[11px] text-gray-500 uppercase tracking-wide">Focus slots ({focusLimit})</div>
                <div className="px-3 pb-2 flex items-center gap-2">
                  <button
                    onClick={handleDecrease}
                    disabled={focusLimit <= 3 || updatingLimit}
                    className="flex-1 text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    − Reduce
                  </button>
                  <button
                    onClick={handleIncrease}
                    disabled={focusLimit >= 5 || updatingLimit}
                    className="flex-1 text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + Increase
                  </button>
                </div>
                <button onClick={onSurpriseMe} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Surprise me
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <button onClick={onReviewHabits} className="text-sm px-3 py-1.5 rounded-xl bg-white border text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4" /> Review progress
          </button>
          <button onClick={onViewSuggestions} className="text-sm px-3 py-1.5 rounded-xl bg-white border text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4" /> Plan ahead
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-sm px-3 py-1.5 rounded-xl bg-white border text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
                <MoreHorizontal className="w-4 h-4" /> More
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-0 overflow-hidden">
              <div className="py-1">
                <button onClick={onOptimize} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Optimize focus
                </button>
                <div className="border-t my-1" />
                <div className="px-3 py-2 text-[11px] text-gray-500 uppercase tracking-wide">Focus slots ({focusLimit})</div>
                <div className="px-3 pb-2 flex items-center gap-2">
                  <button
                    onClick={handleDecrease}
                    disabled={focusLimit <= 3 || updatingLimit}
                    className="flex-1 text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    − Reduce
                  </button>
                  <button
                    onClick={handleIncrease}
                    disabled={focusLimit >= 5 || updatingLimit}
                    className="flex-1 text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + Increase
                  </button>
                </div>
                <button onClick={onSurpriseMe} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Surprise me
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}


