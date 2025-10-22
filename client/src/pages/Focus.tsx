import MyFocusDashboard from "@/components/focus/MyFocusDashboard";
import SharedLeftNav from "@/components/layout/SharedLeftNav";
import ConversationsList from "@/components/chat/ConversationsList";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Home, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function FocusPage() {
	const { user } = useAuth();
	
	return (
		<div className="min-h-screen flex flex-col lg:flex-row">
			{/* Desktop left nav */}
			<SharedLeftNav>
				<ConversationsList />
			</SharedLeftNav>
			
			{/* Mobile header with hamburger */}
			<div className="lg:hidden px-4 py-3 border-b bg-white sticky top-0 z-30">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Sheet>
							<SheetTrigger asChild>
								<button aria-label="Open menu" className="w-9 h-9 rounded-lg border flex items-center justify-center text-gray-700">
									<Menu className="w-5 h-5" />
								</button>
							</SheetTrigger>
							<SheetContent side="left" className="p-0 w-80">
								<div className="flex flex-col h-full">
									<div className="px-4 py-4 border-b">
										<img src="/goodhabit.ai(200 x 40 px).png" alt="GoodHabit" className="h-6" />
									</div>
									<nav className="px-2 py-2 space-y-1 flex-1">
										<a href="/chat?new=1" className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50">
											<Home className="w-4 h-4 text-gray-500" />
											<span className="text-sm font-medium">Home</span>
										</a>
										<a href="/focus" className="flex items-center gap-3 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700">
											<Target className="w-4 h-4 text-emerald-700" />
											<span className="text-sm font-medium">My Focus</span>
										</a>
										<div className="mt-4 px-2">
											<ConversationsList />
										</div>
									</nav>
									<div className="p-3 border-t">
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
								</div>
							</SheetContent>
						</Sheet>
						<img src="/goodhabit.ai(200 x 40 px).png" alt="GoodHabit" className="h-5" />
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button className="w-9 h-9 rounded-full border-2 border-black bg-white flex items-center justify-center text-xs font-bold">
								{`${((user as any)?.firstName?.[0] || 'U').toUpperCase()}${((user as any)?.lastName?.[0] || '').toUpperCase()}`}
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<div className="px-2 py-2">
								<div className="text-sm font-semibold">{(user as any)?.firstName || ''} {(user as any)?.lastName || ''}</div>
								<div className="text-xs text-gray-500">{(user as any)?.email}</div>
							</div>
							<DropdownMenuItem onClick={() => window.location.assign('/profile')}>Your account</DropdownMenuItem>
							<DropdownMenuItem onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('token'); window.location.reload(); }}>Log Out</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<main className="flex-1">
				<MyFocusDashboard />
			</main>
		</div>
	);
}
