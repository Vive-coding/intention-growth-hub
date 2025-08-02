
import { useState, useRef } from "react";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { Dashboard } from "@/components/Dashboard";
import { InsightsScreen } from "@/components/InsightsScreen";
import { GoalsScreen } from "@/components/GoalsScreen";
import { JournalsScreen } from "@/components/JournalsScreen";
import { CommunityScreen } from "@/components/CommunityScreen";
import { ProfileScreen } from "@/components/ProfileScreen";
import { NavigationBar } from "@/components/NavigationBar";
import { ResponsiveSidebar } from "@/components/ResponsiveSidebar";
import { GPTModal } from "@/components/GPTModal";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";
import { HabitsScreen } from "@/components/HabitsScreen";

const Index = () => {
  const { user, isLoading } = useAuth();
  const typedUser = user as UserType | undefined;
  const [currentScreen, setCurrentScreen] = useState("home");
  const [showGPTModal, setShowGPTModal] = useState(false);
  const [isInDetailedView, setIsInDetailedView] = useState(false);
  const [dashboardKey, setDashboardKey] = useState(0);
  
  // Check if user has completed onboarding from database
  const hasCompletedOnboarding = typedUser?.onboardingCompleted ?? false;
  
  // Debug detailed view state changes
  console.log('Index component state:', {
    currentScreen,
    isInDetailedView,
    hasCompletedOnboarding
  });

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
        return <Dashboard 
          key={dashboardKey}
          onOpenGPT={() => setShowGPTModal(true)} 
          onDetailedViewChange={setIsInDetailedView}
          onClearDetailedView={() => {
            console.log('Index: Clearing detailed view from Dashboard');
            setIsInDetailedView(false);
          }}
        />;
      case "insights":
        return <InsightsScreen />;
      case "habits":
        return <HabitsScreen />;
      case "goals":
        return <GoalsScreen />;
      case "journals":
        return <JournalsScreen />;
      case "community":
        return <CommunityScreen />;
      case "profile":
        return <ProfileScreen />;
      default:
        return <Dashboard 
          key={dashboardKey}
          onOpenGPT={() => setShowGPTModal(true)} 
          onDetailedViewChange={setIsInDetailedView}
          onClearDetailedView={() => {
            console.log('Index: Clearing detailed view from Dashboard');
            setIsInDetailedView(false);
          }}
        />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {hasCompletedOnboarding && (
        <ResponsiveSidebar 
          currentScreen={currentScreen} 
          onNavigate={setCurrentScreen}
          isInDetailedView={isInDetailedView}
          onNavigateHome={() => {
            console.log('Index: Home navigation triggered, clearing detailed view');
            setCurrentScreen("home");
            setIsInDetailedView(false);
            setDashboardKey(prev => prev + 1); // Force Dashboard re-render
          }}
        />
      )}
      
      <div className={hasCompletedOnboarding ? "lg:ml-64" : ""}>
        {renderScreen()}
      </div>
      
      {hasCompletedOnboarding && (
        <NavigationBar 
          currentScreen={currentScreen} 
          onNavigate={setCurrentScreen}
          isInDetailedView={isInDetailedView}
          onNavigateHome={() => {
            console.log('Index: Mobile Home navigation triggered, clearing detailed view');
            setCurrentScreen("home");
            setIsInDetailedView(false);
            setDashboardKey(prev => prev + 1); // Force Dashboard re-render
          }}
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
