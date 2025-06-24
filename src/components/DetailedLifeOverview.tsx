
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, Target, TrendingUp, Brain, Calendar } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface DetailedLifeOverviewProps {
  metric: string;
  onBack: () => void;
}

export const DetailedLifeOverview = ({ metric, onBack }: DetailedLifeOverviewProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState("This Month");
  
  const periods = ["This Month", "Last 3 Months", "Last 6 Months", "This Year", "All Time"];

  // Mock data structure for different metrics
  const getMetricData = (metricName: string) => {
    const data = {
      "Mental Health": {
        progress: 85,
        color: "text-blue-600",
        bgColor: "bg-blue-100",
        goals: [
          { id: 1, title: "Build Mindfulness Practice", progress: 85, habits: 3 },
          { id: 2, title: "Reduce Stress Levels", progress: 72, habits: 2 }
        ],
        insights: [
          "Your meditation consistency has improved by 40% this month",
          "Stress levels are lowest on days when you journal in the morning"
        ],
        trendData: [
          { week: "Week 1", value: 78 },
          { week: "Week 2", value: 82 },
          { week: "Week 3", value: 85 },
          { week: "Week 4", value: 85 }
        ]
      },
      "Physical Health": {
        progress: 72,
        color: "text-green-600",
        bgColor: "bg-green-100",
        goals: [
          { id: 3, title: "Improve Sleep Quality", progress: 75, habits: 3 },
          { id: 4, title: "Exercise Regularly", progress: 68, habits: 4 }
        ],
        insights: [
          "Your sleep quality correlates strongly with morning sunlight exposure",
          "Exercise frequency has increased by 25% compared to last month"
        ],
        trendData: [
          { week: "Week 1", value: 65 },
          { week: "Week 2", value: 70 },
          { week: "Week 3", value: 72 },
          { week: "Week 4", value: 72 }
        ]
      },
      "Social": {
        progress: 68,
        color: "text-purple-600",
        bgColor: "bg-purple-100",
        goals: [
          { id: 5, title: "Strengthen Relationships", progress: 60, habits: 3 }
        ],
        insights: [
          "You feel most connected after meaningful one-on-one conversations",
          "Social energy is highest mid-week"
        ],
        trendData: [
          { week: "Week 1", value: 62 },
          { week: "Week 2", value: 65 },
          { week: "Week 3", value: 68 },
          { week: "Week 4", value: 68 }
        ]
      },
      "Productivity": {
        progress: 91,
        color: "text-orange-600",
        bgColor: "bg-orange-100",
        goals: [
          { id: 6, title: "Deep Work Sessions", progress: 95, habits: 2 },
          { id: 7, title: "Time Management", progress: 87, habits: 3 }
        ],
        insights: [
          "Your most productive hours are between 9-11 AM",
          "Breaking tasks into smaller chunks improves completion rate by 30%"
        ],
        trendData: [
          { week: "Week 1", value: 88 },
          { week: "Week 2", value: 90 },
          { week: "Week 3", value: 91 },
          { week: "Week 4", value: 91 }
        ]
      },
      "Nutrition": {
        progress: 78,
        color: "text-yellow-600",
        bgColor: "bg-yellow-100",
        goals: [
          { id: 8, title: "Healthy Eating Habits", progress: 78, habits: 4 }
        ],
        insights: [
          "Meal prep on Sundays leads to better eating choices throughout the week",
          "Hydration levels are optimal when you start the day with water"
        ],
        trendData: [
          { week: "Week 1", value: 72 },
          { week: "Week 2", value: 75 },
          { week: "Week 3", value: 78 },
          { week: "Week 4", value: 78 }
        ]
      },
      "Investments": {
        progress: 65,
        color: "text-red-600",
        bgColor: "bg-red-100",
        goals: [
          { id: 9, title: "Financial Planning", progress: 65, habits: 2 }
        ],
        insights: [
          "Regular weekly financial check-ins help maintain investment discipline",
          "Your investment knowledge has grown significantly this quarter"
        ],
        trendData: [
          { week: "Week 1", value: 60 },
          { week: "Week 2", value: 62 },
          { week: "Week 3", value: 65 },
          { week: "Week 4", value: 65 }
        ]
      }
    };
    
    return data[metricName as keyof typeof data] || data["Mental Health"];
  };

  const metricData = getMetricData(metric);

  const suggestGoals = () => {
    // This would be the same logic as the "Add New Goal" button
    console.log(`Suggesting new goals for ${metric}`);
  };

  return (
    <div className="p-6 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-4 text-green-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Overview
        </Button>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{metric}</h1>
        <p className="text-gray-600">
          Detailed view and progress tracking
        </p>
      </div>

      {/* Period Selector */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 overflow-x-auto">
          {periods.map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
              className="whitespace-nowrap"
            >
              {period}
            </Button>
          ))}
        </div>
      </div>

      {/* Overall Progress */}
      <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-bold text-gray-800">{metricData.progress}%</span>
            <div className={`w-16 h-16 rounded-full ${metricData.bgColor} flex items-center justify-center`}>
              <span className={`text-lg font-bold ${metricData.color}`}>{metricData.progress}%</span>
            </div>
          </div>
          <Progress value={metricData.progress} className="mb-3" />
          <p className="text-sm text-gray-600">
            {metricData.progress >= 80 ? "Excellent progress this period!" : 
             metricData.progress >= 60 ? "Good momentum, keep it up!" : 
             "Every step forward counts!"}
          </p>
        </CardContent>
      </Card>

      {/* Trend Chart */}
      <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span>Progress Trend</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={metricData.trendData}>
              <XAxis dataKey="week" axisLine={false} tickLine={false} />
              <YAxis hide />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Associated Goals */}
      <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span>Your Goals</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {metricData.goals.map((goal) => (
            <div key={goal.id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-800">{goal.title}</span>
                <span className="text-sm text-gray-600">{goal.progress}%</span>
              </div>
              <Progress value={goal.progress} className="mb-2" />
              <p className="text-xs text-gray-500">{goal.habits} habits tracked</p>
            </div>
          ))}
          
          <Button 
            onClick={suggestGoals}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Goal for {metric}
          </Button>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card className="shadow-md border-0 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <span>AI Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {metricData.insights.map((insight, index) => (
            <div key={index} className="p-3 bg-white/60 rounded-lg border-l-4 border-purple-400">
              <p className="text-sm text-gray-700">{insight}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
