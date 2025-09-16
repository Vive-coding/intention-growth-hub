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
              case "Last 3 Months": {
                // Filter by actual month range instead of just taking last 3 snapshots
                const now = new Date();
                const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                const threeMonthsAgoStr = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
                
                relevantSnapshots = snapshots.filter((snapshot: any) => {
                  return snapshot.monthYear >= threeMonthsAgoStr;
                });
                break;
              }
              case "Last 6 Months": {
                // Filter by actual month range instead of just taking last 6 snapshots
                const now = new Date();
                const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
                
                relevantSnapshots = snapshots.filter((snapshot: any) => {
                  return snapshot.monthYear >= sixMonthsAgoStr;
                });
                break;
              }
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

        // Compute latest progress for ring from last snapshot
        const latest = daysThisMonth && daysThisMonth.length > 0
          ? daysThisMonth[daysThisMonth.length - 1]
          : null;

        // If no snapshots exist, fall back to current progress from goals
        if (!latest || latest.progressPercentage === 0) {
          console.log('useMetricProgress - No snapshots found, fetching current progress');
          const currentProgressUrl = `/api/life-metrics/progress`;
          const currentProgress = await apiRequest(currentProgressUrl);
          const metricProgress = currentProgress.find((m: any) => m.name === metricName);
          
          if (metricProgress) {
            return {
              progress: metricProgress.progress || 0,
              totalGoals: metricProgress.totalGoals || 0,
              completedGoals: metricProgress.completedGoals || 0,
              progressSnapshots: daysThisMonth || [],
            };
          }
        }

        return {
          progress: latest?.progressPercentage || 0,
          totalGoals: latest?.totalGoals || 0,
          completedGoals: latest?.goalsCompleted || 0,
          progressSnapshots: daysThisMonth || [],
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