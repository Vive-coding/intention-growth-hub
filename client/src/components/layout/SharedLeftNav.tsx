import { Home, Target } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function SharedLeftNav({ children }: { children?: React.ReactNode }) {
    const [loc] = useLocation();
    const { user } = useAuth();
	const NavItem = ({ href, icon: Icon, label }: any) => {
		const active = loc === href || (href !== '/' && loc.startsWith(href));
		return (
			<Link href={href}>
				<div className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors cursor-pointer ${active ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700 hover:bg-gray-50'}`}>
					<Icon className={`w-4 h-4 ${active ? 'text-emerald-700' : 'text-gray-500'}`} />
					<span className="text-sm font-medium">{label}</span>
				</div>
			</Link>
		);
	};

    return (
        <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r bg-white/90 backdrop-blur-sm">
            <div className="px-4 py-4">
                <img src="/goodhabit.ai(200 x 40 px).png" alt="GoodHabit" className="h-6" />
            </div>
            <nav className="px-2 py-2 space-y-1 flex-1">
                <NavItem href="/chat?new=1" icon={Home} label="Home" />
                <NavItem href="/focus" icon={Target} label="My Focus" />
                {children && (
                    <div className="mt-4">
                        {children}
                    </div>
                )}
            </nav>
            <div className="p-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50">
                            <div className="text-sm font-semibold text-gray-900">{(user as any)?.firstName || 'User'} {(user as any)?.lastName || ''}</div>
                            <div className="text-xs text-gray-500">{(user as any)?.email || ''}</div>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuItem onClick={() => window.location.assign('/profile')}>Your account</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('token'); window.location.reload(); }}>Log Out</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
}
