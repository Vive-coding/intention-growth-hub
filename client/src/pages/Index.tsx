
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { Dashboard } from "@/components/Dashboard";
import { InsightsScreen } from "@/components/InsightsScreen";
import { GoalsScreen } from "@/components/GoalsScreen";
import { JournalsScreen } from "@/components/JournalsScreen";
import { CommunityScreen } from "@/components/CommunityScreen";
import { ProfileScreen } from "@/components/ProfileScreen";
import MyFocusDashboard from "@/components/focus/MyFocusDashboard";
import SharedLeftNav from "@/components/layout/SharedLeftNav";
import { GPTModal } from "@/components/GPTModal";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";
import { HabitsScreen } from "@/components/HabitsScreen";
import { Landing } from "./Landing";
import { UniformHeader } from "@/components/ui/UniformHeader";
import { RecentJournalsNav } from "@/components/journal/RecentJournalsNav";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { Menu, Home, Target } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";

const Index = () => {
  const { user, isLoading, isAuthenticated, shouldShowAuthButton } = useAuth();
  const typedUser = user as UserType | undefined;
  const [location] = useLocation();
  const [currentScreen, setCurrentScreen] = useState("home");
  
  // Detect route and set appropriate screen
  useEffect(() => {
    if (location === "/profile") {
      setCurrentScreen("profile");
    } else if (location === "/journal") {
      setCurrentScreen("home");
    }
  }, [location]);
  const [showGPTModal, setShowGPTModal] = useState(false);
  const [isInDetailedView, setIsInDetailedView] = useState(false);
  const [dashboardKey, setDashboardKey] = useState(0);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  
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
    localStorage.removeItem('forceShowOnboarding'); // Clear the force flag
    
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

  // Shared habit completion summary for header pill (chat + journal)
  const { data: todayCompletions } = useQuery({
    queryKey: ["/api/habits/today-completions"],
    queryFn: async () => {
      try {
        const resp = await apiRequest("/api/habits/today-completions");
        return resp || { completed: 0, total: 0 };
      } catch {
        return { completed: 0, total: 0 };
      }
    },
    staleTime: 0,
    refetchInterval: 10_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: isAuthenticated,
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
    const bypassValue = localStorage.getItem("bypassOnboarding");
    const bypassOnboarding = bypassValue === "true";
    
    console.log('🔍 renderScreen check:', {
      hasCompletedOnboarding,
      bypassValue,
      bypassOnboarding,
      shouldShowOnboarding: !hasCompletedOnboarding && !bypassOnboarding
    });
    
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
        return (
          <div className="space-y-6">
            <Dashboard 
              key={dashboardKey}
              onOpenGPT={() => setShowGPTModal(true)} 
              onDetailedViewChange={setIsInDetailedView}
              onClearDetailedView={() => {
                console.log('Index: Clearing detailed view from Dashboard');
                setIsInDetailedView(false);
              }}
            />
          </div>
        );
      case "insights":
        return <InsightsScreen />;
      case "habits":
        return <HabitsScreen />;
      case "goals":
        return <GoalsScreen />;
      case "focus":
        return <MyFocusDashboard />;
      case "journals":
        return (
          <JournalsScreen
            initialEntryId={selectedJournalId}
            onBack={() => {
              setCurrentScreen("home");
              setSelectedJournalId(null);
            }}
            onEntryCleared={() => setSelectedJournalId(null)}
          />
        );
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

  const handleReturnToOnboarding = () => {
    // Force onboarding to show by clearing flags and setting force flag
    localStorage.setItem('onboardingCompleted', 'false');
    localStorage.setItem('bypassOnboarding', 'false');
    localStorage.setItem('forceShowOnboarding', 'true'); // Prevent useAuth from overwriting
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    // Navigate to journal route where Index component will show onboarding
    window.location.href = '/journal';
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.reload();
  };

  // Show onboarding in a standalone layout (no left nav) whenever onboarding isn't completed
  const shouldShowOnboarding = !hasCompletedOnboarding && localStorage.getItem("bypassOnboarding") !== "true";
  if (shouldShowOnboarding) {
    const startStepKey = (localStorage.getItem('onboardingStartStep') || undefined) as any;
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col" style={{ minHeight: "100dvh" }}>
        <header className="w-full max-w-5xl mx-auto flex items-center justify-between px-4 py-4">
          <a href="/journal" className="flex items-center gap-2">
            <img src="/goodhabit.ai(200 x 40 px).png" alt="GoodHabit" className="h-6" />
          </a>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-3 px-3 py-2 rounded-xl border hover:bg-gray-50">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center text-sm font-bold">
                  {(typedUser?.firstName?.[0] || "U").toUpperCase()}{(typedUser?.lastName?.[0] || "").toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-gray-900">{typedUser?.firstName || "User"} {typedUser?.lastName || ""}</div>
                  <div className="text-xs text-gray-500">{typedUser?.email || ""}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleReturnToOnboarding}>Preferences</DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>Log Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 pb-8">
          <div className="w-full max-w-4xl">
            <OnboardingFlow onComplete={handleOnboardingComplete} startStepKey={startStepKey} />
          </div>
        </main>
      </div>
    );
  }
 
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50" style={{ minHeight: "100dvh" }}>
      <div className="flex overflow-hidden" style={{ height: "100dvh" }}>
        <SharedLeftNav
          onReturnToOnboarding={handleReturnToOnboarding}
          onLogout={handleLogout}
        >
          <RecentJournalsNav
            onSelectEntry={(id) => {
              setSelectedJournalId(id);
              setCurrentScreen("journals");
            }}
          />
        </SharedLeftNav>
        
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top header: mobile nav + global mode toggle + habit pill */}
          <div className="px-3 sm:px-4 py-3 border-b border-transparent bg-transparent z-30 overflow-x-hidden shrink-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="lg:hidden">
                  <Sheet open={showMobileNav} onOpenChange={setShowMobileNav}>
                    <SheetTrigger asChild>
                      <button aria-label="Open menu" className="w-9 h-9 rounded-lg border flex items-center justify-center text-gray-700 shrink-0">
                        <Menu className="w-5 h-5" />
                      </button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-80" aria-describedby={undefined}>
                      <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                      <div className="flex flex-col h-full bg-gradient-to-br from-green-50 via-white to-blue-50">
                        <div className="px-4 py-4 border-b shrink-0 flex justify-center">
                          <img src="/goodhabit.ai(200 x 40 px).png" alt="GoodHabit" className="h-6" />
                        </div>
                        <nav className="px-2 py-2 space-y-1 flex-1 overflow-y-auto min-h-0">
                          <a href="/?new=1" className="flex items-center gap-3 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700" onClick={() => setShowMobileNav(false)}>
                            <Home className="w-4 h-4 text-emerald-700" />
                            <span className="text-sm font-medium">Home</span>
                          </a>
                          <a href="/focus" className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50" onClick={() => setShowMobileNav(false)}>
                            <Target className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium">My Focus</span>
                          </a>
                          <div className="mt-4 px-2">
                            <RecentJournalsNav
                              onSelectEntry={(id) => {
                                setSelectedJournalId(id);
                                setCurrentScreen("journals");
                                setShowMobileNav(false);
                              }}
                            />
                          </div>
                        </nav>
                        <div className="p-3 border-t shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                                <div className="w-10 h-10 rounded-full border-2 border-black bg-white flex items-center justify-center text-sm font-bold shrink-0">
                                  {`${((typedUser as any)?.firstName?.[0] || 'U').toUpperCase()}${((typedUser as any)?.lastName?.[0] || '').toUpperCase()}`}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <div className="text-sm font-semibold text-gray-900 truncate">{(typedUser as any)?.firstName || 'User'} {(typedUser as any)?.lastName || ''}</div>
                                  <div className="text-xs text-gray-500 truncate">{(typedUser as any)?.email || ''}</div>
                                </div>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                              <DropdownMenuItem onClick={() => setCurrentScreen("profile")}>Your account</DropdownMenuItem>
                              <DropdownMenuItem onClick={handleReturnToOnboarding}>Return to Onboarding</DropdownMenuItem>
                              <DropdownMenuItem onClick={handleLogout}>Log Out</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
                <div className="text-sm sm:text-base md:text-lg font-semibold text-gray-800 truncate min-w-0">
                  {/* Page greeting is rendered within each screen (e.g., Dashboard); no separate title needed here. */}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0 pr-1 sm:pr-2">
                <ModeToggle className="hidden md:flex shrink-0" />
                {todayCompletions && todayCompletions.total > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      (window as any).openHabitsPanel?.();
                    }}
                    className="px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium shrink-0 hover:bg-teal-200 transition-colors"
                  >
                    {todayCompletions.completed}/{todayCompletions.total} ✓
                  </button>
                )}
                <div className="lg:hidden shrink-0 flex items-center">
                  <ModeToggle className="md:hidden flex" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-4 sm:px-6 lg:px-8 py-6">
            {renderScreen()}
          </div>
        </main>
      </div>
      
      <GPTModal 
        isOpen={showGPTModal} 
        onClose={() => setShowGPTModal(false)} 
      />
    </div>
  );
};

export default Index;
