import { Button } from "@/components/ui/button";

interface PrioritizationItem {
	id?: string;
	title: string;
	description?: string;
	lifeMetric?: string;
	habitIdToLog?: string;
}

interface Props {
	items: PrioritizationItem[];
	onOpenReview?: () => void;
	onLog?: (habitId: string) => Promise<void> | void;
}

export default function PrioritizationCard({ items, onOpenReview, onLog }: Props) {
	return (
		<div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
			<div className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Priority Focus</div>
			<div className="space-y-3">
				{items.map((it, idx) => (
					<div key={it.id || idx} className="bg-white border border-gray-200 rounded-xl p-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<div className="font-semibold text-gray-900 truncate">{it.title}</div>
								{it.description && <div className="text-sm text-gray-600 mt-0.5">{it.description}</div>}
								{it.lifeMetric && (
									<div className="mt-1 text-[11px] inline-flex px-2 py-0.5 rounded-full border bg-white text-gray-700">
										{it.lifeMetric}
									</div>
								)}
							</div>
							{it.habitIdToLog && (
								<Button
									size="sm"
									className="shrink-0 bg-teal-600 hover:bg-teal-700"
									onClick={() => onLog?.(it.habitIdToLog!)}
								>
									Log
								</Button>
							)}
						</div>
					</div>
				))}
			</div>
			{onOpenReview && (
				<div className="mt-4">
					<Button variant="outline" className="rounded-xl" onClick={onOpenReview}>Open Habit Review</Button>
				</div>
			)}
		</div>
	);
}


