
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { Landing } from "./Landing";
import { UniformHeader } from "@/components/ui/UniformHeader";

const Index = () => {
  const { user, isLoading, isAuthenticated, shouldShowAuthButton } = useAuth();
  const typedUser = user as UserType | undefined;
  const [currentScreen, setCurrentScreen] = useState("home");
  const [showGPTModal, setShowGPTModal] = useState(false);
  const [isInDetailedView, setIsInDetailedView] = useState(false);
  const [dashboardKey, setDashboardKey] = useState(0);
  
  // Check if user has completed onboarding - localStorage takes absolute priority
  const localStorageOnboarding = localStorage.getItem("onboardingCompleted");
  const hasCompletedOnboarding = localStorageOnboarding !== null ? localStorageOnboarding === "true" : (typedUser?.onboardingCompleted || false);
  
  // Debug onboarding logic
  console.log('🔍 Onboarding Debug:', {
    localStorageOnboarding: localStorage.getItem("onboardingCompleted"),
    databaseOnboarding: typedUser?.onboardingCompleted,
    finalResult: hasCompletedOnboarding,
    bypassOnboarding: localStorage.getItem("bypassOnboarding")
  });
  
  // Move all hooks to the top before any conditional returns
  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/users/complete-onboarding', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      console.log('Onboarding completed successfully');
      // Invalidate user query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      // Force a small delay to ensure the query refetches
      setTimeout(() => {
        setCurrentScreen("home");
      }, 100);
    },
  });

  const handleOnboardingComplete = () => {
    console.log('handleOnboardingComplete called');
    
    // Set localStorage to mark onboarding as completed
    localStorage.setItem('onboardingCompleted', 'true');
    
    // Invalidate user query to refetch updated data
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    
    // Force a small delay to ensure the query refetches
    setTimeout(() => {
      setCurrentScreen("home");
    }, 100);
  };
  
  // Debug detailed view state changes
  console.log('Index component state:', {
    currentScreen,
    isInDetailedView,
    hasCompletedOnboarding,
    user: typedUser,
    isLoading,
    isAuthenticated,
    shouldShowAuthButton
  });

  // If not authenticated and not loading, show landing page
  if (!isLoading && !isAuthenticated) {
    return <Landing />;
  }

  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    // Check for bypass flag (important for local development)
    const bypassOnboarding = localStorage.getItem("bypassOnboarding") === "true";
    
    // Show onboarding if user hasn't completed it and no bypass flag
    if (!hasCompletedOnboarding && !bypassOnboarding) {
      return (
        <div>
          <OnboardingFlow onComplete={handleOnboardingComplete} />
        </div>
      );
    }

    // Always show the main app if authenticated or bypassed
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
      {/* Uniform Header - always visible when authenticated */}
      <div className="relative">
        <UniformHeader 
          user={typedUser}
          onNavigate={setCurrentScreen}
          onReturnToOnboarding={() => {
            // Set localStorage to force onboarding mode
            localStorage.setItem('onboardingCompleted', 'false');
            localStorage.removeItem('bypassOnboarding');
            
            // Force the user query to refetch
            queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
            
            // Refresh the page to trigger onboarding flow
            window.location.reload();
          }}
          onLogout={() => { 
            localStorage.removeItem('user'); 
            localStorage.removeItem('token'); 
            window.location.reload(); 
          }}
        />
      </div>

      {/* Conditionally show sidebar and navigation based on onboarding status */}
      {hasCompletedOnboarding ? (
        <>
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
          
          <div className="lg:ml-64 relative">
            {renderScreen()}
          </div>
          
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
        </>
      ) : (
        // Show onboarding without sidebar/navigation
        renderScreen()
      )}
      
      <GPTModal 
        isOpen={showGPTModal} 
        onClose={() => setShowGPTModal(false)} 
      />
    </div>
  );
};

export default Index;
