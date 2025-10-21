import { Home, MessageSquare, Target } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function SharedLeftNav() {
	const [loc] = useLocation();
	const NavItem = ({ href, icon: Icon, label }: any) => {
		const active = loc === href || (href !== '/' && loc.startsWith(href));
		return (
			<Link href={href}>
				<a className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${active ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700 hover:bg-gray-50'}`}>
					<Icon className={`w-4 h-4 ${active ? 'text-emerald-700' : 'text-gray-500'}`} />
					<span className="text-sm font-medium">{label}</span>
				</a>
			</Link>
		);
	};

	return (
		<aside className="hidden lg:flex lg:flex-col lg:w-64 border-r bg-white/90 backdrop-blur-sm">
			<div className="px-4 py-4 text-lg font-semibold text-gray-900">GoodHabit</div>
			<nav className="px-2 py-2 space-y-1">
				<NavItem href="/" icon={Home} label="Home" />
				<NavItem href="/focus" icon={Target} label="My Focus" />
				<NavItem href="/chat" icon={MessageSquare} label="Conversations" />
			</nav>
			<div className="mt-6 px-4 text-[10px] uppercase tracking-wide text-gray-500">Conversations</div>
			{/* Placeholder for conversation list; chat page will render actual list */}
		</aside>
	);
}
