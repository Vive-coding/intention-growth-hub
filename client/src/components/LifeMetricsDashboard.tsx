
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getLifeMetricColors } from "@/lib/utils";
import type { LifeMetricWithProgress } from "@shared/schema";
import { useMetricProgress } from "@/hooks/useMetricProgress";
import { apiRequest } from "@/lib/queryClient";

interface LifeMetric {
  category: string;
  progress: number;
  color: string;
  bgColor: string;
  hasGoals: boolean;
  originalColors?: { text: string; bg: string; hex: string };
}

// Unified color mapping for life metrics - now consistent with our pill colors
const getMetricColors = (name: string) => {
  if (name.includes('Health & Fitness')) return { text: 'text-green-600', bg: 'bg-green-100', hex: '#16a34a' };
  if (name.includes('Career Growth')) return { text: 'text-blue-600', bg: 'bg-blue-100', hex: '#2563eb' };
  if (name.includes('Personal Development') || name.includes('Personal')) return { text: 'text-purple-600', bg: 'bg-purple-100', hex: '#9333ea' };
  if (name.includes('Relationships')) return { text: 'text-orange-600', bg: 'bg-orange-100', hex: '#ea580c' };
  if (name.includes('Finance')) return { text: 'text-red-600', bg: 'bg-red-100', hex: '#dc2626' };
  if (name.includes('Mental Health')) return { text: 'text-teal-600', bg: 'bg-teal-100', hex: '#0d9488' };
  return { text: 'text-gray-600', bg: 'bg-gray-100', hex: '#4b5563' }; // Default
};

// Custom pill color mapping for unique, meaningful colors
const getPillBackgroundColor = (metricName: string) => {
  if (metricName.includes('Health & Fitness')) return '#dcfce7'; // Light green
  if (metricName.includes('Career Growth')) return '#dbeafe'; // Light blue
  if (metricName.includes('Personal Development') || metricName.includes('Personal')) return '#f3e8ff'; // Light purple
  if (metricName.includes('Relationships')) return '#fed7aa'; // Light orange
  if (metricName.includes('Finance')) return '#fecaca'; // Light red
  if (metricName.includes('Mental Health')) return '#ccfbf1'; // Light teal
  return '#f3f4f6'; // Default light gray
};

const getPillTextColor = (metricName: string) => {
  if (metricName.includes('Health & Fitness')) return '#166534'; // Dark green
  if (metricName.includes('Career Growth')) return '#1e40af'; // Dark blue
  if (metricName.includes('Personal Development') || metricName.includes('Personal')) return '#7c3aed'; // Dark purple
  if (metricName.includes('Relationships')) return '#ea580c'; // Dark orange
  if (metricName.includes('Finance')) return '#dc2626'; // Dark red
  if (metricName.includes('Mental Health')) return '#0f766e'; // Dark teal
  return '#6b7280'; // Default dark gray
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
      const response = await apiRequest('/api/life-metrics/progress');
      
      // For "This Month", fetch goals for each metric and calculate progress the same way as detailed view
      if (currentPeriod === "This Month") {
        const metricsWithProgress = await Promise.all(
          response.map(async (metric: any) => {
            try {
              // Fetch goals for this metric using the same API as detailed view
              const goals = await apiRequest(`/api/goals?metric=${encodeURIComponent(metric.name)}`);
              
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
        response.map(async (metric: any) => {
          try {
            const snapshotsUrl = `/api/life-metrics/${encodeURIComponent(metric.name)}/progress-snapshots?period=${encodeURIComponent(currentPeriod)}`;
            const snapshots = await apiRequest(snapshotsUrl);
            
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
                totalGoals: relevantSnapshots.length,
                completedGoals: relevantSnapshots.filter((snapshot: any) => snapshot.progressPercentage >= 90).length
              };
            }
          } catch (error) {
            console.error(`Failed to fetch snapshots for ${metric.name}:`, error);
          }
          return metric;
        })
      );
      
      return metricsWithProgress;
    },
    enabled: true, // Always enabled since we're using apiRequest which handles auth
  });

  const getMetricsForPeriod = (period: string): LifeMetric[] => {
    if (!lifeMetrics || isLoading) {
      return []; // Return empty array while loading
    }

    // Convert database metrics to component format
    return (lifeMetrics as LifeMetricWithProgress[]).map(metric => {
      const colors = getMetricColors(metric.name);
      const hasGoals = metric.totalGoals > 0;
      
      // Determine progress ring color based on thresholds
      let progressColor = "text-gray-400"; // Default for no goals
      if (hasGoals) {
        if (metric.progress > 80) {
          progressColor = "text-emerald-600"; // Vibrant green for "home stretch" > 80%
        } else {
          progressColor = colors.text; // Use life metric color for normal progress
        }
      }
      
      return {
        category: metric.name,
        progress: hasGoals ? metric.progress : 0,
        color: progressColor,
        bgColor: hasGoals ? colors.bg : "bg-gray-100",
        hasGoals,
        originalColors: colors, // Keep original colors for pills
      };
    });
  };

  const metrics = getMetricsForPeriod(currentPeriod);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Your Life Overview</h2>
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2"
            >
              {currentPeriod}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="flex justify-center">
                  <div className="h-16 w-16 bg-gray-200 rounded-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !lifeMetrics || lifeMetrics.length === 0) {
    // Preview metrics to show what users can expect
    const previewMetrics = [
      { category: "Health & Fitness 🏃‍♀️", progress: 0, color: "text-green-600", bgColor: "bg-green-100", hasGoals: false },
      { category: "Career Growth 🚀", progress: 0, color: "text-blue-600", bgColor: "bg-blue-100", hasGoals: false },
      { category: "Personal Development 🧠", progress: 0, color: "text-purple-600", bgColor: "bg-purple-100", hasGoals: false },
      { category: "Relationships ❤️", progress: 0, color: "text-orange-600", bgColor: "bg-orange-100", hasGoals: false },
      { category: "Finance 💰", progress: 0, color: "text-red-600", bgColor: "bg-red-100", hasGoals: false },
      { category: "Mental Health 🧘‍♂️", progress: 0, color: "text-indigo-600", bgColor: "bg-indigo-100", hasGoals: false },
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Your Life Overview</h2>
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2"
            >
              {currentPeriod}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 grid-rows-2 gap-1 sm:gap-2 lg:gap-3 xl:gap-4">
          {previewMetrics.map((metric, index) => (
            <div 
              key={index} 
              className="flex flex-col items-center justify-center space-y-1 lg:space-y-2 p-1 lg:p-2 rounded-lg min-h-[80px] sm:min-h-[100px] lg:min-h-[120px]"
            >
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 transform -rotate-90" viewBox="0 0 64 64">
                  {/* Background circle - use metric color with light opacity */}
                  <circle
                    cx="32"
                    cy="32"
                    r="30"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className={metric.color}
                    style={{ opacity: 0.3 }}
                  />
                  {/* Progress circle - same color, no progress */}
                  <circle
                    cx="32"
                    cy="32"
                    r="30"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray="188.5, 188.5"
                    strokeDashoffset="188.5"
                    className={metric.color}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xs font-bold ${metric.color}`}>0%</span>
                </div>
              </div>
              <div 
                className="inline-flex items-center justify-center px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[9px] sm:text-[10px] lg:text-xs font-medium text-center leading-tight max-w-full break-words"
                style={{ 
                  backgroundColor: getPillBackgroundColor(metric.category),
                  color: getPillTextColor(metric.category)
                }}
              >
                {metric.category}
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            Create journals and add goals to start tracking your progress
          </p>
        </div>
      </div>
    );
  }

  const CircularProgress = ({ progress, color, bgColor, hasGoals }: { progress: number; color: string; bgColor: string; hasGoals: boolean }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16">
        <svg className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 transform -rotate-90" viewBox="0 0 64 64">
          {/* Background circle - use grey for unfilled part */}
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-gray-300"
          />
          {/* Progress circle - use the same color */}
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
            {hasGoals ? `${progress}%` : '0%'}
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
        <div className="grid grid-cols-3 grid-rows-2 gap-1 sm:gap-2 lg:gap-3 xl:gap-4">
          {metrics.map((metric) => (
            <div 
              key={metric.category} 
              className="flex flex-col items-center justify-center space-y-1 lg:space-y-2 cursor-pointer hover:bg-gray-50 p-1 lg:p-2 rounded-lg transition-colors h-[100px] sm:h-[120px] lg:h-[140px]"
              onClick={() => {
                console.log('🔍 Life metric clicked:', metric.category);
                console.log('🔍 Token status before navigation:');
                console.log('  Token:', localStorage.getItem("token") ? 'PRESENT' : 'MISSING');
                console.log('  User:', localStorage.getItem("user") ? 'PRESENT' : 'MISSING');
                onMetricClick?.(metric.category);
              }}
            >
              <CircularProgress 
                progress={metric.progress} 
                color={metric.color}
                bgColor={metric.bgColor}
                hasGoals={metric.hasGoals}
              />
              <div 
                className="inline-flex items-center justify-center px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[9px] sm:text-xs font-medium text-center leading-tight max-w-full break-words"
                style={{ 
                  backgroundColor: getPillBackgroundColor(metric.category),
                  color: getPillTextColor(metric.category)
                }}
              >
                {metric.category}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
