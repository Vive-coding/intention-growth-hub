import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PrioritizationItem {
	id?: string;
	title: string;
	description?: string;
	lifeMetric?: string;
	targetDate?: string;
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
	const queryClient = useQueryClient();
	
	// Helper to get the goal instance ID from an item (handles both id and goalInstanceId fields)
	const getGoalInstanceId = (item: PrioritizationItem, idx: number): string => {
		// Check if item has goalInstanceId (from tool output) or id (legacy)
		return (item as any).goalInstanceId || item.id || String(idx);
	};

	// Use message ID if provided, otherwise fall back to goal IDs
	// This ensures each card instance in the conversation has independent state
	const cardId = `priority_${messageId || items.map(i => getGoalInstanceId(i, 0)).join('_')}`;
	const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(() => {
		const init: Record<string, boolean> = {};
		items.forEach((item, idx) => {
			init[getGoalInstanceId(item, idx)] = true; // All checked by default
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
			.map((it, idx) => ({ it, idx, goalId: getGoalInstanceId(it, idx) }))
			.filter(({ goalId }) => selectedItems[goalId])
			.map(({ goalId }, i) => ({ goalInstanceId: goalId, rank: i + 1 }));
		
		console.log('[PrioritizationCard] Applying selected priorities:', acceptedItems);
		
		try {
			await apiRequest('/api/my-focus/priorities/apply', {
				method: 'POST',
				body: JSON.stringify({ items: acceptedItems, sourceThreadId: messageId || null }),
			});
			
			console.log('[PrioritizationCard] Successfully applied priorities');
			
			// Invalidate queries to refresh My Focus and goals
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ['/api/my-focus'] }),
				queryClient.invalidateQueries({ queryKey: ['/api/goals'] }),
			]);
		} catch (e) {
			// Non-blocking: still mark accepted for UX, but log
			console.error('Failed to apply selected priorities', e);
			alert('Failed to apply priorities. Please try again.');
			return; // Don't mark as accepted if the API call failed
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

	const sendReprioritizeRequest = () => {
		if ((window as any).composeAndSend) {
			(window as any).composeAndSend("Let's re-prioritize my focus goals.", 'prioritize_optimize');
		} else if ((window as any).sendMessage) {
			(window as any).sendMessage("Let's re-prioritize my focus goals.");
		}
		setTimeout(() => setReprioritizing(false), 2000);
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
			{/* Focus slots are fixed at 3 for now; we keep the card focused on choosing priorities */}
			<div className="space-y-3">
				                                {items.map((it, idx) => {
					const goalId = getGoalInstanceId(it, idx);
					return (
                                        <div key={goalId} className="bg-white border border-gray-200 rounded-xl p-2 sm:p-3 min-w-0">
						<div className="flex items-start gap-3">
							<input
								type="checkbox"
								checked={selectedItems[goalId] || false}
								onChange={() => toggleItem(goalId)}
								className="mt-1 w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
							/>
							                                                        <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-2 sm:gap-3 min-w-0">
                                                                        <div className="flex-1 min-w-0">
                                                                               <div className="font-semibold text-gray-900 break-words">{it.title}</div>
                                                                               {it.description && <div className="text-sm text-gray-600 mt-0.5 break-words">{it.description}</div>}
													<div className="flex items-center gap-2 mt-2 flex-wrap">
														{it.lifeMetric && (
															<div className="text-[11px] inline-flex items-center justify-center text-center px-2 py-0.5 rounded-full border bg-white text-gray-700 whitespace-nowrap">
																{it.lifeMetric}
															</div>
														)}
														{it.targetDate && (
															<div className="text-[11px] inline-flex items-center justify-center text-center gap-1 px-2 py-0.5 rounded-full border bg-white text-gray-600 whitespace-nowrap">
																<svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
																</svg>
																<span>Target: {new Date(it.targetDate).toLocaleDateString()}</span>
															</div>
														)}
													</div>
									</div>
									<div className="shrink-0 text-sm text-gray-500">#{idx + 1}</div>
								</div>
							</div>
						</div>
					</div>
					);
				})}
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
                                                sendReprioritizeRequest();
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


