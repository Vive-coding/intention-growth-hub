import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Edit, Trash2, Calendar, Heart } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  mood?: string;
  tags?: string[];
  entryDate: string;
  createdAt: string;
  updatedAt: string;
}

interface JournalEntryDetailProps {
  entry: JournalEntry;
  onBack: () => void;
  onEdit?: (entry: JournalEntry) => void;
  onDelete?: (entryId: string) => void;
}

export const JournalEntryDetail = ({ 
  entry, 
  onBack, 
  onEdit, 
  onDelete 
}: JournalEntryDetailProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEdit = () => {
    if (onEdit) {
      onEdit(entry);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const response = await apiRequest(`/api/journals/${entry.id}`, {
        method: 'DELETE',
      });

      if (response) {
        if (onDelete) {
          onDelete(entry.id);
        }
        setShowDeleteDialog(false);
      }
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      alert('Failed to delete journal entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'happy':
        return '😊';
      case 'sad':
        return '😢';
      case 'angry':
        return '😠';
      case 'excited':
        return '🤩';
      case 'anxious':
        return '😰';
      case 'peaceful':
        return '😌';
      default:
        return '😐';
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'happy':
        return 'bg-green-100 text-green-800';
      case 'sad':
        return 'bg-blue-100 text-blue-800';
      case 'angry':
        return 'bg-red-100 text-red-800';
      case 'excited':
        return 'bg-yellow-100 text-yellow-800';
      case 'anxious':
        return 'bg-orange-100 text-orange-800';
      case 'peaceful':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
                  onClick={handleEdit}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
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
                  {format(new Date(entry.entryDate), "EEEE, MMMM d, yyyy")}
                </div>
                
                {entry.mood && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getMoodIcon(entry.mood)}</span>
                    <span className="capitalize">{entry.mood}</span>
                  </div>
                )}
              </div>

              {entry.tags && entry.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="prose prose-gray max-w-none">
              <div className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap">
                {entry.content}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Journal Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>Are you sure you want to delete this journal entry? This action cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};