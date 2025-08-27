
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InsightCard } from "@/components/insights/InsightCard";
import { ThumbsUp, ThumbsDown, Filter } from "lucide-react";
import { useLifeMetricView } from "@/hooks/useLifeMetricView";
import { Logo } from "@/components/ui/Logo";
import { insightsService } from "@/services/insightsService";
import type { Insight } from "@/services/insightsService";
import { useLocation } from "wouter";

const defaultLifeMetrics = [
  "All",
  "Health & Fitness 🏃‍♀️",
  "Career Growth 🚀",
  "Personal Development 🧠",
  "Relationships ❤️",
  "Finance 💰",
  "Mental Health 🧘‍♂️",
];

export const InsightsScreen = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [voteFilter, setVoteFilter] = useState<'all' | 'upvoted' | 'downvoted' | 'unvoted'>("all");
  const [metricOptions, setMetricOptions] = useState<string[]>(defaultLifeMetrics);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [votedMap, setVotedMap] = useState<Record<string, boolean>>({});
  const [lastActionMap, setLastActionMap] = useState<Record<string, 'upvote' | 'downvote' | null>>({});
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
    // Fetch voted status for these insights
    try {
      if (data && data.length > 0) {
        const ids = data.map((i:any)=> i.id).join(',');
        console.log('[InsightsScreen] Fetching feedback status for ids', ids);
        const apiBaseUrl = import.meta.env.VITE_API_URL || '';
        let resp = await fetch(`${apiBaseUrl}/api/feedback/status?type=insight&ids=${ids}&t=${Date.now()}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            },
            cache: 'reload'
          }
        );
        if (resp.status === 304) {
          // Retry once with a fresh cache-buster if an intermediary still returns 304
          resp = await fetch(`${apiBaseUrl}/api/feedback/status?type=insight&ids=${ids}&t=${Date.now()}_${Math.random()}`,
            {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              },
              cache: 'reload'
            }
          );
        }
        if (resp.ok) {
          const json = await resp.json();
          console.log('[InsightsScreen] Feedback status response', json);
          setVotedMap(json.voted || {});
          setLastActionMap(json.lastAction || {});
          // Build dynamic metric options from data
          const fromData = Array.from(new Set((data || []).flatMap((i:any)=> (i.lifeMetrics||[]).map((m:any)=> m.name))));
          setMetricOptions(["All", ...Array.from(new Set([...fromData, ...defaultLifeMetrics.filter(m=>m!=='All')]))]);
        }
      }
    } catch {}
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
      // Update local maps immediately for UI persistence
      setVotedMap(prev => ({ ...prev, [insightId]: true }));
      setLastActionMap(prev => ({ ...prev, [insightId]: isUpvote ? 'upvote' : 'downvote' }));
      // Revalidate this id from server to ensure cross-session persistence
      try {
        const resp = await fetch(`${apiBaseUrl}/api/feedback/status?type=insight&ids=${insightId}&t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          cache: 'no-store'
        });
        if (resp.ok) {
          const json = await resp.json();
          setVotedMap(prev => ({ ...prev, ...json.voted }));
          setLastActionMap(prev => ({ ...prev, ...json.lastAction }));
        }
      } catch {}
    }
  };

  const handleDelete = async (insightId: string) => {
    const confirmed = window.confirm('Delete this insight? This will also remove its suggestions.');
    if (!confirmed) return;
    const success = await insightsService.deleteInsight(insightId);
    if (success) {
      setInsights(prev => prev.filter(i => i.id !== insightId));
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

  const filteredInsights = (selectedFilter === "All" 
    ? insights 
    : insights.filter(insight => 
        insight.lifeMetrics.some(metric => metric.name === selectedFilter)
      ))
      .filter((insight) => {
        const id = (insight as any).id as string;
        if (voteFilter === 'all') return true;
        const voted = !!votedMap[id];
        const action = lastActionMap[id];
        if (voteFilter === 'unvoted') return !voted;
        if (voteFilter === 'upvoted') return voted && action === 'upvote';
        if (voteFilter === 'downvoted') return voted && action === 'downvote';
        return true;
      })
      .slice()
      .sort((a:any,b:any)=> (b.confidence||0) - (a.confidence||0));

  const renderInsightCard = (insight: Insight) => (
    <InsightCard
      key={insight.id}
      id={insight.id}
      title={insight.title}
      explanation={insight.explanation}
      confidence={insight.confidence}
      lifeMetrics={insight.lifeMetrics}
      onVote={(isUpvote) => handleVote(insight.id, isUpvote)}
      onDelete={() => handleDelete(insight.id)}
      initialVoted={!!votedMap[insight.id]}
      onFeedbackRecorded={(_, action) => {
        setVotedMap(prev => ({ ...prev, [insight.id]: true }));
        if (action === 'upvote' || action === 'downvote') {
          setLastActionMap(prev => ({ ...prev, [insight.id]: action }));
        }
      }}
      lastAction={lastActionMap[insight.id] || null}
      mode="full"
      kind={(insight as any).kind as any}
      relatedTitle={(insight as any).relatedTitle as any}
    />
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Logo size="sm" className="text-gray-900" />
              <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
            </div>
            <Button variant="outline" disabled>
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-32"></div>
                    </div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3 mb-6">
            <Logo size="sm" className="text-gray-900" />
            <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
          </div>
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-500 mb-4">
                <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No insights yet</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Create your first journal entry to generate AI-powered insights that will help you understand your patterns and growth areas.
              </p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Start Journaling
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <Logo size="sm" className="text-gray-800" />
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
              {metricFilter ? `${metricFilter} Insights` : "Your Insights"}
            </h1>
          </div>

          <div className="mb-6 flex items-center gap-4 flex-wrap">
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Life Metric" />
              </SelectTrigger>
              <SelectContent>
                {metricOptions.map((metric) => (
                  <SelectItem key={metric} value={metric}>{metric}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={voteFilter} onValueChange={(v:any)=>setVoteFilter(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Vote filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All votes</SelectItem>
                <SelectItem value="upvoted">Voted - Upvote</SelectItem>
                <SelectItem value="downvoted">Voted - Downvote</SelectItem>
                <SelectItem value="unvoted">Unvoted</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-500">Sorted by confidence (high to low)</span>
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
