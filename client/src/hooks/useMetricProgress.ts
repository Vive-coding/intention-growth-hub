import { useQuery } from "@tanstack/react-query";

interface MetricProgressData {
  progress: number;
  totalGoals?: number;
  completedGoals?: number;
  progressSnapshots?: any[];
  goals?: any[];
  insights?: any[];
}

export const useMetricProgress = (metricName: string, selectedPeriod: string) => {
  return useQuery({
    queryKey: ['metric-progress', metricName, selectedPeriod],
    queryFn: async (): Promise<MetricProgressData> => {
      try {
        // For historical periods, use progress snapshots
        if (selectedPeriod !== "This Month") {
          const snapshotsUrl = `/api/life-metrics/${encodeURIComponent(metricName)}/progress-snapshots?period=${encodeURIComponent(selectedPeriod)}`;
          const snapshotsResponse = await fetch(snapshotsUrl, { credentials: 'include' });
          
          if (snapshotsResponse.ok) {
            const snapshots = await snapshotsResponse.json();
            
            // Apply period-specific filtering
            let relevantSnapshots;
            switch (selectedPeriod) {
              case "Last 3 Months":
                relevantSnapshots = snapshots.slice(-3);
                break;
              case "Last 6 Months":
                relevantSnapshots = snapshots.slice(-6);
                break;
              case "This Year":
                const currentYear = new Date().getFullYear();
                relevantSnapshots = snapshots.filter((snapshot: any) => {
                  const snapshotYear = parseInt(snapshot.monthYear.split('-')[0]);
                  return snapshotYear === currentYear;
                });
                break;
              case "All Time":
                relevantSnapshots = snapshots;
                break;
              default:
                relevantSnapshots = snapshots.slice(-6);
            }
            
            if (relevantSnapshots.length > 0) {
              const totalProgress = relevantSnapshots.reduce((sum: number, snapshot: any) => {
                return sum + snapshot.progressPercentage;
              }, 0);
              const averageProgress = Math.round(totalProgress / relevantSnapshots.length);
              
              console.log(`useMetricProgress - ${metricName} - ${selectedPeriod}:`, {
                relevantSnapshots: relevantSnapshots.length,
                totalProgress,
                averageProgress,
                snapshots: relevantSnapshots.map((s: any) => ({ monthYear: s.monthYear, progress: s.progressPercentage }))
              });
              
              return {
                progress: averageProgress,
                totalGoals: relevantSnapshots[0].totalGoals,
                completedGoals: relevantSnapshots[0].goalsCompleted,
                progressSnapshots: relevantSnapshots
              };
            }
          }
        }
        
        // For "This Month", use the progress API
        const progressUrl = `/api/life-metrics/${encodeURIComponent(metricName)}/progress/${encodeURIComponent(selectedPeriod)}`;
        const progressResponse = await fetch(progressUrl, { credentials: 'include' });
        
        if (progressResponse.ok) {
          const periodProgress = await progressResponse.json();
          return {
            progress: periodProgress.progress || 0,
            totalGoals: periodProgress.totalGoals,
            completedGoals: periodProgress.goalsCompleted,
            progressSnapshots: []
          };
        }
        
        // Fallback
        return {
          progress: 0,
          totalGoals: 0,
          completedGoals: 0,
          progressSnapshots: []
        };
      } catch (error) {
        console.error(`Error fetching progress for ${metricName}:`, error);
        return {
          progress: 0,
          totalGoals: 0,
          completedGoals: 0,
          progressSnapshots: []
        };
      }
    },
    retry: 1,
  });
}; 