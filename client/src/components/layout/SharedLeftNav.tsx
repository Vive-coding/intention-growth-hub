import { Home, Target } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
};

interface SharedLeftNavProps {
  navItems?: NavItem[];
  children?: React.ReactNode;
  onReturnToOnboarding?: () => void;
  onLogout?: () => void;
}

export default function SharedLeftNav({ navItems, children, onReturnToOnboarding, onLogout }: SharedLeftNavProps) {
  const [loc] = useLocation();
  const { user } = useAuth();

  const handleReturnToOnboarding = () => {
    if (onReturnToOnboarding) {
      onReturnToOnboarding();
    } else {
      // Force onboarding to show by clearing flags and setting force flag
      localStorage.setItem("onboardingCompleted", "false");
      localStorage.setItem("bypassOnboarding", "false");
      localStorage.setItem("forceShowOnboarding", "true"); // Prevent useAuth from overwriting
      window.location.href = "/journal";
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      window.location.reload();
    }
  };

  const defaultNavItems: NavItem[] = navItems ?? [
    { href: "/?new=1", icon: Home, label: "Home", exact: true },
    { href: "/focus", icon: Target, label: "My Focus" },
  ];

  const NavItemComponent = ({ href, icon: Icon, label, exact }: NavItem) => {
    const [path] = loc.split("?");
    const normalizedLoc = path && path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path || "/";
    const baseHref = href.split("?")[0] || "/";
    const normalizedHref =
      baseHref.endsWith("/") && baseHref.length > 1 ? baseHref.slice(0, -1) : baseHref;
    const active = exact
      ? normalizedLoc === normalizedHref
      : normalizedLoc === normalizedHref || (normalizedHref !== "/" && normalizedLoc.startsWith(normalizedHref));

    return (
      <Link href={href}>
        <div
          className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors cursor-pointer ${
            active ? "bg-emerald-50 text-emerald-700" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Icon className={`w-4 h-4 ${active ? "text-emerald-700" : "text-gray-500"}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r bg-gradient-to-br from-green-50 via-white to-blue-50 h-full">
      <div className="px-4 py-4 shrink-0 flex justify-center">
        <img src="/goodhabit.ai(200 x 40 px).png" alt="GoodHabit" className="h-6" />
      </div>
      <nav className="px-2 py-2 space-y-1 flex-1 overflow-y-auto min-h-0">
        {defaultNavItems.map((item) => (
          <NavItemComponent key={item.href} {...item} />
        ))}

        {children && <div className="mt-4">{children}</div>}
      </nav>
      <div className="p-3 border-t shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
              <div className="w-10 h-10 rounded-full border-2 border-black bg-white flex items-center justify-center text-sm font-bold shrink-0">
                {`${((user as any)?.firstName?.[0] || "U").toUpperCase()}${((user as any)?.lastName?.[0] || "").toUpperCase()}`}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {(user as any)?.firstName || "User"} {(user as any)?.lastName || ""}
                </div>
                <div className="text-xs text-gray-500 truncate">{(user as any)?.email || ""}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => window.location.assign("/profile")}>Your account</DropdownMenuItem>
            <DropdownMenuItem onClick={handleReturnToOnboarding}>Return to Onboarding</DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>Log Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
