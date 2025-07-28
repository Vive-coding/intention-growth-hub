
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { LifeMetricWithProgress } from "@shared/schema";

interface LifeMetric {
  category: string;
  progress: number;
  color: string;
  bgColor: string;
}

// Color mapping for life metrics
const getMetricColors = (name: string) => {
  const colorMap: Record<string, { text: string; bg: string }> = {
    "Physical Health": { text: "text-green-600", bg: "bg-green-100" },
    "Mental Wellness": { text: "text-blue-600", bg: "bg-blue-100" },
    "Career Growth": { text: "text-purple-600", bg: "bg-purple-100" },
    "Relationships": { text: "text-orange-600", bg: "bg-orange-100" },
    "Personal Growth": { text: "text-red-600", bg: "bg-red-100" },
    "Financial Health": { text: "text-cyan-600", bg: "bg-cyan-100" },
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
  const [selectedPeriod, setSelectedPeriod] = useState(externalPeriod || "This Month");
  const [showDropdown, setShowDropdown] = useState(false);

  const periods = ["This Month", "Last 3 Months", "Last 6 Months", "This Year", "All Time"];
  const currentPeriod = externalPeriod || selectedPeriod;

  // Fetch real user life metrics with progress
  const { data: lifeMetrics, isLoading, error } = useQuery({
    queryKey: ['/api/life-metrics/progress'],
    retry: 1,
  });

  const getMetricsForPeriod = (period: string): LifeMetric[] => {
    if (!lifeMetrics || isLoading) {
      return []; // Return empty array while loading
    }

    // Convert database metrics to component format
    return (lifeMetrics as LifeMetricWithProgress[]).map(metric => {
      const colors = getMetricColors(metric.name);
      return {
        category: metric.name,
        progress: metric.progress,
        color: colors.text,
        bgColor: colors.bg,
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

  const CircularProgress = ({ progress, color, bgColor }: { progress: number; color: string; bgColor: string }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative w-16 h-16 sm:w-20 sm:h-20">
        <svg className="w-16 h-16 sm:w-20 sm:h-20 transform -rotate-90" viewBox="0 0 64 64">
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
          <span className={`text-xs sm:text-sm font-bold ${color}`}>{progress}%</span>
        </div>
      </div>
    );
  };

  return (
    <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm h-[400px]">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Your Life Overview</CardTitle>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2"
            >
              <span className="text-sm">{currentPeriod}</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[140px]">
                {periods.map((period) => (
                  <button
                    key={period}
                    onClick={() => {
                      setSelectedPeriod(period);
                      onPeriodChange?.(period);
                      setShowDropdown(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
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
        <div className="grid grid-cols-3 grid-rows-2 gap-3 sm:gap-4">
          {metrics.map((metric) => (
            <div 
              key={metric.category} 
              className="flex flex-col items-center space-y-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
              onClick={() => onMetricClick?.(metric.category)}
            >
              <CircularProgress 
                progress={metric.progress} 
                color={metric.color}
                bgColor={metric.bgColor}
              />
              <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                {metric.category}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
