
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface LifeMetric {
  category: string;
  progress: number;
  color: string;
  bgColor: string;
}

export const LifeMetricsDashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  const [showDropdown, setShowDropdown] = useState(false);

  const periods = ["This Month", "Last 3 Months", "Last 6 Months", "This Year", "All Time"];

  const getMetricsForPeriod = (period: string): LifeMetric[] => {
    const baseMetrics = [
      { category: "Mental Health", progress: 85, color: "text-blue-600", bgColor: "bg-blue-100" },
      { category: "Physical Health", progress: 72, color: "text-green-600", bgColor: "bg-green-100" },
      { category: "Social", progress: 68, color: "text-purple-600", bgColor: "bg-purple-100" },
      { category: "Productivity", progress: 91, color: "text-orange-600", bgColor: "bg-orange-100" },
      { category: "Nutrition", progress: 78, color: "text-yellow-600", bgColor: "bg-yellow-100" },
      { category: "Investments", progress: 65, color: "text-red-600", bgColor: "bg-red-100" },
    ];

    // Simulate different values for different periods
    const multiplier = period === "All Time" ? 0.95 : period === "This Year" ? 0.9 : 1;
    return baseMetrics.map(metric => ({
      ...metric,
      progress: Math.round(metric.progress * multiplier)
    }));
  };

  const metrics = getMetricsForPeriod(selectedPeriod);

  const CircularProgress = ({ progress, color, bgColor }: { progress: number; color: string; bgColor: string }) => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className="text-gray-200"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className={color}
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${color}`}>{progress}%</span>
        </div>
      </div>
    );
  };

  return (
    <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm">
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
              <span className="text-sm">{selectedPeriod}</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[140px]">
                {periods.map((period) => (
                  <button
                    key={period}
                    onClick={() => {
                      setSelectedPeriod(period);
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
        <div className="grid grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <div key={metric.category} className="flex flex-col items-center space-y-2">
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
