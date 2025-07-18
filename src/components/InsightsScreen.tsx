
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, Brain, Calendar, Tag, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { InsightSnapshot } from "./InsightSnapshot";
import { LifeMetricsDashboard } from "./LifeMetricsDashboard";
import { useLifeMetricView } from "@/hooks/useLifeMetricView";

export const InsightsScreen = () => {
  const [currentPeriod, setCurrentPeriod] = useState("This Week");
  const [viewMode, setViewMode] = useState<"current" | "historical">("current");
  const {
    viewMode: metricViewMode,
    selectedMetric,
    timePeriod,
    handleViewModeChange,
    handleMetricClick,
    clearMetricFilter,
    setTimePeriod,
    getBreadcrumbs
  } = useLifeMetricView();

  const periods = [
    "This Week",
    "Last Week", 
    "2 Weeks Ago",
    "3 Weeks Ago",
    "This Month",
    "Last Month",
    "2 Months Ago"
  ];

  const currentPeriodIndex = periods.indexOf(currentPeriod);

  const navigatePeriod = (direction: "prev" | "next") => {
    const currentIndex = periods.indexOf(currentPeriod);
    if (direction === "prev" && currentIndex < periods.length - 1) {
      setCurrentPeriod(periods[currentIndex + 1]);
    } else if (direction === "next" && currentIndex > 0) {
      setCurrentPeriod(periods[currentIndex - 1]);
    }
  };

  const getInsightsByMetric = (metric: string) => {
    // Filter insights based on selected metric
    const metricInsights = {
      "Mental Health": {
        moodData: [
          { day: "Mon", mood: 8 },
          { day: "Tue", mood: 7 },
          { day: "Wed", mood: 9 },
          { day: "Thu", mood: 8 },
          { day: "Fri", mood: 9 },
          { day: "Sat", mood: 8 },
          { day: "Sun", mood: 8 },
        ],
        themes: [
          { name: "Stress Management", count: 8, color: "bg-red-100 text-red-700" },
          { name: "Mindfulness", count: 12, color: "bg-blue-100 text-blue-700" },
          { name: "Mood Tracking", count: 6, color: "bg-purple-100 text-purple-700" },
        ],
        aiInsight: "Your mental health insights show strong progress in mindfulness practices. The consistency in your meditation routine has positively impacted your stress levels."
      },
      "Physical Health": {
        moodData: [
          { day: "Mon", mood: 7 },
          { day: "Tue", mood: 8 },
          { day: "Wed", mood: 6 },
          { day: "Thu", mood: 8 },
          { day: "Fri", mood: 9 },
          { day: "Sat", mood: 7 },
          { day: "Sun", mood: 8 },
        ],
        themes: [
          { name: "Exercise", count: 15, color: "bg-green-100 text-green-700" },
          { name: "Sleep", count: 10, color: "bg-purple-100 text-purple-700" },
          { name: "Energy Levels", count: 8, color: "bg-yellow-100 text-yellow-700" },
        ],
        aiInsight: "Your physical health tracking shows excellent commitment to exercise routines. Sleep quality improvements are correlating with better energy levels throughout the day."
      }
    };

    return metricInsights[metric as keyof typeof metricInsights] || {
      moodData,
      themes,
      aiInsight: "Continue tracking your progress in this area for personalized insights."
    };
  };

  const moodData = [
    { day: "Mon", mood: 7 },
    { day: "Tue", mood: 6 },
    { day: "Wed", mood: 8 },
    { day: "Thu", mood: 7 },
    { day: "Fri", mood: 9 },
    { day: "Sat", mood: 8 },
    { day: "Sun", mood: 7 },
  ];

  const themes = [
    { name: "Work Stress", count: 12, color: "bg-red-100 text-red-700" },
    { name: "Family", count: 8, color: "bg-blue-100 text-blue-700" },
    { name: "Exercise", count: 15, color: "bg-green-100 text-green-700" },
    { name: "Sleep", count: 6, color: "bg-purple-100 text-purple-700" },
  ];

  const getHistoricalInsight = (period: string) => {
    const insights = {
      "Last Week": {
        date: "Dec 16-22, 2024",
        keyThemes: ["Morning Routine", "Work Balance", "Exercise"],
        aiSummary: "You showed remarkable consistency in your morning routine last week, which correlated with higher energy levels throughout the day. Your reflections revealed a growing awareness of work-life boundaries.",
        moodTrend: "Steady improvement with a peak mid-week",
        highlights: [
          "Completed morning meditation 6/7 days",
          "Identified key work stress triggers",
          "Established evening wind-down routine"
        ]
      },
      "2 Weeks Ago": {
        date: "Dec 9-15, 2024",
        keyThemes: ["Relationships", "Self-Care", "Productivity"],
        aiSummary: "This period showed a focus on nurturing relationships and finding balance. You made significant progress in recognizing your self-care needs and setting healthy boundaries.",
        moodTrend: "Variable with upward trajectory",
        highlights: [
          "Had meaningful conversation with family",
          "Started weekly friend check-ins",
          "Implemented digital detox evenings"
        ]
      },
      "Last Month": {
        date: "November 2024",
        keyThemes: ["Goal Setting", "Mindfulness", "Health"],
        aiSummary: "November was a transformative month where you laid the foundation for sustainable habits. Your journal entries showed increased self-awareness and commitment to personal growth.",
        moodTrend: "Consistent positive growth",
        highlights: [
          "Set clear health and wellness goals",
          "Established daily mindfulness practice",
          "Improved sleep quality significantly"
        ]
      }
    };

    return insights[period as keyof typeof insights] || {
      date: period,
      keyThemes: ["Reflection", "Growth"],
      aiSummary: "This period showed continued progress in your personal development journey.",
      moodTrend: "Positive overall trend",
      highlights: ["Maintained consistent journaling", "Focused on self-improvement"]
    };
  };

  if (viewMode === "historical") {
    const insight = getHistoricalInsight(currentPeriod);
    
    return (
      <div className="p-6 pb-24 max-w-md mx-auto">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setViewMode("current")}
            className="mb-4 text-green-600"
          >
            ← Back to Current Insights
          </Button>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Insight History</h1>
          </div>
          
          {/* Period Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigatePeriod("prev")}
              disabled={currentPeriodIndex >= periods.length - 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold text-gray-700">{currentPeriod}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigatePeriod("next")}
              disabled={currentPeriodIndex <= 0}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <InsightSnapshot
          date={insight.date}
          period={currentPeriod}
          keyThemes={insight.keyThemes}
          aiSummary={insight.aiSummary}
          moodTrend={insight.moodTrend}
          highlights={insight.highlights}
        />
      </div>
    );
  }

  const currentData = selectedMetric ? getInsightsByMetric(selectedMetric) : { moodData, themes, aiInsight: "I've noticed you feel most energized and creative when you complete your morning routine. Consider protecting this time as it seems to set a positive tone for your entire day." };

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Your Insights</h1>
              {selectedMetric && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearMetricFilter}
                  className="text-gray-600"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("historical")}
              className="text-blue-600"
            >
              <Calendar className="w-4 h-4 mr-1" />
              History
            </Button>
          </div>
          
          {/* Breadcrumbs */}
          {(selectedMetric || getBreadcrumbs().length > 0) && (
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm text-gray-500">Insights</span>
              {getBreadcrumbs().map((crumb, index) => (
                <span key={index} className="text-sm text-gray-500">
                  › {crumb}
                </span>
              ))}
            </div>
          )}
          
          <p className="text-gray-600">
            Insights are updated after each GPT session
          </p>
        </div>

        <Tabs value={metricViewMode} onValueChange={handleViewModeChange} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overall">Overall View</TabsTrigger>
            <TabsTrigger value="by-metric">By Life Metric</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overall" className="space-y-4">
            {/* Overall insights content */}
            {renderInsightsContent()}
          </TabsContent>
          
          <TabsContent value="by-metric" className="space-y-4">
            <LifeMetricsDashboard 
              onMetricClick={handleMetricClick} 
              selectedPeriod={timePeriod}
              onPeriodChange={setTimePeriod}
            />
            {selectedMetric && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">
                    {selectedMetric} Insights
                  </h2>
                  <p className="text-sm text-gray-600">
                    Focused insights for your {selectedMetric.toLowerCase()} journey
                  </p>
                </div>
                {renderInsightsContent()}
              </div>
            )}
            {!selectedMetric && (
              <div className="text-center py-8">
                <p className="text-gray-600">
                  Click on a life metric above to see focused insights
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  function renderInsightsContent() {
    return (
      <>
        {/* Mood Trends */}
        <Card className="mb-4 shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span>
                {selectedMetric ? `${selectedMetric} Trends This Week` : "Mood Trends This Week"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={currentData.moodData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis hide />
                <Line 
                  type="monotone" 
                  dataKey="mood" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-sm text-gray-600 mt-2">
              {selectedMetric ? `Your ${selectedMetric.toLowerCase()} progress shows positive trends this week!` : "Your mood has been consistently positive this week!"}
            </p>
          </CardContent>
        </Card>

        {/* Common Themes */}
        <Card className="mb-4 shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Tag className="w-5 h-5 text-blue-600" />
              <span>
                {selectedMetric ? `${selectedMetric} Themes in Your Journal` : "Common Themes in Your Journal"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentData.themes.map((theme) => (
                <div key={theme.name} className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${theme.color}`}>
                    {theme.name}
                  </span>
                  <span className="text-sm text-gray-500">
                    {theme.count} mentions
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Insight */}
        <Card className="shadow-md border-0 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <span>AI Insight</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">
              {currentData.aiInsight}
            </p>
            <div className="mt-3 p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
              <p className="text-sm text-yellow-800">
                <strong>Early Detection:</strong> Your stress levels have been slightly elevated this week. 
                Would you like some resources to help manage stress?
              </p>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }
};
