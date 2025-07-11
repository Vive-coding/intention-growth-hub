
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, Plus, ChevronRight, CheckCircle, History } from "lucide-react";
import { GoalSnapshot } from "./GoalSnapshot";

export const GoalsScreen = () => {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"current" | "history">("current");

  const goals = [
    {
      id: "sleep",
      title: "Improve Sleep Quality",
      category: "Physical Health",
      progress: 75,
      habits: [
        { name: "Go to bed by 10 PM", completed: 5, total: 7, progress: 71 },
        { name: "No screens 1hr before bed", completed: 4, total: 7, progress: 57 },
        { name: "Morning sunlight exposure", completed: 6, total: 7, progress: 86 }
      ]
    },
    {
      id: "mindfulness",
      title: "Build Mindfulness Practice",
      category: "Mental Health",
      progress: 85,
      habits: [
        { name: "Daily 10-min meditation", completed: 6, total: 7, progress: 86 },
        { name: "Gratitude journaling", completed: 7, total: 7, progress: 100 },
        { name: "Mindful breathing breaks", completed: 5, total: 7, progress: 71 }
      ]
    },
    {
      id: "relationships",
      title: "Strengthen Relationships",
      category: "Social",
      progress: 60,
      habits: [
        { name: "Weekly family call", completed: 1, total: 1, progress: 100 },
        { name: "Quality time with partner", completed: 3, total: 7, progress: 43 },
        { name: "Reach out to a friend", completed: 2, total: 7, progress: 29 }
      ]
    }
  ];

  const completedGoals = [
    {
      title: "Establish Morning Routine",
      category: "Productivity",
      completedDate: "December 15, 2024",
      finalProgress: 95,
      successFactors: [
        "Started with just 5 minutes and gradually increased",
        "Linked routine to existing habit (making coffee)",
        "Consistent tracking and self-compassion"
      ],
      lessonsLearned: "Small, consistent actions compound over time. The key was not perfection but persistence. Starting small and building momentum proved more effective than attempting dramatic changes immediately.",
      habits: [
        { name: "Wake up at 6:30 AM", finalCompletion: 85 },
        { name: "5-minute meditation", finalCompletion: 92 },
        { name: "Write 3 gratitudes", finalCompletion: 98 }
      ]
    },
    {
      title: "Reduce Social Media Usage",
      category: "Mental Health",
      completedDate: "November 28, 2024",
      finalProgress: 88,
      successFactors: [
        "Used app time limits effectively",
        "Replaced scrolling with reading",
        "Found accountability partner"
      ],
      lessonsLearned: "Digital wellness requires intentional design of your environment. Removing apps from home screen and creating friction was more effective than relying on willpower alone.",
      habits: [
        { name: "Max 30min social media daily", finalCompletion: 82 },
        { name: "No phone first hour awake", finalCompletion: 95 },
        { name: "Evening phone in another room", finalCompletion: 87 }
      ]
    }
  ];

  if (viewMode === "history") {
    return (
      <div className="p-6 pb-24 max-w-md mx-auto">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setViewMode("current")}
            className="mb-4 text-green-600"
          >
            ← Back to Current Goals
          </Button>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Goal History</h1>
          <p className="text-gray-600">
            Your completed goals and their success stories
          </p>
        </div>

        <div className="space-y-4">
          {completedGoals.map((goal, index) => (
            <GoalSnapshot
              key={index}
              title={goal.title}
              category={goal.category}
              completedDate={goal.completedDate}
              finalProgress={goal.finalProgress}
              successFactors={goal.successFactors}
              lessonsLearned={goal.lessonsLearned}
              habits={goal.habits}
            />
          ))}
        </div>
      </div>
    );
  }

  if (selectedGoal) {
    const goal = goals.find(g => g.id === selectedGoal);
    if (!goal) return null;

    return (
      <div className="p-6 pb-24 max-w-md mx-auto">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedGoal(null)}
            className="mb-4 text-green-600"
          >
            ← Back to Goals
          </Button>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{goal.title}</h1>
          <p className="text-gray-600">{goal.category}</p>
        </div>

        <Card className="mb-4 shadow-md border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Progress</span>
              <span className="text-sm font-bold text-green-600">{goal.progress}%</span>
            </div>
            <Progress value={goal.progress} className="mb-2" />
            <p className="text-xs text-gray-500">
              You're doing great! Keep up the momentum.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Your Habits</h2>
          {goal.habits.map((habit, index) => (
            <Card key={index} className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">{habit.name}</span>
                  <span className="text-sm text-gray-600">
                    {habit.completed}/{habit.total} days
                  </span>
                </div>
                <Progress value={habit.progress} className="mb-2" />
                <p className="text-xs text-gray-500">
                  {habit.progress >= 80 ? "Excellent progress!" : 
                   habit.progress >= 50 ? "Good momentum, keep going!" : 
                   "Every step counts - you've got this!"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 max-w-md mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-800">Your Goals</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("history")}
            className="text-blue-600"
          >
            <History className="w-4 h-4 mr-1" />
            History
          </Button>
        </div>
        <p className="text-gray-600">
          Personal growth goals based on your insights
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {goals.map((goal) => (
          <Card 
            key={goal.id} 
            className="shadow-md border-0 bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedGoal(goal.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{goal.title}</h3>
                  <p className="text-sm text-gray-600">{goal.category}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm font-bold text-green-600">{goal.progress}%</span>
              </div>
              <Progress value={goal.progress} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-md border-0 bg-gradient-to-r from-green-500 to-green-600">
        <CardContent className="p-4">
          <Button 
            className="w-full bg-white text-green-600 hover:bg-green-50 py-3 rounded-full font-semibold"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add New Goal
          </Button>
          <p className="text-center text-green-100 text-sm mt-2">
            Based on your GPT conversations, we'll suggest personalized goals
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
