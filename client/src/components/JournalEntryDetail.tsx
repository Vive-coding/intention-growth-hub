import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2, Calendar, Clock, Tag } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { JournalEntry } from "@shared/schema";

interface JournalEntryDetailProps {
  entry: JournalEntry;
  onBack: () => void;
  onUpdate: () => void;
}

export const JournalEntryDetail = ({ entry, onBack, onUpdate }: JournalEntryDetailProps) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this journal entry?")) {
      return;
    }

    try {
      const response = await fetch(`/api/journals/${entry.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        onUpdate();
        onBack();
      } else {
        alert("Failed to delete journal entry");
      }
    } catch (error) {
      console.error("Error deleting journal entry:", error);
      alert("Failed to delete journal entry");
    }
  };

  const formatContent = (content: string) => {
    return content.split('\n').map((paragraph, index) => (
      <p key={index} className="mb-4 last:mb-0 leading-relaxed">
        {paragraph}
      </p>
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Journal
              </Button>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Journal Entry Content */}
        <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            {/* Title and Metadata */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-4">
                {entry.title}
              </h1>
              
              <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {format(parseISO(entry.entryDate), "EEEE, MMMM d, yyyy")}
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {format(parseISO(entry.createdAt), "h:mm a")}
                </div>
                
                {entry.mood && (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center">
                      😊
                    </span>
                    <span className="capitalize">{entry.mood}</span>
                  </div>
                )}
              </div>

              {entry.tags && entry.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-gray-500" />
                  {entry.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="prose prose-gray max-w-none">
              <div className="text-gray-700 text-lg leading-relaxed">
                {formatContent(entry.content)}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                {entry.updatedAt !== entry.createdAt && (
                  <span>
                    Last updated: {format(parseISO(entry.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};