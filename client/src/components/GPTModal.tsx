
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, ExternalLink, Lock } from "lucide-react";

interface GPTModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GPTModal = ({ isOpen, onClose }: GPTModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
      <Card className="w-full max-w-sm mx-auto shadow-2xl border-0 bg-white">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-blue-600" />
          </div>
          
          <h2 className="text-xl font-bold text-gray-800 mb-3">
            Chat with Life Coach - Coming Soon!
          </h2>
          
          <p className="text-gray-600 mb-2">
            We're working hard to bring you an AI-powered life coach that will help you reflect, grow, and achieve your goals.
          </p>

          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 mb-6">
            <Lock className="w-4 h-4" />
            <span>End-to-end encrypted when available</span>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={onClose}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-full"
            >
              Got it, thanks!
            </Button>
            
            <Button 
              onClick={onClose}
              variant="outline"
              className="w-full py-3 rounded-full"
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
