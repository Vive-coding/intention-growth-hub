
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Brain, Calendar, Tag } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

export const InsightsScreen = () => {
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

  return (
    <div className="p-6 pb-24 max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Your Insights</h1>
        <p className="text-gray-600">
          Insights are updated after each GPT session
        </p>
      </div>

      {/* Mood Trends */}
      <Card className="mb-4 shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span>Mood Trends This Week</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={moodData}>
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
            Your mood has been consistently positive this week!
          </p>
        </CardContent>
      </Card>

      {/* Common Themes */}
      <Card className="mb-4 shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Tag className="w-5 h-5 text-blue-600" />
            <span>Common Themes in Your Journal</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {themes.map((theme) => (
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
            I've noticed you feel most energized and creative when you complete your morning routine. 
            Consider protecting this time as it seems to set a positive tone for your entire day.
          </p>
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
            <p className="text-sm text-yellow-800">
              <strong>Early Detection:</strong> Your stress levels have been slightly elevated this week. 
              Would you like some resources to help manage stress?
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
