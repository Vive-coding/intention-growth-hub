
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, ExternalLink, Lock } from "lucide-react";

interface GPTModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GPTModal = ({ isOpen, onClose }: GPTModalProps) => {
  if (!isOpen) return null;

  const handleContinueToGPT = () => {
    // In a real app, this would open the custom GPT
    console.log("Opening custom GPT...");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
      <Card className="w-full max-w-sm mx-auto shadow-2xl border-0 bg-white">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <h2 className="text-xl font-bold text-gray-800 mb-3">
            Heading to Your Secure Chat
          </h2>
          
          <p className="text-gray-600 mb-2">
            You're about to enter your private space to reflect on your day with your AI companion.
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
            
            <Button 
              onClick={onClose}
              variant="outline"
              className="w-full py-3 rounded-full"
            >
              Stay in App
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
