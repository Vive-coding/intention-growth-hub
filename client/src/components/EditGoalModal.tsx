import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface EditGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: {
    id: string;
    title: string;
    description?: string;
    targetDate?: string;
    term?: 'short' | 'mid' | 'long' | null;
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
  const [term, setTerm] = useState<'short' | 'mid' | 'long' | 'backlog'>(
    goal.term ?? 'backlog'
  );

  // Fetch life metrics for selection
  const { data: lifeMetrics = [] } = useQuery({
    queryKey: ['/api/life-metrics'],
    queryFn: async () => {
      return apiRequest('/api/life-metrics');
    },
    retry: 1,
  });

  useEffect(() => {
    if (isOpen) {
      console.log('EditGoalModal opened with goal data:', goal);
      console.log('Available life metrics:', lifeMetrics);
      
      // Set title and description immediately
      setTitle(goal.title);
      setDescription(goal.description || "");
      
      // Find and set life metric ID only if we have an exact match
      if (lifeMetrics.length > 0 && goal.lifeMetric?.name) {
        const currentLifeMetric = lifeMetrics.find(
          (metric: any) => metric.name === goal.lifeMetric.name
        );
        if (currentLifeMetric) {
          setLifeMetricId(currentLifeMetric.id);
          console.log(
            "Set life metric ID:",
            currentLifeMetric.id,
            "for metric:",
            goal.lifeMetric.name
          );
        } else {
          console.warn(
            "Could not find life metric ID for:",
            goal.lifeMetric.name
          );
          // Leave lifeMetricId empty so we don't accidentally change it on save
          setLifeMetricId("");
        }
      } else {
        setLifeMetricId("");
      }
      
      // Set target date if it exists
      if (goal.targetDate) {
        const date = new Date(goal.targetDate);
        const formattedDate = date.toISOString().split('T')[0];
        setTargetDate(formattedDate);
        console.log('Set target date:', formattedDate, 'from:', goal.targetDate);
      } else {
        setTargetDate("");
        console.log('No target date found, setting to empty');
      }
      setTerm(goal.term ?? 'backlog');
    }
  }, [isOpen, lifeMetrics, goal]);

  const handleSave = () => {
    if (!title?.trim()) return;

    const updates: any = {
      title: title.trim(),
      description: description.trim(),
      targetDate: targetDate || null, // Include target date (null if empty)
      term: term === 'backlog' ? null : term,
    };

    // Only include lifeMetricId if we have a resolved value;
    // otherwise keep the existing life metric unchanged.
    if (lifeMetricId) {
      updates.lifeMetricId = lifeMetricId;
    }

    console.log('Saving goal updates:', updates);
    onSave(goal.id, updates);
    onClose();
  };

  const handleClose = () => {
    // Reset form to original values
    setTitle(goal.title);
    setDescription(goal.description || "");
    
    // Reset life metric to the current goal's life metric
    if (lifeMetrics.length > 0) {
      const currentLifeMetric = lifeMetrics.find((metric: any) => 
        metric.name === goal.lifeMetric.name
      );
      if (currentLifeMetric) {
        setLifeMetricId(currentLifeMetric.id);
      }
    }
    
    // Reset target date to original value
    if (goal.targetDate) {
      const date = new Date(goal.targetDate);
      const formattedDate = date.toISOString().split('T')[0];
      setTargetDate(formattedDate);
    } else {
      setTargetDate("");
    }

    setTerm(goal.term ?? 'backlog');
    
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
            <Select
              value={lifeMetricId || undefined}
              onValueChange={setLifeMetricId}
            >
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

          <div>
            <Label htmlFor="term">Start timeline</Label>
            <Select
              value={term}
              onValueChange={(value: 'short' | 'mid' | 'long' | 'backlog') =>
                setTerm(value)
              }
            >
              <SelectTrigger id="term">
                <SelectValue
                  placeholder="Choose when you’d like to start"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backlog">Backlog (not scheduled yet)</SelectItem>
                <SelectItem value="short">Short term (next few weeks)</SelectItem>
                <SelectItem value="mid">Mid term (next 1–3 months)</SelectItem>
                <SelectItem value="long">Long term (3+ months)</SelectItem>
              </SelectContent>
            </Select>
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