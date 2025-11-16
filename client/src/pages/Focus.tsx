import MyFocusDashboard from "@/components/focus/MyFocusDashboard";
import SharedLeftNav from "@/components/layout/SharedLeftNav";
import ConversationsList from "@/components/chat/ConversationsList";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, MessageCircle, BookOpen, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function FocusPage() {
	const { user } = useAuth();
	
	return (
		<div className="flex overflow-hidden" style={{ height: "100dvh" }}>
			{/* Desktop left nav */}
			<SharedLeftNav>
				<ConversationsList />
			</SharedLeftNav>

			<main className="flex-1 flex flex-col h-full overflow-hidden">
				<MyFocusDashboard />
			</main>
		</div>
	);
}
