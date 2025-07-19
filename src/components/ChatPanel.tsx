import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, ExternalLink, Lock, X, Minimize2 } from "lucide-react";

interface ChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const ChatPanel = ({ isOpen, onToggle }: ChatPanelProps) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const handleContinueToGPT = () => {
    console.log("Opening custom GPT...");
    // In a real app, this would open the custom GPT
  };

  if (!isOpen) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={onToggle}
          className="bg-green-500 hover:bg-green-600 text-white rounded-full p-3 shadow-lg"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-screen w-80 xl:w-96 bg-background border-l border-border z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">AI Companion</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-8 w-8 p-0"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="flex-1 flex flex-col p-4">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-green-600" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Your Secure Chat
              </h3>
              
              <p className="text-gray-600 mb-4">
                Ready to reflect on your day with your AI companion?
              </p>

              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 mb-6">
                <Lock className="w-4 h-4" />
                <span>End-to-end encrypted</span>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={handleContinueToGPT}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Continue to GPT
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent conversations or quick actions could go here */}
          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Quick Actions</h4>
            <Button variant="outline" className="w-full justify-start" size="sm">
              📝 Daily Reflection
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              🎯 Goal Check-in
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              💡 Ask for Insights
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};