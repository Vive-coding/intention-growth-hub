import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import Index from "./pages/Index";
import { Landing } from "./pages/Landing";
import NotFound from "./pages/NotFound";
import InsightsPage from "./pages/insights";
import { HabitsScreen } from "./components/HabitsScreen";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
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
