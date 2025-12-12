import React from 'react';
import { Logo } from './Logo';
import { Button } from './button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';

interface UniformHeaderProps {
  user: {
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null;
  onNavigate: (screen: string) => void;
  onReturnToOnboarding: () => void;
  onLogout: () => void;
  rightSlot?: React.ReactNode;
  profileVisibility?: "all" | "mobile";
  showLogo?: boolean;
}

export const UniformHeader: React.FC<UniformHeaderProps> = ({ 
  user, 
  onNavigate, 
  onReturnToOnboarding, 
  onLogout,
  rightSlot,
  profileVisibility = "all",
  showLogo = true,
}) => {
  if (!user) return null;

  return (
    <header className="w-full bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm z-50">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3">
        <div className="flex items-center min-h-[32px]">
          {showLogo ? <Logo size="md" className="text-purple-600" /> : null}
        </div>

        {/* Profile Circle - Right side */}
        <div className="flex items-center gap-4">
          {rightSlot}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={`rounded-full w-10 h-10 sm:w-12 sm:h-12 p-0 border-2 border-black bg-white shadow-sm ${
                  profileVisibility === "mobile" ? "lg:hidden" : ""
                }`}
              >
                <span className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-sm sm:text-base font-bold tracking-wide text-black">
                  {`${(user?.firstName?.[0] || 'U').toUpperCase()}${(user?.lastName?.[0] || '').toUpperCase()}`}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-2">
                <div className="text-sm font-semibold">{user?.firstName || ''} {user?.lastName || ''}</div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
              <DropdownMenuItem onClick={() => onNavigate("profile")}>Your account</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { localStorage.setItem('onboardingStartStep','goal_setting_ability'); onReturnToOnboarding(); }}>Preferences</DropdownMenuItem>
              <DropdownMenuItem onClick={onLogout}>Log Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
