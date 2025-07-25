
import { Home, TrendingUp, Target, Users, User } from "lucide-react";

interface NavigationBarProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
}

export const NavigationBar = ({ currentScreen, onNavigate }: NavigationBarProps) => {
  const navItems = [
    { id: "home", icon: Home, label: "Home" },
    { id: "insights", icon: TrendingUp, label: "Insights" },
    { id: "goals", icon: Target, label: "Goals" },
    { id: "community", icon: Users, label: "Community" },
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
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                isActive 
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
