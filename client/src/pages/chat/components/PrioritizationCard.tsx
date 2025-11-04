import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface PrioritizationItem {
	id?: string;
	title: string;
	description?: string;
	lifeMetric?: string;
	habitIdToLog?: string;
}

interface Props {
	items: PrioritizationItem[];
	messageId?: string; // Unique ID for this card instance
	onAccept?: () => void;
	onReject?: () => void;
	onLog?: (habitId: string) => Promise<void> | void;
}

export default function PrioritizationCard({ items, messageId, onAccept, onReject, onLog }: Props) {
	// Use message ID if provided, otherwise fall back to goal IDs
	// This ensures each card instance in the conversation has independent state
	const cardId = `priority_${messageId || items.map(i => i.id || i.title).join('_')}`;
	const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(() => {
		const init: Record<string, boolean> = {};
		items.forEach((item, idx) => {
			init[item.id || String(idx)] = true; // All checked by default
		});
		return init;
	});
	const [accepted, setAccepted] = useState(() => {
		const saved = localStorage.getItem(cardId);
		return saved === 'accepted';
	});
	const [rejected, setRejected] = useState(() => {
		const saved = localStorage.getItem(cardId);
		return saved === 'rejected';
	});
	const [reprioritizing, setReprioritizing] = useState(false);

	const toggleItem = (itemId: string) => {
		setSelectedItems(prev => ({
			...prev,
			[itemId]: !prev[itemId]
		}));
	};

	const handleAccept = async () => {
		const selectedCount = Object.values(selectedItems).filter(Boolean).length;
		if (selectedCount === 0) {
			alert('Please select at least one priority to accept');
			return;
		}
		// Build payload with only selected items, preserving order
		const acceptedItems = items
			.map((it, idx) => ({ it, idx }))
			.filter(({ it, idx }) => selectedItems[it.id || String(idx)])
			.map(({ it }, i) => ({ goalInstanceId: it.id, rank: i + 1 }));
		try {
			await fetch('/api/my-focus/priorities/apply', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items: acceptedItems, sourceThreadId: messageId || null }),
			});
		} catch (e) {
			// Non-blocking: still mark accepted for UX, but log
			console.error('Failed to apply selected priorities', e);
		}
		setAccepted(true);
		localStorage.setItem(cardId, 'accepted');
		onAccept?.();
	};

	const handleReject = () => {
		setRejected(true);
		localStorage.setItem(cardId, 'rejected');
		onReject?.();
	};

	if (accepted) {
		        return (
                <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-3 sm:p-4 md:p-5 shadow-sm min-w-0 overflow-hidden">
				<div className="flex items-center gap-2 text-green-700 font-semibold mb-3">
					<Check className="w-5 h-5" />
					<span>Priorities Accepted</span>
				</div>
				<div className="text-sm text-green-600 mb-3">
					Your focus has been updated to these 3 priorities.
				</div>
				<Button
					className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-xl"
					onClick={() => window.location.href = '/focus'}
				>
					View in My Focus →
				</Button>
			</div>
		);
	}

	if (rejected) {
		        return (
                <div className="bg-gray-100 border-2 border-gray-300 rounded-2xl p-3 sm:p-4 md:p-5 shadow-sm min-w-0 overflow-hidden">
				<div className="text-gray-700 font-semibold mb-3">Priority Proposal Declined</div>
				<div className="text-sm text-gray-600">
					No changes made. You can ask me to re-prioritize if needed.
				</div>
			</div>
		);
	}

	        return (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3 sm:p-4 md:p-5 shadow-sm min-w-0 overflow-hidden">
			<div className="flex items-center justify-between mb-3">
				<div className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Priority Focus</div>
				<div className="text-xs text-gray-600">Select which priorities to accept</div>
			</div>
			<div className="space-y-3">
				                                {items.map((it, idx) => (
                                        <div key={it.id || idx} className="bg-white border border-gray-200 rounded-xl p-2 sm:p-3 min-w-0">
						<div className="flex items-start gap-3">
							<input
								type="checkbox"
								checked={selectedItems[it.id || String(idx)] || false}
								onChange={() => toggleItem(it.id || String(idx))}
								className="mt-1 w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
							/>
							                                                        <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-2 sm:gap-3 min-w-0">
                                                                        <div className="flex-1 min-w-0">
                                                                               <div className="font-semibold text-gray-900 break-words">{it.title}</div>
                                                                               {it.description && <div className="text-sm text-gray-600 mt-0.5 break-words">{it.description}</div>}
										{it.lifeMetric && (
											<div className="mt-1 text-[11px] inline-flex px-2 py-0.5 rounded-full border bg-white text-gray-700">
												{it.lifeMetric}
											</div>
										)}
									</div>
									<div className="shrink-0 text-sm text-gray-500">#{idx + 1}</div>
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
			                                                        <div className="flex gap-2 sm:gap-3 mt-4 flex-col sm:flex-row">
                                <Button 
                                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl text-xs sm:text-sm min-w-0"                               
                                        onClick={handleAccept}
                                >
                                        <span className="truncate">
                                                Accept ({Object.values(selectedItems).filter(Boolean).length}/{items.length})
                                        </span>
                                </Button>
                                <Button 
                                        variant="outline"
                                        className="px-3 sm:px-4 py-3 rounded-xl border-gray-300 text-xs sm:text-sm shrink-0"                                                                
                                        onClick={handleReject}
                                >
                                        Decline
                                </Button>
                                <Button 
                                        variant="outline"
                                        className="px-3 sm:px-4 py-3 rounded-xl border-amber-300 text-amber-700 text-xs sm:text-sm shrink-0"                                                
                                        onClick={() => {
                                                setReprioritizing(true);
                                                // Send message to agent to re-prioritize                                                                       
                                                if ((window as any).sendMessage) {                                                                              
                                                        (window as any).sendMessage('I want to see different priorities. Can you re-prioritize my goals?');     
                                                }
                                        }}
                                        disabled={reprioritizing}
                                >
                                        <span className="whitespace-nowrap">
                                                {reprioritizing ? 'Re-prioritizing...' : 'Re-prioritize'}
                                        </span>
                                </Button>
                        </div>
		</div>
	);
}


