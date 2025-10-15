import { CheckSquare, Lightbulb, Sparkles } from "lucide-react";

interface Props {
  onReviewHabits: () => void;
  onViewSuggestions: () => void;
  onOptimize: () => void;
}

export default function QuickActions({ onReviewHabits, onViewSuggestions, onOptimize }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-0 pb-2">
      <div className="flex flex-wrap gap-2">
        <button onClick={onReviewHabits} className="text-sm px-3 py-1.5 rounded-xl bg-white border text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
          <CheckSquare className="w-4 h-4" /> Review habits
        </button>
        <button onClick={onViewSuggestions} className="text-sm px-3 py-1.5 rounded-xl bg-white border text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4" /> View suggestions
        </button>
        <button onClick={onOptimize} className="text-sm px-3 py-1.5 rounded-xl bg-white border text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" /> Optimize
        </button>
      </div>
    </div>
  );
}


