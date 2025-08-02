
import { Home, TrendingUp, Target, BookOpen, User, Flame } from "lucide-react";

interface NavigationBarProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  isInDetailedView?: boolean;
  onNavigateHome?: () => void;
}

export const NavigationBar = ({ currentScreen, onNavigate, isInDetailedView, onNavigateHome }: NavigationBarProps) => {
  const navItems = [
    { id: "home", icon: Home, label: "Home" },
    { id: "journals", icon: BookOpen, label: "Journals" },
    { id: "insights", icon: TrendingUp, label: "Insights" },
    { id: "goals", icon: Target, label: "Goals" },
    { id: "habits", icon: Flame, label: "Habits" },
    { id: "profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200">
      <div className="flex justify-around items-center py-2 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "home" && isInDetailedView && onNavigateHome) {
                  onNavigateHome();
                } else {
                  onNavigate(item.id);
                }
              }}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                (isActive && !isInDetailedView) || (item.id === "home" && isInDetailedView)
                  ? "text-green-600 bg-green-50" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
