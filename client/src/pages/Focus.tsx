import MyFocusDashboard from "@/components/focus/MyFocusDashboard";
import SharedLeftNav from "@/components/layout/SharedLeftNav";
import ConversationsList from "@/components/chat/ConversationsList";

export default function FocusPage() {
	return (
		<div className="min-h-screen flex">
			<SharedLeftNav>
				<ConversationsList />
			</SharedLeftNav>
			<main className="flex-1">
				<MyFocusDashboard />
			</main>
		</div>
	);
}
