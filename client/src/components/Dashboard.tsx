
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Smile, TrendingUp, Star } from "lucide-react";
import { LifeMetricsDashboard } from "./LifeMetricsDashboard";
import { DetailedLifeOverview } from "./DetailedLifeOverview";

interface DashboardProps {
  onOpenGPT: () => void;
}

export const Dashboard = ({ onOpenGPT }: DashboardProps) => {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  
  const currentTime = new Date().getHours();
  const greeting = currentTime < 12 ? "Good morning" : currentTime < 18 ? "Good afternoon" : "Good evening";
  const userName = "Alex";

  // If a metric is selected, show the detailed view
  if (selectedMetric) {
    return (
      <DetailedLifeOverview 
        metric={selectedMetric} 
        onBack={() => setSelectedMetric(null)} 
      />
    );
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
            {greeting}, {userName}
          </h1>
          <p className="text-gray-600">
            Ready to reflect and grow today?
          </p>
        </div>

        {/* Desktop Layout: Two Column */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Left Column - Life Metrics + Daily Cards (Desktop) */}
          <div className="space-y-6">
            <LifeMetricsDashboard onMetricClick={setSelectedMetric} />
            
            {/* Daily Cards - Hidden on mobile, shown on desktop */}
            <div className="hidden lg:block space-y-4">
              {/* Today's Mood */}
              <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Smile className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Today's Mood</h3>
                      <p className="text-sm text-gray-600">Feeling optimistic and focused</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Small Win */}
              <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Star className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Small Win 🎉</h3>
                      <p className="text-sm text-gray-600">Completed morning meditation - 5 days in a row!</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Insight */}
              <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">AI Insight</h3>
                      <p className="text-sm text-gray-600">Your energy levels peak when you journal in the morning</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column - Chat with Companion (Desktop) */}
          <div className="hidden lg:block">
            <Card className="shadow-lg border-0 bg-gradient-to-r from-green-500 to-green-600">
              <CardContent className="p-6 flex flex-col justify-center">
                <div className="text-center text-white">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-90" />
                  <h2 className="text-xl font-semibold mb-3">
                    Chat with your Companion
                  </h2>
                  <p className="text-green-100 mb-6">
                    Your AI companion is ready to listen and guide you through your thoughts
                  </p>
                  <Button 
                    onClick={onOpenGPT}
                    className="w-full bg-white text-green-600 hover:bg-green-50 py-3 rounded-full font-semibold"
                  >
                    Open GPT Chat
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Mobile Layout - Single Column */}
        <div className="lg:hidden space-y-6 mt-6">
          {/* Chat with Companion - Mobile (comes after life overview) */}
          <Card className="shadow-lg border-0 bg-gradient-to-r from-green-500 to-green-600">
            <CardContent className="p-6">
              <div className="text-center text-white">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-90" />
                <h2 className="text-xl font-semibold mb-3">
                  Chat with your Companion
                </h2>
                <p className="text-green-100 mb-6">
                  Your AI companion is ready to listen and guide you through your thoughts
                </p>
                <Button 
                  onClick={onOpenGPT}
                  className="w-full bg-white text-green-600 hover:bg-green-50 py-3 rounded-full font-semibold"
                >
                  Open GPT Chat
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Daily Cards - Mobile */}
          <div className="space-y-4">
            {/* Today's Mood */}
            <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Smile className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Today's Mood</h3>
                    <p className="text-sm text-gray-600">Feeling optimistic and focused</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Small Win */}
            <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Star className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Small Win 🎉</h3>
                    <p className="text-sm text-gray-600">Completed morning meditation - 5 days in a row!</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Insight */}
            <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">AI Insight</h3>
                    <p className="text-sm text-gray-600">Your energy levels peak when you journal in the morning</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
