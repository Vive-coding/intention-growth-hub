import { Alert, AlertDescription } from "@/components/ui/alert";
import { InsightCard } from "@/components/insights/InsightCard";
import { useQuery } from "@tanstack/react-query";

export default function InsightsPage() {
  const isProcessing = false; // Will be controlled by API later

  // Fetch insights from database
  const { data: insights = [], isLoading, error } = useQuery({
    queryKey: ['/api/insights'],
    queryFn: async () => {
      const response = await fetch('/api/insights', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch insights');
      return response.json();
    },
    retry: 1,
  });

  // Fetch life metrics for filtering
  const { data: lifeMetrics = [] } = useQuery({
    queryKey: ['/api/life-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/life-metrics', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch life metrics');
      return response.json();
    },
    retry: 1,
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
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8">
          <div className="text-red-600">Failed to load insights. Please try again.</div>
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
                title={insight.title}
                explanation={insight.explanation}
                confidence={insight.confidence}
                suggestedGoals={insight.suggestedGoals || []}
                suggestedHabits={insight.suggestedHabits || []}
                onVote={(isUpvote) => handleVote(insight.id, isUpvote)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 