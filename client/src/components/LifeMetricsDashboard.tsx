
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { LifeMetricWithProgress } from "@shared/schema";
import { useMetricProgress } from "@/hooks/useMetricProgress";

interface LifeMetric {
  category: string;
  progress: number;
  color: string;
  bgColor: string;
  hasGoals: boolean;
}

// Color mapping for life metrics
const getMetricColors = (name: string) => {
  const colorMap: Record<string, { text: string; bg: string }> = {
    "Health & Fitness": { text: "text-green-600", bg: "bg-green-100" },
    "Career Growth": { text: "text-blue-600", bg: "bg-blue-100" },
    "Personal Development": { text: "text-purple-600", bg: "bg-purple-100" },
    "Relationships": { text: "text-orange-600", bg: "bg-orange-100" },
    "Finance": { text: "text-red-600", bg: "bg-red-100" },
    "Mental Health": { text: "text-purple-600", bg: "bg-purple-100" },

  };
  return colorMap[name] || { text: "text-gray-600", bg: "bg-gray-100" };
};

interface LifeMetricsDashboardProps {
  onMetricClick?: (metric: string) => void;
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
}

export const LifeMetricsDashboard = ({ 
  onMetricClick, 
  selectedPeriod: externalPeriod, 
  onPeriodChange 
}: LifeMetricsDashboardProps) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const periods = ["This Month", "Last 3 Months", "Last 6 Months", "This Year", "All Time"];
  const currentPeriod = externalPeriod || "This Month";

  // Fetch real user life metrics with progress for the selected period
  const { data: lifeMetrics, isLoading, error } = useQuery({
    queryKey: ['/api/life-metrics/progress', currentPeriod],
    queryFn: async () => {
      const response = await fetch('/api/life-metrics/progress', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch life metrics');
      const metrics = await response.json();
      
      // For "This Month", fetch goals for each metric and calculate progress the same way as detailed view
      if (currentPeriod === "This Month") {
        const metricsWithProgress = await Promise.all(
          metrics.map(async (metric: any) => {
            try {
              // Fetch goals for this metric using the same API as detailed view
              const goalsResponse = await fetch(`/api/goals?metric=${encodeURIComponent(metric.name)}`, { 
                credentials: 'include' 
              });
              
              if (goalsResponse.ok) {
                const goals = await goalsResponse.json();
                
                if (goals.length === 0) {
                  return {
                    ...metric,
                    progress: 0,
                    totalGoals: 0,
                    completedGoals: 0
                  };
                }
                
                // Calculate average progress using the same logic as detailed view
                const totalProgress = goals.reduce((sum: number, goal: any) => {
                  return sum + (goal.progress || 0);
                }, 0);
                
                const averageProgress = Math.round(totalProgress / goals.length);
                const completedGoals = goals.filter((goal: any) => goal.status === 'completed').length;
                
                return {
                  ...metric,
                  progress: averageProgress,
                  totalGoals: goals.length,
                  completedGoals
                };
              }
            } catch (error) {
              console.error(`Failed to fetch goals for ${metric.name}:`, error);
            }
            return metric;
          })
        );
        
        return metricsWithProgress;
      }
      
      // For historical periods, use progress snapshots
      const metricsWithProgress = await Promise.all(
        metrics.map(async (metric: any) => {
          try {
            const snapshotsUrl = `/api/life-metrics/${encodeURIComponent(metric.name)}/progress-snapshots?period=${encodeURIComponent(currentPeriod)}`;
            const snapshotsResponse = await fetch(snapshotsUrl, { credentials: 'include' });
            
            if (snapshotsResponse.ok) {
              const snapshots = await snapshotsResponse.json();
              
              // Apply period-specific filtering
              let relevantSnapshots;
              switch (currentPeriod) {
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
                
                return {
                  ...metric,
                  progress: averageProgress,
                  totalGoals: relevantSnapshots[0].totalGoals,
                  completedGoals: relevantSnapshots[0].goalsCompleted
                };
              }
            }
          } catch (error) {
            console.error(`Failed to fetch progress for ${metric.name}:`, error);
          }
          return metric;
        })
      );
      
      return metricsWithProgress;
    },
    retry: 1,
  });

  const getMetricsForPeriod = (period: string): LifeMetric[] => {
    if (!lifeMetrics || isLoading) {
      return []; // Return empty array while loading
    }

    // Convert database metrics to component format
    return (lifeMetrics as LifeMetricWithProgress[]).map(metric => {
      const colors = getMetricColors(metric.name);
      const hasGoals = metric.totalGoals > 0;
      
      return {
        category: metric.name,
        progress: hasGoals ? metric.progress : 0,
        color: hasGoals ? colors.text : "text-gray-400",
        bgColor: hasGoals ? colors.bg : "bg-gray-100",
        hasGoals,
      };
    });
  };

  const metrics = getMetricsForPeriod(currentPeriod);

  // Show loading state
  if (isLoading) {
    return (
      <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm h-[400px]">
        <CardHeader>
          <CardTitle>Your Life Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-600">Loading your metrics...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm h-[400px]">
        <CardHeader>
          <CardTitle>Your Life Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-red-600">Failed to load metrics. Please try again.</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CircularProgress = ({ progress, color, bgColor, hasGoals }: { progress: number; color: string; bgColor: string; hasGoals: boolean }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20">
        <svg className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 transform -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-gray-200"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className={color}
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold ${color}`}>
            {hasGoals ? `${progress}%` : 'No goals'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm min-h-[300px] lg:h-[400px]">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base lg:text-lg">Your Life Overview</CardTitle>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2"
            >
              <span className="text-xs lg:text-sm">{currentPeriod}</span>
              <ChevronDown className="w-3 h-3 lg:w-4 lg:h-4" />
            </Button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[120px] lg:min-w-[140px]">
                {periods.map((period) => (
                  <button
                    key={period}
                    onClick={() => {
                      onPeriodChange?.(period);
                      setShowDropdown(false);
                    }}
                    className="block w-full text-left px-2 py-1 lg:px-3 lg:py-2 text-xs lg:text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {period}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 grid-rows-2 gap-2 lg:gap-3 xl:gap-4">
          {metrics.map((metric) => (
            <div 
              key={metric.category} 
              className="flex flex-col items-center space-y-1 lg:space-y-2 cursor-pointer hover:bg-gray-50 p-1 lg:p-2 rounded-lg transition-colors"
              onClick={() => onMetricClick?.(metric.category)}
            >
              <CircularProgress 
                progress={metric.progress} 
                color={metric.color}
                bgColor={metric.bgColor}
                hasGoals={metric.hasGoals}
              />
              <span className={`text-xs font-medium text-center leading-tight ${metric.hasGoals ? 'text-gray-700' : 'text-gray-400'}`}>
                {metric.category}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
