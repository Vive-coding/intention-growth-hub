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
import InsightsPage from "./pages/insights";
import TestCardsPage from "./pages/TestCards";
import { HabitsScreen } from "./components/HabitsScreen";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Track page views
  usePageTracking();

  return (
    <Switch>
      {/* New chat-first routes */}
      <Route path="/chat" component={ChatHome} />
      <Route path="/chat/:threadId" component={ChatHome} />
      
      {/* Test cards route - accessible from root */}
      <Route path="/test-cards" component={TestCardsPage} />

      {/* Temporary: keep existing index as fallback until we flip default */}
      <Route path="/" component={Index} />
      <Route path="/landing" component={Landing} />
      <Route path="/insights" component={InsightsPage} />
      <Route path="/habits" component={HabitsScreen} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
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
