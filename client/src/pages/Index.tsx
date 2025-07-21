
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

const Index = () => {
  const [currentScreen, setCurrentScreen] = useState("onboarding");
  const [showGPTModal, setShowGPTModal] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
    setCurrentScreen("home");
  };

  const renderScreen = () => {
    if (!hasCompletedOnboarding && currentScreen === "onboarding") {
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
