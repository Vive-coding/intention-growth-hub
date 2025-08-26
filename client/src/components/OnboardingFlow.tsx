
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Shield, MessageCircle, ChevronRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: <div className="flex flex-col items-center space-y-4 mb-6">
        <Logo size="lg" className="text-purple-600" />
        <Heart className="w-12 h-12 text-green-500" />
      </div>,
      title: "Welcome",
      subtitle: "Your personal companion for reflection and growth",
      description: "This app is the home for all the insights you discover with your AI companion. Together, we'll help you understand patterns, achieve goals, and celebrate your journey.",
    },
    {
      icon: <Shield className="w-16 h-16 text-blue-500 mx-auto mb-6" />,
      title: "Your Privacy Matters",
      subtitle: "Complete data security and privacy",
      description: "Your conversations and insights are encrypted and private. We never share your personal data, and you have complete control over your information at all times.",
    },
    {
      icon: <MessageCircle className="w-16 h-16 text-purple-500 mx-auto mb-6" />,
      title: "Connect Your GPT Companion",
      subtitle: "Ready to begin your journey?",
      description: "Your personalized AI companion is waiting in GPT. This is where the magic happens - through meaningful conversations, we'll help you discover insights about yourself.",
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md mx-auto shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8 text-center">
          {currentStepData.icon}
          
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {currentStepData.title}
          </h1>
          
          <p className="text-lg text-green-600 font-medium mb-4">
            {currentStepData.subtitle}
          </p>
          
          <p className="text-gray-600 leading-relaxed mb-8">
            {currentStepData.description}
          </p>

          <div className="flex justify-center mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full mx-1 transition-colors ${
                  index === currentStep ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleNext}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-full text-lg font-medium"
            >
              {currentStep === steps.length - 1 ? (
                "Open and Link my GPT"
              ) : (
                <>
                  Continue <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => {
                console.log('Skip button clicked');
                alert('Skip button clicked!');
                onComplete();
              }}
              variant="outline"
              className="w-full border-gray-300 text-gray-600 hover:bg-gray-50 py-3 rounded-full text-lg font-medium"
            >
              Skip for Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
