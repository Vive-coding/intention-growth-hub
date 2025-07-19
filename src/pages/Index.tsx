
import { useState } from "react";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { Dashboard } from "@/components/Dashboard";
import { InsightsScreen } from "@/components/InsightsScreen";
import { GoalsScreen } from "@/components/GoalsScreen";
import { CommunityScreen } from "@/components/CommunityScreen";
import { ProfileScreen } from "@/components/ProfileScreen";
import { NavigationBar } from "@/components/NavigationBar";
import { ResponsiveSidebar } from "@/components/ResponsiveSidebar";
import { ChatPanel } from "@/components/ChatPanel";

const Index = () => {
  const [currentScreen, setCurrentScreen] = useState("onboarding");
  const [showChatPanel, setShowChatPanel] = useState(false);
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
        return <Dashboard onOpenGPT={() => setShowChatPanel(true)} />;
      case "insights":
        return <InsightsScreen />;
      case "goals":
        return <GoalsScreen />;
      case "community":
        return <CommunityScreen />;
      case "profile":
        return <ProfileScreen />;
      default:
        return <Dashboard onOpenGPT={() => setShowChatPanel(true)} />;
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
      
      <div className={`${hasCompletedOnboarding ? "lg:ml-64" : ""} ${showChatPanel ? "xl:mr-80 2xl:mr-96" : ""}`}>
        {renderScreen()}
      </div>
      
      {hasCompletedOnboarding && (
        <NavigationBar 
          currentScreen={currentScreen} 
          onNavigate={setCurrentScreen} 
        />
      )}
      
      {hasCompletedOnboarding && (
        <ChatPanel 
          isOpen={showChatPanel} 
          onToggle={() => setShowChatPanel(!showChatPanel)} 
        />
      )}
    </div>
  );
};

export default Index;
