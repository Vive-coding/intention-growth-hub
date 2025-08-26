import { Alert, AlertDescription } from "@/components/ui/alert";
import { InsightCard } from "@/components/insights/InsightCard";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export default function InsightsPage() {
  const { isAuthenticated } = useAuth();
  const isProcessing = false; // Will be controlled by API later

  console.log('InsightsPage - isAuthenticated:', isAuthenticated);

  // Fetch insights from database
  const { data: insights = [], isLoading, error } = useQuery({
    queryKey: ['insights-page', '/api/insights'],
    queryFn: async () => {
      console.log('InsightsPage - Making API call to /api/insights');
      return apiRequest('/api/insights');
    },
    retry: 1,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // Fetch life metrics for filtering
  const { data: lifeMetrics = [] } = useQuery({
    queryKey: ['insights-page', '/api/life-metrics'],
    queryFn: async () => {
      return apiRequest('/api/life-metrics');
    },
    retry: 1,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  const handleVote = (insightId: string, isUpvote: boolean) => {
    console.log(`Voted ${isUpvote ? 'up' : 'down'} for insight ${insightId}`);
  };

  // Group insights by life metric
  const insightsByMetric = insights.reduce((acc: any, insight: any) => {
    const metricName = insight.lifeMetrics?.[0]?.name || 'Uncategorized';
    if (!acc[metricName]) {
      acc[metricName] = [];
    }
    acc[metricName].push(insight);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8">
          <div className="text-gray-600">Loading insights...</div>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('InsightsPage - Error:', error);
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8">
          <div className="text-red-600">Failed to load insights. Please try again.</div>
          <div className="text-sm text-gray-500 mt-2">Error: {error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      {isProcessing && (
        <Alert>
          <AlertDescription>
            Processing new insights from your latest journal entry...
          </AlertDescription>
        </Alert>
      )}

      {Object.entries(insightsByMetric).map(([metricName, metricInsights]) => (
        <div key={metricName} className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">{metricName}</h2>
          <div className="space-y-4">
            {(metricInsights as any[]).map((insight) => (
              <InsightCard
                key={insight.id}
                id={insight.id}
                title={insight.title}
                explanation={insight.explanation}
                confidence={insight.confidence}
                lifeMetrics={insight.lifeMetrics}
                suggestedGoals={insight.suggestedGoals || []}
                suggestedHabits={insight.suggestedHabits || []}
                onVote={(isUpvote) => handleVote(insight.id, isUpvote)}
                mode="full"
                kind={insight.kind}
                relatedTitle={insight.relatedTitle}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 