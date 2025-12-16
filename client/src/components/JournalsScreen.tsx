import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clock,
  Plus,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";
import { JournalEntryDetail } from "./JournalEntryDetail";
import { CreateJournalEntry } from "./CreateJournalEntry";
import type { JournalEntry } from "@shared/schema";

interface JournalsScreenProps {
  initialEntryId?: string | null;
  onBack?: () => void;
  onEntryCleared?: () => void;
}

export const JournalsScreen: React.FC<JournalsScreenProps> = ({
  initialEntryId,
  onBack,
  onEntryCleared,
}) => {
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"all" | "month">("all");

  const { data: journalEntries = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/journals"],
    retry: 1,
  });

  useEffect(() => {
    if (!initialEntryId) return;
    const entry = (journalEntries as JournalEntry[]).find(
      (item) => item.id === initialEntryId,
    );
    if (entry) {
      setSelectedEntry(entry);
    }
  }, [initialEntryId, journalEntries]);

  if (isLoading) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg sm:text-xl">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                Your Journal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-gray-600 text-sm sm:text-base">
                  Loading your journal entries...
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <CreateJournalEntry
        onSave={() => {
          setShowCreateForm(false);
          refetch();
        }}
        onCancel={() => setShowCreateForm(false)}
      />
    );
  }

  if (editEntry) {
    const dateStr = editEntry.entryDate
      ? typeof editEntry.entryDate === "string"
        ? editEntry.entryDate.slice(0, 10)
        : format(editEntry.entryDate, "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd");
    return (
      <CreateJournalEntry
        entryId={editEntry.id}
        initialTitle={editEntry.title}
        initialContent={editEntry.content}
        initialMood={editEntry.mood as string}
        initialTags={editEntry.tags as string[]}
        initialDate={dateStr}
        onSave={() => {
          setEditEntry(null);
          refetch();
        }}
        onCancel={() => setEditEntry(null)}
      />
    );
  }

  if (selectedEntry) {
    return (
      <JournalEntryDetail
        entry={selectedEntry}
        onBack={() => {
          setSelectedEntry(null);
          onEntryCleared?.();
        }}
        onEdit={(entry) => {
          setEditEntry(entry);
        }}
        onDelete={() => {
          setSelectedEntry(null);
          refetch();
          onEntryCleared?.();
        }}
      />
    );
  }

  const entries = journalEntries as JournalEntry[];

  const filteredEntries =
    viewMode === "month"
      ? entries.filter((entry) => {
          if (!entry.entryDate) return false;
          const entryDate = parseISO(entry.entryDate.toString());
          const monthStart = startOfMonth(selectedDate);
          const monthEnd = endOfMonth(selectedDate);
          return entryDate >= monthStart && entryDate <= monthEnd;
        })
      : entries;

  const truncateContent = (content: string, maxLength = 100) => {
    if (!content) return "";
    if (content.length <= maxLength) return content;
    return `${content.substring(0, maxLength)}...`;
  };

  const getTimeAgo = (dateString: string | Date) => {
    const date =
      typeof dateString === "string" ? parseISO(dateString) : dateString;
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return format(date, "MMM d, yyyy");
  };

  return (
    <div className="min-h-screen p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedEntry(null);
              onEntryCleared?.();
              onBack();
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Journal Home
          </Button>
        )}

        <PageHeader
          title="Your Journal"
          description="Capture your thoughts, reflections, and daily insights"
          icon={<BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />}
          showAddButton={true}
          addButtonText="New Entry"
          addButtonIcon={<Plus className="w-4 h-4" />}
          onAddClick={() => setShowCreateForm(true)}
          filters={[
            {
              label: "View",
              value: viewMode,
              options: [
                { value: "all", label: "All Entries" },
                { value: "month", label: "This Month" },
              ],
              onChange: (value) => setViewMode(value as "all" | "month"),
            },
          ]}
        />

        <div className="space-y-4">
          {filteredEntries.length === 0 ? (
            <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="text-center py-8 sm:py-12">
                <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-600 mb-2">
                  No journal entries yet
                </h3>
                <p className="text-gray-500 mb-6 text-sm sm:text-base">
                  Start documenting your journey by creating your first entry
                </p>
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Entry
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredEntries.map((entry) => (
              <Card
                key={entry.id}
                className="shadow-md border-0 bg-white/80 backdrop-blur-sm hover:bg-white/90 transition-all cursor-pointer group"
                onClick={() => {
                  setSelectedEntry(entry);
                }}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="font-semibold text-gray-800 text-base sm:text-lg group-hover:text-indigo-600 transition-colors">
                          {entry.title || "Untitled entry"}
                        </h3>
                        {entry.mood && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-600">
                            {entry.mood}
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 mb-3 leading-relaxed text-sm sm:text-base">
                        {truncateContent(entry.content || "")}
                      </p>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          {entry.entryDate && (
                            <>
                              <span className="hidden sm:inline">
                                {format(
                                  typeof entry.entryDate === "string"
                                    ? parseISO(entry.entryDate)
                                    : entry.entryDate,
                                  "EEEE, MMMM d, yyyy",
                                )}
                              </span>
                              <span className="sm:hidden">
                                {format(
                                  typeof entry.entryDate === "string"
                                    ? parseISO(entry.entryDate)
                                    : entry.entryDate,
                                  "MMM d, yyyy",
                                )}
                              </span>
                              <span className="hidden sm:inline">•</span>
                            </>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {entry.entryDate
                              ? getTimeAgo(entry.entryDate)
                              : "Just now"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-indigo-600 text-sm font-medium">
                          <span>Read entry</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditEntry(entry);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};