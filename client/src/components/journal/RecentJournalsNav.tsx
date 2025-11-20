import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { BookOpen } from "lucide-react";

type JournalEntry = {
  id: string;
  title: string;
  content?: string;
  entryDate?: string | Date | null;
};

interface RecentJournalsNavProps {
  onSelectEntry: (id: string) => void;
  onViewAll?: () => void;
}

export function RecentJournalsNav({ onSelectEntry, onViewAll }: RecentJournalsNavProps) {
  const { data: journalEntries = [] } = useQuery({
    queryKey: ["/api/journals", "recent"],
    queryFn: async () => {
      const result = await apiRequest("/api/journals");
      return Array.isArray(result) ? (result as JournalEntry[]) : [];
    },
    staleTime: 60_000,
  });

  const recent = useMemo(() => journalEntries.slice(0, 6), [journalEntries]);

  return (
    <div className="mt-6">
      <div className="px-4 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Recent Journals
        </div>
        <button
          type="button"
          onClick={() => window.location.assign("/journal")}
          className="w-6 h-6 inline-flex items-center justify-center rounded-full border border-gray-300 text-gray-600 text-base leading-none hover:bg-gray-50 hover:text-gray-900 transition-colors"
          aria-label="New journal entry"
        >
          +
        </button>
      </div>
      <div className="mt-2 border-t border-gray-200" />
      <div className="mt-2 space-y-1 px-2">
        {recent.map((entry) => {
          const date = entry.entryDate
            ? format(new Date(entry.entryDate), "MMM d")
            : "";
          return (
            <button
              key={entry.id}
              onClick={() => onSelectEntry(entry.id)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-start gap-3"
            >
              <BookOpen className="w-4 h-4 text-emerald-600 mt-1" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {entry.title || "Untitled entry"}
                </div>
                {date && (
                  <div className="text-xs text-gray-500">
                    {date}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="w-full text-left px-3 py-2 rounded-lg border border-dashed border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-3 mt-2"
          >
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium">View all journals</span>
          </button>
        )}
      </div>
    </div>
  );
}

