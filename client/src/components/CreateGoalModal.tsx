import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { analytics } from "@/services/analyticsService";

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalCreated: () => void;
  defaultLifeMetric?: string;
  prefillData?: {
    title?: string;
    description?: string;
    lifeMetricId?: string;
    suggestedGoalId?: string;
  };
}

export const CreateGoalModal = ({
  isOpen,
  onClose,
  onGoalCreated,
  defaultLifeMetric,
  prefillData,
}: CreateGoalModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lifeMetricId, setLifeMetricId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  // Fetch life metrics for selection
  const { data: lifeMetrics = [], isLoading: lifeMetricsLoading, error: lifeMetricsError } = useQuery({
    queryKey: ['/api/life-metrics'],
    queryFn: async () => {
      console.log('CreateGoalModal - Fetching life metrics...');
      const result = await apiRequest('/api/life-metrics');
      console.log('CreateGoalModal - Life metrics result:', result);
      return result;
    },
    enabled: isOpen,
  });

  console.log('CreateGoalModal - Life metrics state:', { lifeMetrics, lifeMetricsLoading, lifeMetricsError });

  // If no life metrics exist, create default ones
  useEffect(() => {
    if (isOpen && lifeMetrics.length === 0 && !lifeMetricsLoading && !lifeMetricsError) {
      console.log('No life metrics found, creating default ones...');
      createDefaultLifeMetrics();
    }
  }, [isOpen, lifeMetrics.length, lifeMetricsLoading, lifeMetricsError]);

  const createDefaultLifeMetrics = async () => {
    const defaultMetrics = [
      { name: "Health & Fitness", color: "#10b981", description: "Physical and mental wellbeing" },
      { name: "Career Growth", color: "#3b82f6", description: "Professional development and skills" },
      { name: "Personal Development", color: "#8b5cf6", description: "Learning and self-improvement" },
      { name: "Relationships", color: "#f59e0b", description: "Social connections and relationships" },
      { name: "Finance", color: "#ef4444", description: "Financial planning and investments" },
      { name: "Mental Health", color: "#8b5cf6", description: "Emotional wellbeing and mental clarity" },
    ];

    try {
      for (const metric of defaultMetrics) {
        await apiRequest('/api/life-metrics', {
          method: 'POST',
          body: JSON.stringify(metric),
        });
      }
      console.log('Default life metrics created successfully');
      // Refresh the life metrics query
      queryClient.invalidateQueries({ queryKey: ['/api/life-metrics'] });
    } catch (error) {
      console.error('Error creating default life metrics:', error);
    }
  };

  // Handle both prefill data and default life metric when modal opens
  useEffect(() => {
    if (isOpen && lifeMetrics.length > 0) {
      console.log('📝 CreateGoalModal initialization:', {
        prefillData,
        defaultLifeMetric,
        lifeMetricsCount: lifeMetrics.length
      });
      
      // Priority 1: Handle prefill data if provided
      if (prefillData) {
        console.log('🎯 Processing prefill data:', prefillData);
        
        // Set basic fields
        if (prefillData.title) {
          setTitle(prefillData.title);
          console.log('✅ Set title to:', prefillData.title);
        }
        if (prefillData.description) {
          setDescription(prefillData.description);
          console.log('✅ Set description to:', prefillData.description);
        }
        
        // Handle life metric ID with enhanced debugging
        if (prefillData.lifeMetricId) {
          console.log('🔍 Trying to find life metric by ID:', prefillData.lifeMetricId);
          console.log('📊 Available life metrics:', lifeMetrics.map((m: any) => ({ id: m.id, name: m.name })));
          
          const foundById = lifeMetrics.find((metric: any) => metric.id === prefillData.lifeMetricId);
          if (foundById) {
            setLifeMetricId(prefillData.lifeMetricId);
            console.log('✅ PREFILL SUCCESS: Set lifeMetricId by ID to:', prefillData.lifeMetricId, '(', foundById.name, ')');
            return; // Exit early, prefill successful
          } else {
            console.warn('❌ Life metric not found by ID:', prefillData.lifeMetricId);
            console.log('🔄 Trying to find by name as fallback...');
            
            // Try to find by name as fallback
            const foundByName = lifeMetrics.find((metric: any) => 
              metric.name === prefillData.lifeMetricId || 
              metric.name.toLowerCase() === prefillData.lifeMetricId?.toLowerCase()
            );
            
            if (foundByName) {
              setLifeMetricId(foundByName.id);
              console.log('✅ PREFILL FALLBACK SUCCESS: Set lifeMetricId by name:', foundByName.id, '(', foundByName.name, ')');
              return; // Exit early, prefill successful
            } else {
              console.error('❌ PREFILL FAILED: Could not find life metric by ID or name:', prefillData.lifeMetricId);
              // Continue to default logic below
            }
          }
        }
      }
      
      // Priority 2: Handle default life metric if no prefill or prefill failed
      if (defaultLifeMetric) {
        console.log('🎯 Processing default life metric:', defaultLifeMetric);
        const defaultMetric = lifeMetrics.find((metric: any) => 
          metric.name === defaultLifeMetric
        );
        if (defaultMetric) {
          setLifeMetricId(defaultMetric.id);
          console.log('✅ DEFAULT SUCCESS: Set default life metric:', defaultMetric.name, 'ID:', defaultMetric.id);
        } else {
          console.warn('❌ DEFAULT FAILED: Could not find default life metric:', defaultLifeMetric);
        }
      }
    }
  }, [isOpen, lifeMetrics, prefillData, defaultLifeMetric]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('CreateGoalModal handleSubmit called');
    console.log('Title:', title);
    console.log('LifeMetricId:', lifeMetricId);
    console.log('Description:', description);
    console.log('TargetDate:', targetDate);
    
    if (!title?.trim() || !lifeMetricId) {
      console.log('Validation failed - missing title or lifeMetricId');
      return;
    }

    setLoading(true);

    try {
      const goalData = {
        title: title.trim(),
        description: description.trim(),
        lifeMetricId,
        targetValue: 1, // Goals are always percentage-based (0-100%)
        targetDate: targetDate || null,
      };

      console.log('Sending goal data:', goalData);

      const response = await apiRequest('/api/goals', {
        method: 'POST',
        body: JSON.stringify(goalData),
      });

      console.log('Goal creation response:', response);

      // Track goal creation
      analytics.trackGoalCreated(response.id, {
        goal_title: title,
        life_metric: selectedLifeMetric?.name,
        has_description: !!description,
        has_target_date: !!targetDate,
        from_suggestion: !!prefillData?.suggestedGoalId,
      });

      // Reset form
      setTitle("");
      setDescription("");
      setLifeMetricId("");
      setTargetDate("");
      
      // Archive the suggested goal if this came from suggestions
      try {
        if (prefillData?.suggestedGoalId) {
          await apiRequest(`/api/insights/goals/${prefillData.suggestedGoalId}/archive`, { method: 'POST' });
          
          // Also dismiss via feedback system to ensure it's hidden from home screen
          await apiRequest('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'suggested_goal',
              itemId: prefillData.suggestedGoalId,
              action: 'dismiss',
              context: { 
                dismissedAt: new Date().toISOString(),
                reason: 'implemented'
              }
            })
          });
          
          // Invalidate feedback status queries to refresh the UI
          queryClient.invalidateQueries({ queryKey: ['/api/feedback/status'] });
          // Also invalidate the specific query with suggestedGoals dependency
          queryClient.invalidateQueries({ 
            predicate: (query) => 
              Array.isArray(query.queryKey) && 
              query.queryKey[0] === '/api/feedback/status'
          });
        }
      } catch (e) {
        console.warn('Could not archive/dismiss suggested goal after creation:', e);
      }
      onGoalCreated();
      onClose();
    } catch (error) {
      console.error('Error creating goal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setTitle("");
    setDescription("");
    setLifeMetricId("");
    setTargetDate("");
    onClose();
  };

  console.log('CreateGoalModal render - isOpen:', isOpen, 'defaultLifeMetric:', defaultLifeMetric);
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Goal</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Goal Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Improve Sleep Quality"
              required
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
            <Label htmlFor="lifeMetric">Life Metric *</Label>
            <Select value={lifeMetricId} onValueChange={setLifeMetricId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a life metric" />
              </SelectTrigger>
              <SelectContent>
                {lifeMetrics.map((metric: any) => (
                  <SelectItem key={metric.id} value={metric.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: metric.color }}
                      ></span>
                      {metric.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>



          <div>
            <Label htmlFor="targetDate">Target Date</Label>
            <Input
              id="targetDate"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !title.trim() || !lifeMetricId}>
              {loading ? "Creating..." : "Create Goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}; 