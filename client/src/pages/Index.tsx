
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { User } from "lucide-react";

const Index = () => {
  const { user, isLoading, isAuthenticated, shouldShowAuthButton } = useAuth();
  const typedUser = user as UserType | undefined;
  const [currentScreen, setCurrentScreen] = useState("home");
  const [showGPTModal, setShowGPTModal] = useState(false);
  const [isInDetailedView, setIsInDetailedView] = useState(false);
  const [dashboardKey, setDashboardKey] = useState(0);
  
  // Check if user has completed onboarding from database
  const hasCompletedOnboarding = typedUser?.onboardingCompleted ?? false;
  
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
    completeOnboardingMutation.mutate();
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
    // Check for bypass flag
    const bypassOnboarding = localStorage.getItem("bypassOnboarding") === "true";
    
    // Show onboarding if user hasn't completed it and no bypass flag
    if (!hasCompletedOnboarding && !bypassOnboarding) {
      return (
        <div>
          <OnboardingFlow onComplete={handleOnboardingComplete} />
          <div style={{position: 'fixed', top: '10px', right: '10px', zIndex: 1000}}>
            <Button 
              onClick={() => {
                console.log('Debug: Force complete onboarding');
                completeOnboardingMutation.mutate();
              }}
              className="bg-red-500 text-white"
            >
              Debug: Skip Onboarding
            </Button>
            <Button 
              onClick={() => {
                console.log('Debug: Force show dashboard');
                setCurrentScreen("home");
              }}
              className="bg-blue-500 text-white ml-2"
            >
              Debug: Show Dashboard
            </Button>
            <Button 
              onClick={() => {
                console.log('Debug: Force bypass all checks');
                setCurrentScreen("home");
                // Force bypass by setting a flag in localStorage
                localStorage.setItem("bypassOnboarding", "true");
              }}
              className="bg-green-500 text-white ml-2"
            >
              Debug: Force Bypass
            </Button>
          </div>
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
        {/* Top-right profile bubble inline with page header area */}
        <div className="absolute right-6 top-6 z-40">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-full w-12 h-12 p-0 border-2 border-black bg-white shadow-sm">
                <span className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold tracking-wide text-black">
                  {`${(typedUser?.firstName?.[0] || 'U').toUpperCase()}${(typedUser?.lastName?.[0] || '').toUpperCase()}`}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-2">
                <div className="text-sm font-semibold">{typedUser?.firstName || ''} {typedUser?.lastName || ''}</div>
                <div className="text-xs text-gray-500">{typedUser?.email}</div>
              </div>
              <DropdownMenuItem onClick={() => setCurrentScreen("profile")}>Your account</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('token'); window.location.reload(); }}>Log Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
      
      <GPTModal 
        isOpen={showGPTModal} 
        onClose={() => setShowGPTModal(false)} 
      />
    </div>
  );
};

export default Index;
