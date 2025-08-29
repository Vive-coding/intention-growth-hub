
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Shield, MessageCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: <div className="flex flex-col items-center space-y-4">
        <Logo size="lg" className="text-purple-600" />
        <Heart className="w-12 h-12 text-green-500" />
      </div>,
      title: "Welcome",
      subtitle: "Your personal companion for reflection and growth",
      description: "This app is the home for all the insights you discover with your AI companion. Together, we'll help you understand patterns, achieve goals, and celebrate your journey.",
    },
    {
      icon: <Shield className="w-16 h-16 text-blue-500 mx-auto" />,
      title: "Your Privacy Matters",
      subtitle: "Complete data security and privacy",
      description: "Your conversations and insights are encrypted and private. We never share your personal data, and you have complete control over your information at all times.",
    },
    {
      icon: <MessageCircle className="w-16 h-16 text-purple-500 mx-auto" />,
      title: "Write Your First Journal Entry",
      subtitle: "Ready to reflect on your day?",
      description: "Start your journey by writing about your day, goals, or any specific aspects you want to focus on - whether it's your health, career, relationships, or personal growth. This will help us understand your patterns and provide personalized insights.",
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md mx-auto shadow-xl border-0 bg-white/80 backdrop-blur-sm min-h-[500px]">
        <CardContent className="p-8 text-center">
          {/* Icon section - fixed height */}
          <div className="h-32 mb-4 flex items-center justify-center">
            {currentStepData.icon}
          </div>
          
          {/* Title section - fixed height */}
          <div className="h-12 mb-2 flex items-center justify-center">
            <h1 className="text-2xl font-bold text-gray-800">
              {currentStepData.title}
            </h1>
          </div>
          
          {/* Subtitle section - fixed height */}
          <div className="h-8 mb-4 flex items-center justify-center">
            <p className="text-lg text-green-600 font-medium">
              {currentStepData.subtitle}
            </p>
          </div>
          
          {/* Description section - fixed height */}
          <div className="h-24 mb-8 flex items-center justify-center">
            <p className="text-gray-600 leading-relaxed text-center">
              {currentStepData.description}
            </p>
          </div>

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
                "Start Journaling"
              ) : (
                <>
                  Continue <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            
            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button 
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-50 py-3 rounded-full text-lg font-medium"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  Back
                </Button>
              )}
              
              <Button 
                onClick={onComplete}
                variant="outline"
                className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-50 py-3 rounded-full text-lg font-medium"
              >
                Skip for Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
