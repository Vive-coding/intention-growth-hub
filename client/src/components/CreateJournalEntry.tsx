import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Calendar } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface CreateJournalEntryProps {
  onSave: () => void;
  onCancel: () => void;
  // Prefill values (used for edit mode)
  entryId?: string; // when present, component acts in edit mode
  initialTitle?: string;
  initialContent?: string;
  initialMood?: string;
  initialTags?: string[];
  initialDate?: string; // yyyy-MM-dd
}

export const CreateJournalEntry = ({ 
  onSave, 
  onCancel, 
  entryId,
  initialTitle = "",
  initialContent = "", 
  initialMood = "neutral",
  initialTags = [],
  initialDate
}: CreateJournalEntryProps) => {
  const isEdit = Boolean(entryId);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [mood, setMood] = useState(initialMood);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [entryDate, setEntryDate] = useState(initialDate || format(new Date(), "yyyy-MM-dd"));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      alert("Please fill in both title and content");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        mood: mood,
        tags: tags,
        entryDate: new Date(entryDate).toISOString(),
        isPrivate: true,
      };

      const response = await apiRequest(isEdit ? `/api/journals/${entryId}` : '/api/journals', {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response) {
        // Trigger agent to reconsider suggestions after journal changes
        try {
          await apiRequest('/api/insights/trigger-latest', { method: 'POST' });
        } catch (err) {
          console.warn('Agent trigger after journal save failed:', err);
        }
        if (!isEdit) {
          setTitle('');
          setContent('');
        }
        onSave();
      }
    } catch (error) {
      console.error("Error saving journal entry:", error);
      alert("Failed to save journal entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const moodOptions = [
    { value: "happy", label: "😊 Happy" },
    { value: "grateful", label: "🙏 Grateful" },
    { value: "excited", label: "🎉 Excited" },
    { value: "peaceful", label: "😌 Peaceful" },
    { value: "thoughtful", label: "🤔 Thoughtful" },
    { value: "motivated", label: "💪 Motivated" },
    { value: "tired", label: "😴 Tired" },
    { value: "stressed", label: "😰 Stressed" },
    { value: "sad", label: "😢 Sad" },
    { value: "anxious", label: "😟 Anxious" },
    { value: "neutral", label: "😐 Neutral" },
  ];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Journal
              </Button>
              
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                {isEdit ? 'Edit Journal Entry' : 'New Journal Entry'}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>

        {/* Create Form */}
        <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <Input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's on your mind today?"
                  className="text-lg"
                  required
                />
              </div>

              {/* Date and Mood Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="entryDate" className="block text-sm font-medium text-gray-700 mb-2">
                    Entry Date
                  </label>
                  <Input
                    id="entryDate"
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="mood" className="block text-sm font-medium text-gray-700 mb-2">
                    Mood (Optional)
                  </label>
                  <Select value={mood} onValueChange={setMood}>
                    <SelectTrigger>
                      <SelectValue placeholder="How are you feeling?" />
                    </SelectTrigger>
                    <SelectContent>
                      {moodOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (Optional)
                </label>
                <Input
                  id="tags"
                  type="text"
                  value={tags.join(', ')}
                  onChange={(e) => setTags(e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0))}
                  placeholder="work, personal, reflection, goals (comma-separated)"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Separate multiple tags with commas
                </p>
              </div>

              {/* Content */}
              <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                  Content *
                </label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share your thoughts, experiences, reflections..."
                  className="min-h-[300px] text-base leading-relaxed"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Saving..." : "Save Entry"}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};