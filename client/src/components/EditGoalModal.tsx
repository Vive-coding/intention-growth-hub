import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

interface EditGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: {
    id: string;
    title: string;
    description?: string;
    lifeMetric: {
      name: string;
      color: string;
    };
    progress: number;
  };
  onSave: (goalId: string, updates: any) => void;
}

export const EditGoalModal = ({
  isOpen,
  onClose,
  goal,
  onSave,
}: EditGoalModalProps) => {
  const [title, setTitle] = useState(goal.title || "");
  const [description, setDescription] = useState(goal.description || "");
  const [lifeMetricId, setLifeMetricId] = useState("");
  const [targetDate, setTargetDate] = useState("");

  // Fetch life metrics for selection
  const { data: lifeMetrics = [] } = useQuery({
    queryKey: ['/api/life-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/life-metrics', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch life metrics');
      return response.json();
    },
    retry: 1,
  });

  const handleSave = () => {
    if (!title?.trim()) return;

    onSave(goal.id, {
      title: title.trim(),
      description: description.trim(),
      lifeMetricId: lifeMetricId || goal.lifeMetric.name,
      targetDate: targetDate || null,
    });

    onClose();
  };

  const handleClose = () => {
    // Reset form
    setTitle(goal.title);
    setDescription(goal.description || "");
    setLifeMetricId("");
    setTargetDate("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Goal</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Goal Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Improve Sleep Quality"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your goal..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="lifeMetric">Life Metric</Label>
            <Select value={lifeMetricId} onValueChange={setLifeMetricId}>
              <SelectTrigger>
                <SelectValue placeholder={goal.lifeMetric.name} />
              </SelectTrigger>
              <SelectContent>
                {lifeMetrics.map((metric: any) => (
                  <SelectItem key={metric.id} value={metric.id}>
                    {metric.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="targetDate">Target Date (Optional)</Label>
            <Input
              id="targetDate"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!title?.trim()}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 