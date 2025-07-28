import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, TrendingUp, Users, Brain } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-6xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-6">
            Intention Growth Hub
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Transform your life through intentional growth tracking, AI-powered insights, and community support
          </p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            Get Started
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="text-center p-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-lg">Life Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Monitor 6 key life areas with beautiful progress visualizations</p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-lg">AI Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Get personalized recommendations from your AI growth companion</p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
              <CardTitle className="text-lg">Goal Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Set, track, and achieve your most important life goals</p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-orange-600" />
              </div>
              <CardTitle className="text-lg">Community</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Connect with others on similar growth journeys</p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto p-8 border-0 shadow-xl bg-gradient-to-r from-green-500 to-blue-500">
            <CardContent className="text-white">
              <h2 className="text-2xl font-bold mb-4">Ready to Transform Your Life?</h2>
              <p className="text-green-100 mb-6">
                Join thousands who are already growing with intentional habits and AI-powered insights
              </p>
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-white text-green-600 hover:bg-green-50 px-8 py-3 rounded-full font-semibold"
              >
                Start Your Journey
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Landing;