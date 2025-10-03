import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, TrendingDown, Target, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HabitToArchive {
  id: string;
  name: string;
  reason: string;
}

interface HabitToCreate {
  name: string;
  description: string;
  category: string;
  isHighLeverage: boolean;
  applicableGoalTypes: string[];
  targetFrequency: string;
  targetCount: number;
  consolidates: string[];
  coversGoals: string[];
}

interface OptimizationSummary {
  habitsBefore: number;
  habitsAfter: number;
  goalsFullyCovered: number;
  estimatedTimeReduction: string;
  optimizationRationale: string;
}

interface OptimizationProposal {
  habitsToArchive: HabitToArchive[];
  habitsToCreate: HabitToCreate[];
  summary: OptimizationSummary;
  orphanedHabitsArchived?: number;
  orphanedHabitNames?: string[];
}

interface OptimizeHabitsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OptimizeHabitsModal({ open, onClose, onSuccess }: OptimizeHabitsModalProps) {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [proposal, setProposal] = useState<OptimizationProposal | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch optimization analysis when modal opens
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    setProposal(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch("/api/goals/habits/optimize/analyze", {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to analyze habits");
      }

      const data = await response.json();
      setProposal(data);
    } catch (err: any) {
      console.error("Error analyzing habits:", err);
      setError(err.message || "Failed to analyze habits. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Execute the optimization
  const handleOptimize = async () => {
    if (!proposal) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch("/api/goals/habits/optimize/execute", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ proposal }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to optimize habits");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error optimizing habits:", err);
      setError(err.message || "Failed to optimize habits. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze when modal opens
  useEffect(() => {
    if (open && !proposal && !analyzing && !error) {
      handleAnalyze();
    }
  }, [open]); // Only trigger when modal opens

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Optimize Your Habits
          </DialogTitle>
          <DialogDescription>
            AI-powered analysis to help you maintain fewer, more powerful habits while achieving all your
            goals.
          </DialogDescription>
        </DialogHeader>

        {/* Loading State */}
        {analyzing && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyzing your habits and goals...</p>
            <p className="text-sm text-muted-foreground">This may take 10-30 seconds</p>
          </div>
        )}

        {/* Error State */}
        {error && !analyzing && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="bg-destructive/10 text-destructive rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Analysis Failed</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
            <Button onClick={handleAnalyze} variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {/* Proposal View */}
        {proposal && !analyzing && (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-2xl font-bold text-destructive">
                    {proposal.summary.habitsBefore}
                  </div>
                  <div className="text-xs text-muted-foreground">Current Habits</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-2xl font-bold text-primary">
                    {proposal.summary.habitsAfter}
                  </div>
                  <div className="text-xs text-muted-foreground">After Optimization</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-2xl font-bold flex items-center gap-1">
                    <TrendingDown className="w-5 h-5 text-green-500" />
                    {((1 - proposal.summary.habitsAfter / proposal.summary.habitsBefore) * 100).toFixed(0)}
                    %
                  </div>
                  <div className="text-xs text-muted-foreground">Reduction</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="text-2xl font-bold text-green-500">
                    {proposal.summary.goalsFullyCovered}
                  </div>
                  <div className="text-xs text-muted-foreground">Goals Covered</div>
                </CardContent>
              </Card>
            </div>

            {/* Orphaned Habits Auto-Archived Info */}
            {proposal.orphanedHabitsArchived !== undefined && proposal.orphanedHabitsArchived > 0 && (
              <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Auto-archived {proposal.orphanedHabitsArchived} orphaned habit{proposal.orphanedHabitsArchived !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        These habits weren't linked to any active goals. They're now archived but can be re-added to future goals.
                      </p>
                      {proposal.orphanedHabitNames && proposal.orphanedHabitNames.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {proposal.orphanedHabitNames.slice(0, 5).map((name, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700">
                              {name}
                            </Badge>
                          ))}
                          {proposal.orphanedHabitNames.length > 5 && (
                            <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700">
                              +{proposal.orphanedHabitNames.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

              {/* Changes Grid */}
            <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
              {/* Habits to Archive */}
              <Card className="flex flex-col overflow-hidden">
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    Archive ({proposal.habitsToArchive.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden px-0">
                  <ScrollArea className="h-full px-6">
                    <div className="space-y-3">
                      {proposal.habitsToArchive.map((habit) => (
                        <div
                          key={habit.id}
                          className="border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50 dark:bg-red-950"
                        >
                          <div className="font-medium text-sm">{habit.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">{habit.reason}</div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Habits to Create */}
              <Card className="flex flex-col overflow-hidden">
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Create ({proposal.habitsToCreate.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden px-0">
                  <ScrollArea className="h-full px-6">
                    <div className="space-y-3">
                      {proposal.habitsToCreate.map((habit, idx) => (
                        <div
                          key={idx}
                          className="border border-green-200 dark:border-green-800 rounded-lg p-3 bg-green-50 dark:bg-green-950"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm">{habit.name}</div>
                            {habit.isHighLeverage && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                <Sparkles className="w-3 h-3 mr-1" />
                                High Leverage
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{habit.description}</div>
                          <div className="flex items-center gap-2 mt-2 text-xs">
                            <Badge variant="outline" className="text-xs">
                              {habit.targetFrequency}
                            </Badge>
                            <span className="text-muted-foreground">
                              Covers {habit.coversGoals.length} goals
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t flex-shrink-0">
              <div className="text-sm text-muted-foreground">
                Time saved: <span className="font-medium">{proposal.summary.estimatedTimeReduction}</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={onClose} variant="outline" disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={handleOptimize} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Optimize Habits
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

