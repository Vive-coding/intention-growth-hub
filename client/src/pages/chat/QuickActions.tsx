import { CheckSquare, Lightbulb, Sparkles, Zap, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  onReviewHabits: () => void;
  onViewSuggestions: () => void;
  onOptimize: () => void;
  onSurpriseMe: () => void;
  mode?: 'plus' | 'full';
}

export default function QuickActions({ onReviewHabits, onViewSuggestions, onOptimize, onSurpriseMe, mode = 'full' }: Props) {
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
                  <CheckSquare className="w-4 h-4" /> Review habits
                </button>
                <button onClick={onViewSuggestions} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" /> View suggestions
                </button>
                <button onClick={onOptimize} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Optimize
                </button>
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
            <CheckSquare className="w-4 h-4" /> Review habits
          </button>
          <button onClick={onViewSuggestions} className="text-sm px-3 py-1.5 rounded-xl bg-white border text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4" /> Suggest goals
          </button>
          <button onClick={onOptimize} className="text-sm px-3 py-1.5 rounded-xl bg-white border text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Optimize
          </button>
          <button onClick={onSurpriseMe} className="text-sm px-3 py-1.5 rounded-xl bg-white border text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <Zap className="w-4 h-4" /> Surprise me
          </button>
        </div>
      )}
    </div>
  );
}


