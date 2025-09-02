import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Calendar, BookOpen, Plus, Search, ChevronRight, Clock } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { Logo } from "@/components/ui/Logo";
import { PageHeader } from "@/components/ui/PageHeader";
import { JournalEntryDetail } from "./JournalEntryDetail";
import { CreateJournalEntry } from "./CreateJournalEntry";
import type { JournalEntry } from "@shared/schema";

export const JournalsScreen = () => {
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"all" | "month">("all");

  // Fetch journal entries
  const { data: journalEntries, isLoading, refetch } = useQuery({
    queryKey: ['/api/journals'],
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
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
                <div className="text-gray-600 text-sm sm:text-base">Loading your journal entries...</div>
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
      ? (typeof editEntry.entryDate === 'string' ? editEntry.entryDate.slice(0,10) : format(editEntry.entryDate, 'yyyy-MM-dd'))
      : format(new Date(), 'yyyy-MM-dd');
    return (
      <CreateJournalEntry
        entryId={editEntry.id}
        initialTitle={editEntry.title}
        initialContent={editEntry.content}
        initialMood={editEntry.mood as string}
        initialTags={editEntry.tags as string[]}
        initialDate={dateStr}
        onSave={() => { setEditEntry(null); refetch(); }}
        onCancel={() => setEditEntry(null)}
      />
    );
  }

  if (selectedEntry) {
    return (
      <JournalEntryDetail
        entry={selectedEntry}
        onBack={() => setSelectedEntry(null)}
        onEdit={(entry) => { setEditEntry(entry); }}
        onDelete={() => { setSelectedEntry(null); refetch(); }}
      />
    );
  }

  const entries = (journalEntries as JournalEntry[]) || [];
  
  // Filter entries based on view mode
  const filteredEntries = viewMode === "month" 
    ? entries.filter(entry => {
        if (!entry.entryDate) return false;
        const entryDate = parseISO(entry.entryDate.toString());
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        return entryDate >= monthStart && entryDate <= monthEnd;
      })
    : entries;

  const truncateContent = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  const getTimeAgo = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return format(date, "MMM d, yyyy");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
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
                { value: "month", label: "This Month" }
              ],
              onChange: (value) => setViewMode(value as "all" | "month")
            }
          ]}
        />



        {/* Journal Entries */}
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
                onClick={() => setSelectedEntry(entry)}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="font-semibold text-gray-800 text-base sm:text-lg group-hover:text-indigo-600 transition-colors">
                          {entry.title}
                        </h3>
                        {entry.mood && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-600">
                            {entry.mood}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mb-3 leading-relaxed text-sm sm:text-base">
                        {truncateContent(entry.content)}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          {entry.entryDate && (
                            <>
                              <span className="hidden sm:inline">{format(typeof entry.entryDate === 'string' ? parseISO(entry.entryDate) : entry.entryDate, "EEEE, MMMM d, yyyy")}</span>
                              <span className="sm:hidden">{format(typeof entry.entryDate === 'string' ? parseISO(entry.entryDate) : entry.entryDate, "MMM d, yyyy")}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="sm:hidden">•</span>
                              <span>{getTimeAgo(entry.entryDate)}</span>
                            </>
                          )}
                        </div>
                        
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            {entry.tags.slice(0, 2).map((tag, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
                              >
                                #{tag}
                              </span>
                            ))}
                            {entry.tags.length > 2 && (
                              <span className="text-xs text-gray-500">
                                +{entry.tags.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 ml-2 sm:ml-4 group-hover:text-indigo-600 transition-colors" />
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