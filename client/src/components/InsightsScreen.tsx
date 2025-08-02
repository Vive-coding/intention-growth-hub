
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThumbsUp, ThumbsDown, Filter } from "lucide-react";
import { useLifeMetricView } from "@/hooks/useLifeMetricView";
import { insightsService } from "@/services/insightsService";
import type { Insight } from "@/services/insightsService";
import { useLocation } from "wouter";

const lifeMetrics = [
  "All",
  "Health & Fitness",
  "Career Growth",
  "Personal Development",
  "Relationships",
  "Finance"
];

export const InsightsScreen = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { clearMetricFilter } = useLifeMetricView();

  // Get metric filter from URL
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const metricFilter = urlParams.get('metric');

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    setIsLoading(true);
    const data = await insightsService.getInsights();
    setInsights(data);
    setIsLoading(false);
  };

  const handleVote = async (insightId: string, isUpvote: boolean) => {
    const result = await insightsService.voteOnInsight(insightId, isUpvote);
    if (result) {
      setInsights(insights.map(insight => {
        if (insight.id === insightId) {
          return {
            ...insight,
            upvotes: result.upvotes,
            downvotes: result.downvotes,
            userVote: result.userVote,
          };
        }
        return insight;
      }));
    }
  };

  const handleArchiveGoal = async (goalId: string, insightId: string) => {
    const success = await insightsService.archiveGoal(goalId);
    if (success) {
      setInsights(insights.map(insight => {
        if (insight.id === insightId) {
          return {
            ...insight,
            suggestedGoals: insight.suggestedGoals.map(goal => {
              if (goal.id === goalId) {
                return { ...goal, archived: true };
              }
              return goal;
            }),
          };
        }
        return insight;
      }));
    }
  };

  const handleArchiveHabit = async (habitId: string, insightId: string) => {
    const success = await insightsService.archiveHabit(habitId);
    if (success) {
      setInsights(insights.map(insight => {
        if (insight.id === insightId) {
          return {
            ...insight,
            suggestedHabits: insight.suggestedHabits.map(habit => {
              if (habit.id === habitId) {
                return { ...habit, archived: true };
              }
              return habit;
            }),
          };
        }
        return insight;
      }));
    }
  };

  // Set initial filter from URL parameter
  useEffect(() => {
    if (metricFilter && selectedFilter === "All") {
      setSelectedFilter(metricFilter);
    }
  }, [metricFilter, selectedFilter]);

  const filteredInsights = selectedFilter === "All" 
    ? insights 
    : insights.filter(insight => 
        insight.lifeMetrics.some(metric => metric.name === selectedFilter)
      );

  const renderInsightCard = (insight: Insight) => (
    <Card key={insight.id} className="h-full flex flex-col">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-wrap gap-1">
            {insight.lifeMetrics.map(metric => (
              <Badge key={metric.id} variant="outline" style={{ borderColor: metric.color, color: metric.color }}>
                {metric.name}
              </Badge>
            ))}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {insight.confidence}% confident
          </Badge>
        </div>
        <CardTitle className="text-xl leading-tight">{insight.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <p className="text-base text-muted-foreground leading-relaxed">
          {insight.explanation}
        </p>
        {(insight.suggestedGoals.length > 0 || insight.suggestedHabits.length > 0) && (
          <div className="space-y-2">
            {insight.suggestedGoals
              .filter(goal => !goal.archived)
              .map(goal => (
                <div key={goal.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Badge variant="outline" className="mr-2 bg-blue-50 text-blue-700">
                      Suggested Goal
                    </Badge>
                    <span className="text-sm">{goal.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleArchiveGoal(goal.id, insight.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Archive
                  </Button>
                </div>
              ))}
            {insight.suggestedHabits
              .filter(habit => !habit.archived)
              .map(habit => (
                <div key={habit.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Badge variant="outline" className="mr-2 bg-green-50 text-green-700">
                      Suggested Habit
                    </Badge>
                    <span className="text-sm">{habit.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleArchiveHabit(habit.id, insight.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Archive
                  </Button>
                </div>
              ))}
          </div>
        )}
        <div className="flex justify-end space-x-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleVote(insight.id, true)}
            className={`hover:bg-green-50 ${
              insight.userVote === true ? 'text-green-600' : 'text-gray-500'
            }`}
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleVote(insight.id, false)}
            className={`hover:bg-red-50 ${
              insight.userVote === false ? 'text-red-600' : 'text-gray-500'
            }`}
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
              {metricFilter ? `${metricFilter} Insights` : "Your Insights"}
            </h1>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-500">Filter by Life Metric:</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {lifeMetrics.map((metric) => (
              <Button
                key={metric}
                variant={selectedFilter === metric ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter(metric)}
                className={selectedFilter === metric ? "" : "text-gray-600"}
              >
                {metric}
              </Button>
            ))}
          </div>

          {isProcessing && (
            <Alert className="mb-6">
              <AlertDescription>
                Processing new insights from your latest journal entry...
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInsights.map(insight => renderInsightCard(insight))}
        </div>

        {filteredInsights.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <p className="text-gray-600">
              No insights found for the selected life metric.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
