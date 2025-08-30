import { ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Trash } from "lucide-react";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ReinforcementBadge } from "@/components/ui/ReinforcementBadge";

// Custom pill color mapping for unique, meaningful colors
const getPillBackgroundColor = (metricName: string) => {
  if (metricName.includes('Health & Fitness')) return '#dcfce7'; // Light green
  if (metricName.includes('Career Growth')) return '#dbeafe'; // Light blue
  if (metricName.includes('Personal Development')) return '#f3e8ff'; // Light purple
  if (metricName.includes('Relationships')) return '#fed7aa'; // Light orange
  if (metricName.includes('Finance')) return '#fecaca'; // Light red
  if (metricName.includes('Mental Health')) return '#ccfbf1'; // Light teal
  return '#f3f4f6'; // Default light gray
};

const getPillTextColor = (metricName: string) => {
  if (metricName.includes('Health & Fitness')) return '#166534'; // Dark green
  if (metricName.includes('Career Growth')) return '#1e40af'; // Dark blue
  if (metricName.includes('Personal Development')) return '#7c3aed'; // Dark purple
  if (metricName.includes('Relationships')) return '#ea580c'; // Dark orange
  if (metricName.includes('Finance')) return '#dc2626'; // Dark red
  if (metricName.includes('Mental Health')) return '#0f766e'; // Dark teal
  return '#6b7280'; // Default dark gray
};


interface InsightCardProps {
  id?: string;
  title: string;
  explanation: string;
  confidence: number;
  lifeMetrics?: Array<{ id: string; name: string; color: string }>;
  suggestedGoals?: Array<{ title: string; description?: string }>;
  suggestedHabits?: Array<{ title: string; description?: string }>;
  onVote?: (isUpvote: boolean) => void;
  onDelete?: () => void;
  mode?: 'compact' | 'full';
  initialVoted?: boolean;
  onFeedbackRecorded?: (id?: string, action?: 'upvote' | 'downvote' | null) => void;
  feedbackContext?: Record<string, unknown>;
  lastAction?: 'upvote' | 'downvote' | null;
  kind?: 'new' | 'reinforce';
  relatedTitle?: string;
}

export function InsightCard({
  id,
  title,
  explanation,
  confidence,
  lifeMetrics = [],
  suggestedGoals = [],
  suggestedHabits = [],
  onVote,
  onDelete,
  mode = 'compact',
  initialVoted,
  onFeedbackRecorded,
  feedbackContext,
  lastAction = null,
  kind = 'new',
  relatedTitle,
}: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasVoted, setHasVoted] = useState(!!initialVoted);
  const [currentAction, setCurrentAction] = useState<'upvote' | 'downvote' | null>(lastAction as 'upvote' | 'downvote' | null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'upvote' | 'downvote' | null>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Keep internal voted state in sync if parent computes it later
  // (e.g., from feedback status endpoint)
  useEffect(() => {
    setHasVoted(!!initialVoted);
    setCurrentAction(lastAction as 'upvote' | 'downvote' | null);
  }, [initialVoted, lastAction]);

  const reasonsUp = [
    "Actionable",
    "Accurate",
    "Motivating",
    "Novel insight",
    "Well-written",
  ];
  const reasonsDown = [
    "Not relevant",
    "Inaccurate",
    "Repetitive",
    "Too generic",
    "Poorly written",
  ];

  const toggleReason = (r: string) => {
    setSelectedReasons(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const sendOptionalFeedback = async () => {
    try {
      console.log('[InsightCard] sendOptionalFeedback', { id, feedbackType, selectedReasons, notes });
      if (!id || !feedbackType) { setFeedbackOpen(false); return; }
      await apiRequest('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          type: 'insight',
          itemId: id,
          action: feedbackType === 'upvote' ? 'upvote_reason' : 'downvote_reason',
          context: { ...(feedbackContext || {}), reasons: selectedReasons, notes }
        })
      });
      // Note: On homepage, insight will be dismissed after feedback
      // On insights page, vote state will persist
    } catch {}
    setFeedbackOpen(false);
    setSelectedReasons([]);
    setNotes("");
    setFeedbackType(null);
    console.log('[InsightCard] onFeedbackRecorded after Send', id);
    onFeedbackRecorded?.(id, feedbackType);
  };
  // Details modal removed per design; can be re-enabled later if needed
  const maxLength = 220;
  const shouldTruncate = explanation.length > maxLength;
  const displayText = isExpanded ? explanation : explanation.substring(0, maxLength) + (shouldTruncate ? '...' : '');

  // Debug: verify reinforcement props when present
  if (kind === 'reinforce') {
    try { console.debug('[InsightCard] reinforce', { id, title, kind, relatedTitle }); } catch {}
  }

  const titleClass = mode === 'compact'
    ? 'text-sm font-semibold leading-snug text-gray-900'
    : 'text-lg font-semibold leading-snug text-gray-900';
  const bodyClass = mode === 'compact'
    ? 'text-xs leading-relaxed whitespace-pre-wrap text-gray-600'
    : 'text-sm leading-relaxed whitespace-pre-wrap text-gray-600';

  return (
    <Card className="w-full mb-3 h-full flex flex-col bg-white border border-gray-100 shadow-sm rounded-xl">
       <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex flex-wrap gap-1">
            {lifeMetrics.map((metric) => (
              <div
                key={metric.id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: getPillBackgroundColor(metric.name),
                  color: getPillTextColor(metric.name)
                }}
              >
                {metric.name}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="shrink-0 bg-gray-100 text-gray-700">
              {confidence}% confident
            </Badge>
          </div>
        </div>
        <CardTitle className={titleClass}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <div className="space-y-2">
          <div>
            <CardDescription className={bodyClass}>
              {mode === 'compact' ? displayText : explanation}
            </CardDescription>
            <ReinforcementBadge 
              kind={kind} 
              relatedType="insight" 
              relatedTitle={relatedTitle}
              className="mt-2"
            />
            {mode === 'compact' && shouldTruncate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-700"
              >
                {isExpanded ? (
                  <>
                    Show less <ChevronUp className="h-3 w-3 ml-1" />
                  </>
                ) : (
                  <>
                    Show more <ChevronDown className="h-3 w-3 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
          
          {/* Suggested goals/habits intentionally omitted in compact cards per design */}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center pt-2">
        <div>
          {/* Space for future badges or content */}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              onVote?.(true);
              // Fire-and-forget feedback event
              try {
                await apiRequest('/api/feedback', {
                  method: 'POST',
                  body: JSON.stringify({ type: 'insight', itemId: id, action: 'upvote', context: feedbackContext || {} })
                });
                // Note: On homepage, insight will be dismissed after feedback
                // On insights page, vote state will persist
              } catch {}
              setHasVoted(true);
              setCurrentAction('upvote');
              setFeedbackType('upvote');
              console.log('[InsightCard] Opening feedback dialog (upvote)', id);
              setFeedbackOpen(true);
            }}
            className={`${currentAction === 'upvote' 
              ? 'text-green-700 bg-green-100 hover:bg-green-200' 
              : 'text-green-600 hover:text-green-700 hover:bg-green-50'
            }`}
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              onVote?.(false);
              try {
                await apiRequest('/api/feedback', {
                  method: 'POST',
                  body: JSON.stringify({ type: 'insight', itemId: id, action: 'downvote', context: feedbackContext || {} })
                });
                // Note: On homepage, insight will be dismissed after feedback
                // On insights page, vote state will persist
              } catch {}
              setHasVoted(true);
              setCurrentAction('downvote');
              setFeedbackType('downvote');
              console.log('[InsightCard] Opening feedback dialog (downvote)', id);
              setFeedbackOpen(true);
            }}
            className={`${currentAction === 'downvote'
              ? 'text-red-700 bg-red-100 hover:bg-red-200'
              : 'text-red-600 hover:text-red-700 hover:bg-red-50'
            }`}
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-gray-500 hover:text-red-600 hover:bg-red-50"
              title="Delete insight"
            >
              <Trash className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardFooter>

      {/* Optional reasons dialog */}
      <Dialog
        open={feedbackOpen}
        onOpenChange={(open) => {
          setFeedbackOpen(open);
          if (!open) {
            // Treat closing without sending as a skip; parent can dismiss
            setSelectedReasons([]);
            setNotes("");
            setFeedbackType(null);
            console.log('[InsightCard] Dialog closed, calling onFeedbackRecorded (skip/close)', id);
            onFeedbackRecorded?.(id, feedbackType);
          }
        }}
      >
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Tell us more</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">Why did you {feedbackType === 'upvote' ? 'like' : 'dislike'} this insight?</div>
            <div className="flex flex-wrap gap-2">
              {(feedbackType === 'upvote' ? reasonsUp : reasonsDown).map(r => (
                <Badge
                  key={r}
                  variant={selectedReasons.includes(r) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleReason(r)}
                >
                  {r}
                </Badge>
              ))}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-500">Optional note</div>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add a short note…" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { console.log('[InsightCard] Skip clicked', id); setFeedbackOpen(false); onFeedbackRecorded?.(id, feedbackType); }}>Skip</Button>
              <Button onClick={sendOptionalFeedback}>Send</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
} 