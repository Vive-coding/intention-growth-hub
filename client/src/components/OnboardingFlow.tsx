
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Shield, MessageCircle, ChevronRight, ChevronLeft, BookOpen } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: <Heart className="w-16 h-16 text-green-500 mx-auto" />,
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
      icon: <BookOpen className="w-16 h-16 text-purple-500 mx-auto" />,
      title: "Write Your First Journal Entry",
      subtitle: "Ready to reflect on your day?",
      description: "Start your journey by writing about your day, goals, or any specific aspects you want to focus on. This will help us understand your patterns and provide personalized insights.",
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
    <div className="min-h-screen flex items-start justify-center pt-20 p-6">
      <Card className="w-full max-w-md mx-auto shadow-xl border-0 bg-white/80 backdrop-blur-sm min-h-[400px] sm:min-h-[500px]">
        <CardContent className="p-4 sm:p-6 lg:p-8 text-center">
          {/* Icon section - responsive height and margin */}
          <div className="min-h-[16] sm:min-h-[20] mb-1 flex items-center justify-center">
            {currentStepData.icon}
          </div>
          
          {/* Title section - responsive height and margin */}
          <div className="min-h-[10] sm:min-h-[12] mb-1 flex items-center justify-center">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {currentStepData.title}
            </h1>
          </div>
          
          {/* Subtitle section - responsive height and margin */}
          <div className="min-h-[8] sm:min-h-[10] mb-4 flex items-center justify-center">
            <p className="text-base sm:text-lg text-green-600 font-medium">
              {currentStepData.subtitle}
            </p>
          </div>
          
          {/* Description section - responsive height */}
          <div className="min-h-[20] sm:min-h-[24] mb-8 flex items-center justify-center">
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed text-center px-2">
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
