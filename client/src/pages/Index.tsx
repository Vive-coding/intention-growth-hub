
import { useState } from "react";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { Dashboard } from "@/components/Dashboard";
import { InsightsScreen } from "@/components/InsightsScreen";
import { GoalsScreen } from "@/components/GoalsScreen";
import { CommunityScreen } from "@/components/CommunityScreen";
import { ProfileScreen } from "@/components/ProfileScreen";
import { NavigationBar } from "@/components/NavigationBar";
import { ResponsiveSidebar } from "@/components/ResponsiveSidebar";
import { GPTModal } from "@/components/GPTModal";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";

const Index = () => {
  const { user, isLoading } = useAuth();
  const typedUser = user as UserType | undefined;
  const [currentScreen, setCurrentScreen] = useState("home");
  const [showGPTModal, setShowGPTModal] = useState(false);
  
  // Check if user has completed onboarding from database
  const hasCompletedOnboarding = typedUser?.onboardingCompleted ?? false;

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/users/complete-onboarding', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      // Invalidate user query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setCurrentScreen("home");
    },
  });

  const handleOnboardingComplete = () => {
    completeOnboardingMutation.mutate();
  };

  const renderScreen = () => {
    // Show onboarding if user hasn't completed it
    if (!hasCompletedOnboarding && !isLoading) {
      return <OnboardingFlow onComplete={handleOnboardingComplete} />;
    }

    switch (currentScreen) {
      case "home":
        return <Dashboard onOpenGPT={() => setShowGPTModal(true)} />;
      case "insights":
        return <InsightsScreen />;
      case "goals":
        return <GoalsScreen />;
      case "community":
        return <CommunityScreen />;
      case "profile":
        return <ProfileScreen />;
      default:
        return <Dashboard onOpenGPT={() => setShowGPTModal(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {hasCompletedOnboarding && (
        <ResponsiveSidebar 
          currentScreen={currentScreen} 
          onNavigate={setCurrentScreen} 
        />
      )}
      
      <div className={hasCompletedOnboarding ? "lg:ml-64" : ""}>
        {renderScreen()}
      </div>
      
      {hasCompletedOnboarding && (
        <NavigationBar 
          currentScreen={currentScreen} 
          onNavigate={setCurrentScreen} 
        />
      )}
      
      <GPTModal 
        isOpen={showGPTModal} 
        onClose={() => setShowGPTModal(false)} 
      />
    </div>
  );
};

export default Index;
