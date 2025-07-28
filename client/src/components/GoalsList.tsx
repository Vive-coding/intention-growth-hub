import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Target, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { GoalProgressUpdate } from "./GoalProgressUpdate";
import type { GoalInstance, GoalDefinition } from "@shared/schema";

interface GoalWithInstance extends GoalDefinition {
  instances: GoalInstance[];
}

export const GoalsList = () => {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  // Fetch goal instances
  const { data: goalInstances, isLoading: instancesLoading } = useQuery({
    queryKey: ['/api/goal-instances'],
    retry: 1,
  });

  // Fetch goal definitions
  const { data: goalDefinitions, isLoading: definitionsLoading } = useQuery({
    queryKey: ['/api/goals'],
    retry: 1,
  });

  const isLoading = instancesLoading || definitionsLoading;

  if (isLoading) {
    return (
      <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Your Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-600">Loading your goals...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!goalDefinitions || !goalInstances) {
    return (
      <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Your Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-gray-600">No goals found. Start by creating your first goal!</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Combine goal definitions with their instances
  const goalsWithInstances: GoalWithInstance[] = (goalDefinitions as GoalDefinition[]).map(definition => ({
    ...definition,
    instances: (goalInstances as GoalInstance[]).filter(instance => 
      instance.goalDefinitionId === definition.id && instance.status === 'active'
    )
  }));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'active':
        return <Clock className="w-5 h-5 text-blue-600" />;
      default:
        return <Target className="w-5 h-5 text-gray-600" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      "Physical Health": "text-green-600 bg-green-100",
      "Mental Wellness": "text-blue-600 bg-blue-100", 
      "Career Growth": "text-purple-600 bg-purple-100",
      "Relationships": "text-orange-600 bg-orange-100",
      "Personal Growth": "text-red-600 bg-red-100",
      "Financial Health": "text-cyan-600 bg-cyan-100",
    };
    return colors[category] || "text-gray-600 bg-gray-100";
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Your Active Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {goalsWithInstances.map((goal) => {
              // Calculate overall progress for this goal
              const totalProgress = goal.instances.length > 0 
                ? goal.instances.reduce((sum, instance) => {
                    const currentVal = instance.currentValue || 0;
                    const targetVal = instance.targetValue || 1;
                    const progress = (currentVal / targetVal) * 100;
                    return sum + Math.min(progress, 100);
                  }, 0) / goal.instances.length
                : 0;

              const completedInstances = goal.instances.filter(i => i.status === 'completed').length;
              
              return (
                <div key={goal.id} className="border rounded-lg p-4 hover:bg-gray-50/50 transition-colors">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-800">{goal.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(goal.category)}`}>
                          {goal.category}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">
                          {goal.instances.length} active instance{goal.instances.length !== 1 ? 's' : ''} 
                          {completedInstances > 0 && ` • ${completedInstances} completed`}
                        </span>
                        <span className="text-sm font-medium text-blue-600">
                          {Math.round(totalProgress)}%
                        </span>
                      </div>
                      
                      <Progress value={totalProgress} className="h-2" />
                    </div>
                    
                    <ChevronRight 
                      className={`w-5 h-5 text-gray-400 ml-4 transition-transform ${
                        expandedGoal === goal.id ? 'rotate-90' : ''
                      }`} 
                    />
                  </div>

                  {expandedGoal === goal.id && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <p className="text-sm text-gray-600">{goal.description}</p>
                      
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-800">Goal Instances:</h4>
                        {goal.instances.map((instance) => (
                          <GoalProgressUpdate
                            key={instance.id}
                            goalInstance={instance}
                            onUpdate={() => {
                              // Refresh data after update
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};