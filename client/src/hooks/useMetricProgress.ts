import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
        // For all periods, fetch snapshots; for This Month we'll use daily
        if (selectedPeriod !== "This Month") {
          const snapshotsUrl = `/api/life-metrics/${encodeURIComponent(metricName)}/progress-snapshots?period=${encodeURIComponent(selectedPeriod)}`;
          const snapshots = await apiRequest(snapshotsUrl);
          
          if (snapshots) {
            
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
        
        // For "This Month", fetch daily snapshots directly
        const dailyUrl = `/api/life-metrics/${encodeURIComponent(metricName)}/progress-snapshots?period=${encodeURIComponent('This Month')}`;
        const dailySnapshots = await apiRequest(dailyUrl);
        console.log('useMetricProgress - This Month snapshots', {
          metricName,
          count: Array.isArray(dailySnapshots) ? dailySnapshots.length : 0,
          preview: (dailySnapshots || []).slice(-7).map((s: any) => ({
            snapshotDate: s.snapshotDate,
            progress: s.progressPercentage,
            completed: s.goalsCompleted,
          }))
        });
        const daysThisMonth = dailySnapshots as any[];

        // Compute latest progress for ring from last snapshot (or 0)
        const latest = daysThisMonth && daysThisMonth.length > 0
          ? daysThisMonth[daysThisMonth.length - 1]
          : { progressPercentage: 0, goalsCompleted: 0, totalGoals: 0 };

        return {
          progress: latest.progressPercentage || 0,
          totalGoals: latest.totalGoals,
          completedGoals: latest.goalsCompleted,
          progressSnapshots: daysThisMonth,
        };
        
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