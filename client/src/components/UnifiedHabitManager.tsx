import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Flame, 
  Lightbulb, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  Target,
  Clock,
  TrendingUp,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Utility functions for habit priority and impact
const getPriorityLabel = (score: number) => {
  if (score >= 80) return { label: 'Needle Moving', color: 'bg-red-100 text-red-800 border-red-200' };
  if (score >= 60) return { label: 'High Priority', color: 'bg-orange-100 text-orange-800 border-orange-200' };
  return { label: 'Standard', color: 'bg-gray-100 text-gray-800 border-gray-200' };
};

const getImpactLabel = (impact: number) => {
  if (impact >= 70) return 'High';
  if (impact >= 40) return 'Medium';
  return 'Low';
};

const getImpactColor = (impact: number) => {
  if (impact >= 70) return 'bg-green-500';
  if (impact >= 40) return 'bg-yellow-500';
  return 'bg-gray-500';
};

// Category importance weighting used in priority scoring
const getCategoryImportance = (category?: string): number => {
  if (!category) return 0;
  const categoryMap: Record<string, number> = {
    'health': 25,
    'career': 20,
    'relationships': 15,
    'finance': 15,
    'personal-development': 10,
    'mental-health': 20,
  };
  const key = category.toLowerCase();
  return categoryMap[key] || 0;
};

interface Habit {
  id: string;
  title: string;
  description?: string;
  category?: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  metric?: { id: string; name: string; color: string };
  goalId?: string;
}

interface SmartSuggestion {
  id: string;
  title: string;
  reason: string;
  impact: number;
  effortMinutes: number;
  confidence: number;
  urgency: number;
  metric?: { id: string; name: string; color: string };
  goalId?: string;
  habitId?: string;
  priorityScore: number;
}

interface UnifiedHabitManagerProps {
  todaysHabits: Habit[];
  smartSuggestions: SmartSuggestion[];
  completedHabits: Habit[];
  onCompleteHabits: (habitIds: string[]) => void;
  onToggleHabitSelection: (habitId: string) => void;
  selectedHabitIds: string[];
  showHabitModal?: boolean;
  onShowHabitModalChange?: (show: boolean) => void;
}

export function UnifiedHabitManager({
  todaysHabits,
  smartSuggestions,
  completedHabits,
  onCompleteHabits,
  onToggleHabitSelection,
  selectedHabitIds,
  showHabitModal = false,
  onShowHabitModalChange
}: UnifiedHabitManagerProps) {
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [internalShowHabitModal, setInternalShowHabitModal] = useState(false);
  const [showSortInfo, setShowSortInfo] = useState(false);
  
  // Debug logging for completed habits
  console.log('🟣 UnifiedHabitManager received completedHabits:', {
    count: completedHabits.length,
    habits: completedHabits.map(h => ({ id: h.id, title: h.title }))
  });
  
  // Use external control if provided, otherwise use internal state
  const modalOpen = showHabitModal !== undefined ? showHabitModal : internalShowHabitModal;
  console.log('UnifiedHabitManager: modal state:', { 
    showHabitModal, 
    internalShowHabitModal, 
    modalOpen, 
    hasOnShowHabitModalChange: !!onShowHabitModalChange,
    hasShowHabitModal: showHabitModal !== undefined
  });
  
  // Debug: log when modal should render
  console.log('UnifiedHabitManager: should render modal?', modalOpen);
  
  const setModalOpen = (show: boolean) => {
    console.log('UnifiedHabitManager: setModalOpen called with:', show);
    if (onShowHabitModalChange) {
      console.log('UnifiedHabitManager: calling external onShowHabitModalChange');
      onShowHabitModalChange(show);
    } else {
      console.log('UnifiedHabitManager: using internal state');
      setInternalShowHabitModal(show);
    }
  };

  // Calculate priority scores for habits
  const prioritizedHabits = useMemo(() => {
    return todaysHabits.map(habit => {
      // Base score from smart suggestions if available
      const suggestion = smartSuggestions.find(s => s.habitId === habit.id);
      let baseScore = suggestion?.priorityScore || 50;
      
      // Streak multiplier (maintaining streaks is important)
      const streakMultiplier = 1 + (habit.currentStreak * 0.1);
      
      // Impact boost for habits that move the needle forward
      const impactBoost = habit.currentStreak > 0 ? 20 : 0; // Active streaks get priority
      
      // Category importance (some areas are more critical)
      const categoryBoost = getCategoryImportance(habit.category);
      
      const finalScore = (baseScore + impactBoost + categoryBoost) * streakMultiplier;
      
      return {
        ...habit,
        priorityScore: finalScore,
        suggestion
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  }, [todaysHabits, smartSuggestions]);

  // Group habits by priority level
  const needleMovingHabits = prioritizedHabits.filter(h => h.priorityScore >= 80);
  const highPriorityHabits = prioritizedHabits.filter(h => h.priorityScore >= 60 && h.priorityScore < 80);
  const standardHabits = prioritizedHabits.filter(h => h.priorityScore < 60);



  // Show component even when no habits, but with different content
  const hasAnyHabits = todaysHabits.length > 0 || completedHabits.length > 0;

  return (
    <div className="space-y-6">
      {/* Main Habit Management Card */}
      <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-2">
            {/* Header (cleaner, matches earlier style) */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-gray-800">
                  Complete Habits
                </CardTitle>
                <p className="text-xs text-gray-600">Track your daily progress and maintain streaks</p>
              </div>
            </div>

            {/* CTA */}
            {todaysHabits.length > 0 && (
              <div className="px-4 w-full flex flex-col items-center justify-center gap-1">
                <Button 
                  onClick={() => {
                    console.log('UnifiedHabitManager: Mark Complete button clicked, setting modalOpen to true');
                    setModalOpen(true);
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white w-[80%]"
                  size="default"
                >
                  Mark Complete
                </Button>
                <span className="text-[11px] text-gray-600">{todaysHabits.length} remaining</span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Minimal sidebar content; lists moved into modal */}
          {!hasAnyHabits && (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No habits set up yet</p>
              <p className="text-xs text-gray-400 mt-1">Create habits to start tracking your progress</p>
            </div>
          )}

          {/* Completed Habits Section */}
          {completedHabits.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <Collapsible open={isCompletedOpen} onOpenChange={setIsCompletedOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">
                        Completed Today ({completedHabits.length})
                      </span>
                    </div>
                    {!isCompletedOpen ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-2">
                  {completedHabits.map((habit) => (
                    <div
                      key={habit.id}
                      className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-100"
                    >
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-800">{habit.title}</h4>
                        {habit.description && (
                          <p className="text-xs text-gray-600 mt-1">{habit.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <Flame className="w-3 h-3 text-orange-500" />
                        <span>{habit.currentStreak}</span>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Habit Completion Modal */}
      {modalOpen && (
        <HabitCompletionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          habits={prioritizedHabits as any}
          selectedHabitIds={selectedHabitIds}
          onToggleSelection={onToggleHabitSelection}
          onComplete={onCompleteHabits}
        />
      )}
    </div>
  );
}

interface HabitCardProps {
  habit: Habit & { priorityScore: number; suggestion?: SmartSuggestion };
  priority: 'needle-moving' | 'high' | 'standard';
  isSelected: boolean;
  onToggleSelection: () => void;
  suggestion?: SmartSuggestion;
}

function HabitCard({ habit, priority, isSelected, onToggleSelection, suggestion }: HabitCardProps) {
  const priorityConfig = getPriorityLabel(habit.priorityScore);
  
  return (
    <div className={cn(
      "p-3 rounded-lg border transition-all duration-200",
      priority === 'needle-moving' && "bg-red-50 border-red-200 hover:bg-red-100",
      priority === 'high' && "bg-orange-50 border-orange-200 hover:bg-orange-100",
      priority === 'standard' && "bg-gray-50 border-gray-200 hover:bg-gray-100"
    )}>
      <div className="flex items-start space-x-3">
        <Flame className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
        <Checkbox
          id={`habit-${habit.id}`}
          checked={isSelected}
          onCheckedChange={onToggleSelection}
          className="mt-0.5"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium text-gray-800 text-sm">{habit.title}</h4>
            <Badge variant="outline" className={cn("text-xs", priorityConfig.color)}>
              {priorityConfig.label}
            </Badge>
          </div>
          
          {habit.description && (
            <p className="text-xs text-gray-600 mb-2">{habit.description}</p>
          )}
          
          {/* Smart Suggestion Context */}
          {suggestion && (
            <div className="bg-blue-50 border border-blue-100 rounded p-2 mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-800">AI Suggestion</span>
                <span className="text-xs text-blue-600">{suggestion.reason}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-blue-200 bg-white text-blue-700">
                  <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", getImpactColor(suggestion.impact))}></span>
                  {getImpactLabel(suggestion.impact)} impact • {suggestion.effortMinutes}m
                </span>
              </div>
            </div>
          )}
          
          {/* Habit Stats */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Flame className="w-3 h-3 text-orange-500" />
                <span>{habit.currentStreak ?? 0} day streak</span>
              </div>
              <div className="flex items-center space-x-1">
                <Target className="w-3 h-3 text-blue-500" />
                <span>{habit.totalCompletions ?? 0} total</span>
              </div>
            </div>
            {habit.metric && (
              <Badge variant="outline" className="text-xs" style={{ 
                borderColor: habit.metric.color,
                color: habit.metric.color 
              }}>
                {habit.metric.name}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface HabitCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  habits: Array<Habit & { priorityScore?: number; suggestion?: SmartSuggestion }>;
  selectedHabitIds: string[];
  onToggleSelection: (habitId: string) => void;
  onComplete: (habitIds: string[]) => void;
}

function HabitCompletionModal({
  isOpen,
  onClose,
  habits,
  selectedHabitIds,
  onToggleSelection,
  onComplete
}: HabitCompletionModalProps) {
  const handleComplete = () => {
    console.log('HabitCompletionModal: handleComplete called with selectedHabitIds:', selectedHabitIds);
    if (selectedHabitIds.length > 0) {
      console.log('HabitCompletionModal: calling onComplete with:', selectedHabitIds);
      onComplete(selectedHabitIds);
      onClose();
    } else {
      console.log('HabitCompletionModal: no habits selected, not calling onComplete');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 text-orange-600" />
            <h2 className="text-lg font-semibold">Complete Today's Habits</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Select the habits you've completed today
          </p>
        </div>
        {/* Grouped, priority-sorted lists */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto min-h-0">
          {/* Needle Moving */}
          {(() => {
            const top = habits.filter(h => (h as any).priorityScore ? (h as any).priorityScore >= 80 : false);
            return top.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700">Needle Moving</span>
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">{top.length} habits</Badge>
                </div>
                <div className="space-y-3">
                  {top.map((habit: any) => (
                    <ModalHabitRow key={habit.id} habit={habit} selected={selectedHabitIds.includes(habit.id)} onToggle={() => onToggleSelection(habit.id)} />
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* High Priority */}
          {(() => {
            const high = habits.filter(h => (h as any).priorityScore ? (h as any).priorityScore >= 60 && (h as any).priorityScore < 80 : true);
            return high.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-orange-700">High Priority</span>
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">{high.length} habits</Badge>
                </div>
                <div className="space-y-3">
                  {high.map((habit: any) => (
                    <ModalHabitRow key={habit.id} habit={habit} selected={selectedHabitIds.includes(habit.id)} onToggle={() => onToggleSelection(habit.id)} />
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Standard */}
          {(() => {
            const standard = habits.filter(h => (h as any).priorityScore ? (h as any).priorityScore < 60 : false);
            return standard.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Standard</span>
                  <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">{standard.length} habits</Badge>
                </div>
                <div className="space-y-3">
                  {standard.map((habit: any) => (
                    <ModalHabitRow key={habit.id} habit={habit} selected={selectedHabitIds.includes(habit.id)} onToggle={() => onToggleSelection(habit.id)} />
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>
        
        <div className="p-4 sm:p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-3 flex-shrink-0 bg-white">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button 
            onClick={handleComplete}
            disabled={selectedHabitIds.length === 0}
            className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto"
          >
            Complete Selected ({selectedHabitIds.length})
          </Button>
        </div>
      </div>
    </div>
  );
}

// Modal row with streak/total and optional impact chip
function ModalHabitRow({ habit, selected, onToggle }: { habit: any; selected: boolean; onToggle: () => void }) {
  const impactLabel = habit?.suggestion ? getImpactLabel(habit.suggestion.impact) : undefined;
  const impactColor = habit?.suggestion ? getImpactColor(habit.suggestion.impact) : 'bg-gray-400';
  const showImpact = !!habit?.suggestion;
  return (
    <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <Checkbox
        id={`modal-habit-${habit.id}`}
        checked={selected}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-800 text-sm">{habit.title}</h4>
          {showImpact && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-blue-200 bg-white text-blue-700">
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${impactColor}`}></span>
              {impactLabel} impact • {habit.suggestion.effortMinutes}m
            </span>
          )}
        </div>
        {habit.description && (
          <p className="text-xs text-gray-600 mt-1">{habit.description}</p>
        )}
        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600">
          <span>Streak: {habit.currentStreak ?? 0}</span>
          <span>Total: {habit.totalCompletions ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
