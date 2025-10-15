import { X, Lightbulb } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SuggestionsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SuggestionsPanel({ open, onClose }: SuggestionsPanelProps) {
  const { data: suggested = [], isLoading } = useQuery({
    queryKey: ['/api/goals/habits/suggested'],
    queryFn: async () => apiRequest('/api/goals/habits/suggested'),
    enabled: open,
    staleTime: 10_000,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl border-l flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-gray-800">Suggestions</div>
              <div className="text-xs text-gray-500">AI-powered goals & habits</div>
            </div>
          </div>
          <button className="p-2 rounded hover:bg-gray-100" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {isLoading && (
            <div className="text-sm text-gray-500">Loading suggestions…</div>
          )}
          {!isLoading && suggested && suggested.length === 0 && (
            <div className="text-sm text-gray-500">No suggestions available right now.</div>
          )}

          {Array.isArray(suggested) && suggested.map((s: any) => (
            <div key={`${s.id || s.existingId}-${s.sourceInsightId || 'n'}`} className="border rounded-lg p-3 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-gray-800 truncate">{s.title || s.existingTitle}</div>
                  {s.description && <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{s.description}</div>}
                  {s.lifeMetric && (
                    <div className="mt-1 text-[11px] inline-flex px-2 py-0.5 rounded-full border bg-white text-gray-700">
                      {s.lifeMetric.name}
                    </div>
                  )}
                </div>
                {/* Placeholder action; future: accept/add */}
                <button
                  className="text-sm px-3 py-1.5 rounded-md bg-teal-600 text-white shrink-0"
                  onClick={() => {
                    // For Phase 3.2, route user to habits to take action; later: inline accept
                    window.location.href = '/habits';
                  }}
                >
                  Review
                </button>
              </div>
              {typeof s.similarity === 'number' && (
                <div className="mt-2 text-[11px] text-gray-500">Similarity {Math.round(s.similarity * 100)}%</div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}


