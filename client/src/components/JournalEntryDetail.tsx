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
  const [editTitle, setEditTitle] = useState(entry.title);
  const [editContent, setEditContent] = useState(entry.content);
  const [editMood, setEditMood] = useState(entry.mood || 'neutral');
  const [editTags, setEditTags] = useState(entry.tags?.join(', ') || '');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = async () => {
    if (!editTitle.trim() || !editContent.trim()) {
      alert("Title and content are required.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/journals/${entry.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          mood: editMood,
          tags: editTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update journal entry');
      }

      const updatedEntry = await response.json();
      console.log('Journal entry updated:', updatedEntry);
      
      // Exit edit mode
      setIsEditing(false);
      
      // Refresh the parent component
      onUpdate();
      
      alert("Journal entry updated successfully!");
    } catch (error) {
      console.error('Error updating journal entry:', error);
      alert('Failed to update journal entry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setEditTitle(entry.title);
    setEditContent(entry.content);
    setEditMood(entry.mood || 'neutral');
    setEditTags(entry.tags?.join(', ') || '');
    setIsEditing(false);
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
            {isEditing ? (
              /* Edit Form */
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Journal entry title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    placeholder="Write your thoughts..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mood
                    </label>
                    <select
                      value={editMood}
                      onChange={(e) => setEditMood(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="happy">Happy</option>
                      <option value="neutral">Neutral</option>
                      <option value="sad">Sad</option>
                      <option value="excited">Excited</option>
                      <option value="anxious">Anxious</option>
                      <option value="frustrated">Frustrated</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="work, productivity, goals"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-purple-600 text-white hover:bg-purple-700"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* Read-only View */
              <>
                {/* Title and Metadata */}
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-gray-800 mb-4">
                    {entry.title}
                  </h1>
                  
                  <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {entry.entryDate && format(typeof entry.entryDate === 'string' ? parseISO(entry.entryDate) : entry.entryDate, "EEEE, MMMM d, yyyy")}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {entry.createdAt && format(typeof entry.createdAt === 'string' ? parseISO(entry.createdAt) : entry.createdAt, "h:mm a")}
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
                    {entry.updatedAt !== entry.createdAt && entry.updatedAt && (
                      <span>
                        Last updated: {format(typeof entry.updatedAt === 'string' ? parseISO(entry.updatedAt) : entry.updatedAt, "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};