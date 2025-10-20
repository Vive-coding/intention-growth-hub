import { Button } from "@/components/ui/button";

interface Props {
	summary?: string;
	onOpenOptimize?: () => void;
}

export default function OptimizationCard({ summary, onOpenOptimize }: Props) {
	return (
		<div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-5 shadow-sm">
			<div className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Optimization Opportunity</div>
			{summary && (
				<p className="text-sm text-gray-700 leading-relaxed mb-3">{summary}</p>
			)}
			<div>
				<Button className="rounded-xl bg-teal-600 hover:bg-teal-700" onClick={onOpenOptimize}>Open Optimization</Button>
			</div>
		</div>
	);
}


