import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePageTracking } from "@/hooks/usePageTracking";
import { queryClient } from "@/lib/queryClient";
import Index from "./pages/Index";
import ChatHome from "./pages/chat/ChatHome";
import { Landing } from "./pages/Landing";
import NotFound from "./pages/NotFound";
import FocusPage from "./pages/Focus";
import { InsightsScreen } from "./components/InsightsScreen";
import { GoalsScreen } from "./components/GoalsScreen";
import TestCardsPage from "./pages/TestCards";
import { HabitsScreen } from "./components/HabitsScreen";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Track page views
  usePageTracking();

  return (
    <Switch>
      {/* Public landing page */}
      <Route path="/landing" component={Landing} />

      {/* Dashboard/Journal mode */}
      <Route path="/journal" component={Index} />

      {/* Other explicit routes */}
      <Route path="/profile" component={Index} />
      <Route path="/insights" component={InsightsScreen} />
      <Route path="/goals" component={GoalsScreen} />
      <Route path="/focus" component={FocusPage} />
      <Route path="/habits" component={HabitsScreen} />
      <Route path="/test-cards" component={TestCardsPage} />

      {/* Chat routes (placed after explicit ones to avoid collisions) */}
      <Route path="/:threadId" component={ChatHome} />
      <Route path="/" component={ChatHome} />

      {/* Catch-all */}
      <Route component={NotFound} />
    </Switch>
  );
}

const App = () => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position={isMobile ? "top-center" : "bottom-right"} />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
