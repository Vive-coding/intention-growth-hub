import { ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
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

interface InsightCardProps {
  title: string;
  explanation: string;
  confidence: number;
  suggestedGoals?: Array<{ title: string; description?: string }>;
  suggestedHabits?: Array<{ title: string; description?: string }>;
  onVote?: (isUpvote: boolean) => void;
}

export function InsightCard({
  title,
  explanation,
  confidence,
  suggestedGoals = [],
  suggestedHabits = [],
  onVote,
}: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 150;
  const shouldTruncate = explanation.length > maxLength;
  const displayText = isExpanded ? explanation : explanation.substring(0, maxLength) + (shouldTruncate ? '...' : '');

  return (
    <Card className="w-full mb-4 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-xl flex-1">{title}</CardTitle>
        <Badge variant="secondary" className="ml-2 shrink-0">
          {confidence}% confident
        </Badge>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-3">
          <div>
            <CardDescription className="text-base leading-relaxed">
              {displayText}
            </CardDescription>
            {shouldTruncate && (
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
          
          {(suggestedGoals.length > 0 || suggestedHabits.length > 0) && (
            <div className="space-y-2 mt-4">
              {suggestedGoals.map((goal, index) => (
                <div key={`goal-${index}`} className="flex items-center">
                  <Badge variant="outline" className="mr-2 bg-blue-50 text-blue-700">
                    Suggested Goal
                  </Badge>
                  <span className="text-sm">{goal.title}</span>
                </div>
              ))}
              {suggestedHabits.map((habit, index) => (
                <div key={`habit-${index}`} className="flex items-center">
                  <Badge variant="outline" className="mr-2 bg-green-50 text-green-700">
                    Suggested Habit
                  </Badge>
                  <span className="text-sm">{habit.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onVote?.(true)}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onVote?.(false)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
} 