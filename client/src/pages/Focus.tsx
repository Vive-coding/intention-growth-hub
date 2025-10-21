import MyFocusDashboard from "@/components/focus/MyFocusDashboard";
import SharedLeftNav from "@/components/layout/SharedLeftNav";

export default function FocusPage() {
	return (
		<div className="min-h-screen flex">
			<SharedLeftNav />
			<main className="flex-1">
				<MyFocusDashboard />
			</main>
		</div>
	);
}
