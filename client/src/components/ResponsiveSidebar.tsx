import { Home, TrendingUp, Target, BookOpen, User, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ResponsiveSidebarProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  className?: string;
  isInDetailedView?: boolean;
  onNavigateHome?: () => void;
}

export const ResponsiveSidebar = ({ currentScreen, onNavigate, className, isInDetailedView, onNavigateHome }: ResponsiveSidebarProps) => {
  const navItems = [
    { id: "home", icon: Home, label: "Home" },
    { id: "journals", icon: BookOpen, label: "Journals" },
    { id: "insights", icon: TrendingUp, label: "Insights" },
    { id: "goals", icon: Target, label: "Goals" },
    { id: "habits", icon: Flame, label: "Habits" },
    { id: "profile", icon: User, label: "Profile" },
  ];

  return (
    <aside className={cn(
      "hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border",
      className
    )}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-sidebar-foreground">
            Life Growth Hub
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;
            
            return (
              <Button
                key={item.id}
                variant={isActive ? "secondary" : "ghost"}
                onClick={() => {
                  console.log('Home button clicked:', {
                    itemId: item.id,
                    isInDetailedView,
                    hasOnNavigateHome: !!onNavigateHome
                  });
                  if (item.id === "home" && isInDetailedView && onNavigateHome) {
                    console.log('Calling onNavigateHome');
                    onNavigateHome();
                  } else {
                    console.log('Calling onNavigate with:', item.id);
                    onNavigate(item.id);
                  }
                }}
                className={cn(
                  "w-full justify-start px-4 py-3 h-auto",
                  (isActive && !isInDetailedView) || (item.id === "home" && isInDetailedView)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};