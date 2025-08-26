import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface EditHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit: { id: string; title: string; description?: string } | null;
  onSaved?: () => void;
}

export function EditHabitModal({ isOpen, onClose, habit, onSaved }: EditHabitModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (habit) {
      setTitle(habit.title || "");
      setDescription(habit.description || "");
    }
  }, [habit]);

  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSave = async () => {
    if (!habit) return;
    setSaving(true);
    try {
      await apiRequest(`/api/goals/habits/${habit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      toast({ title: "Habit updated" });
      onSaved?.();
      onClose();
    } catch (e) {
      console.error("Failed to update habit", e);
      toast({ title: "Failed to update habit", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Habit</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="habit-title">Title</Label>
            <Input id="habit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="habit-description">Description</Label>
            <Textarea
              id="habit-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


