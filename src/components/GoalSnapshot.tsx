
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, CheckCircle, Target, TrendingUp } from "lucide-react";

interface GoalSnapshotProps {
  title: string;
  category: string;
  completedDate: string;
  finalProgress: number;
  successFactors: string[];
  lessonsLearned: string;
  habits: {
    name: string;
    finalCompletion: number;
  }[];
}

export const GoalSnapshot = ({
  title,
  category,
  completedDate,
  finalProgress,
  successFactors,
  lessonsLearned,
  habits
}: GoalSnapshotProps) => {
  const getStatusColor = (progress: number) => {
    if (progress >= 90) return "text-green-600 bg-green-50 border-green-200";
    if (progress >= 70) return "text-blue-600 bg-blue-50 border-blue-200";
    return "text-orange-600 bg-orange-50 border-orange-200";
  };

  const getStatusIcon = (progress: number) => {
    if (progress >= 90) return <CheckCircle className="w-5 h-5 text-green-600" />;
    return <Target className="w-5 h-5 text-blue-600" />;
  };

  return (
    <Card className="mb-4 shadow-md border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center space-x-2 mb-1">
              {getStatusIcon(finalProgress)}
              <span>{title}</span>
            </CardTitle>
            <p className="text-sm text-gray-600">{category}</p>
          </div>
          <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(finalProgress)}`}>
            {finalProgress}% Complete
          </div>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500 mt-2">
          <Calendar className="w-4 h-4" />
          <span>Completed: {completedDate}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Final Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Final Progress</span>
            <span className="text-sm font-bold text-green-600">{finalProgress}%</span>
          </div>
          <Progress value={finalProgress} />
        </div>

        {/* Habits Summary */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Habit Completion</h4>
          <div className="space-y-2">
            {habits.map((habit, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{habit.name}</span>
                <span className={`font-medium ${habit.finalCompletion >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                  {habit.finalCompletion}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Success Factors */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span>Success Factors</span>
          </h4>
          <ul className="space-y-1">
            {successFactors.map((factor, index) => (
              <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                <span className="text-green-500 mt-1">•</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Lessons Learned */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">AI Summary & Lessons</h4>
          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg">
            {lessonsLearned}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
