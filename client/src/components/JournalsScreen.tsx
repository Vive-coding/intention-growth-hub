import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Calendar, BookOpen, Plus, Search, ChevronRight, Clock } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { JournalEntryDetail } from "./JournalEntryDetail";
import { CreateJournalEntry } from "./CreateJournalEntry";
import type { JournalEntry } from "@shared/schema";

export const JournalsScreen = () => {
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
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
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                Your Journal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-gray-600">Loading your journal entries...</div>
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

  if (selectedEntry) {
    return (
      <JournalEntryDetail
        entry={selectedEntry}
        onBack={() => setSelectedEntry(null)}
        onUpdate={() => refetch()}
      />
    );
  }

  const entries = (journalEntries as JournalEntry[]) || [];
  
  // Filter entries based on view mode
  const filteredEntries = viewMode === "month" 
    ? entries.filter(entry => {
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
        <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BookOpen className="w-6 h-6 text-indigo-600" />
                  Your Journal
                </CardTitle>
                <p className="text-gray-600 mt-1">
                  Capture your thoughts, reflections, and daily insights
                </p>
              </div>
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Entry
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Filter Controls */}
        <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("all")}
                  >
                    All Entries
                  </Button>
                  <Button
                    variant={viewMode === "month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("month")}
                  >
                    <Calendar className="w-4 h-4 mr-1" />
                    This Month
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                {filteredEntries.length} entries
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Journal Entries */}
        <div className="space-y-4">
          {filteredEntries.length === 0 ? (
            <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="text-center py-12">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  No journal entries yet
                </h3>
                <p className="text-gray-500 mb-6">
                  Start documenting your journey by creating your first entry
                </p>
                <Button 
                  onClick={() => setShowCreateForm(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
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
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors">
                          {entry.title}
                        </h3>
                        {entry.mood && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-600">
                            {entry.mood}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mb-3 leading-relaxed">
                        {truncateContent(entry.content)}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{format(typeof entry.entryDate === 'string' ? parseISO(entry.entryDate) : entry.entryDate, "EEEE, MMMM d, yyyy")}</span>
                          <span>•</span>
                          <span>{getTimeAgo(entry.entryDate)}</span>
                        </div>
                        
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            {entry.tags.slice(0, 3).map((tag, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
                              >
                                #{tag}
                              </span>
                            ))}
                            {entry.tags.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{entry.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-4 group-hover:text-indigo-600 transition-colors" />
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