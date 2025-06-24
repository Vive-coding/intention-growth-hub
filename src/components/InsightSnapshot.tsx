
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Brain, TrendingUp } from "lucide-react";

interface InsightSnapshotProps {
  date: string;
  period: string;
  keyThemes: string[];
  aiSummary: string;
  moodTrend: string;
  highlights: string[];
}

export const InsightSnapshot = ({ 
  date, 
  period, 
  keyThemes, 
  aiSummary, 
  moodTrend, 
  highlights 
}: InsightSnapshotProps) => {
  return (
    <Card className="mb-4 shadow-md border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>{period}</span>
          </CardTitle>
          <span className="text-sm text-gray-500">{date}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Themes */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Key Themes</h4>
          <div className="flex flex-wrap gap-2">
            {keyThemes.map((theme, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>

        {/* AI Summary */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-1">
            <Brain className="w-4 h-4 text-purple-600" />
            <span>AI Summary</span>
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed">{aiSummary}</p>
        </div>

        {/* Mood Trend */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span>Mood Trend</span>
          </h4>
          <p className="text-sm text-gray-600">{moodTrend}</p>
        </div>

        {/* Highlights */}
        {highlights.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Key Highlights</h4>
            <ul className="space-y-1">
              {highlights.map((highlight, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
