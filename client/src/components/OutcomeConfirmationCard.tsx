import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { safeStorage } from "@/utils/safeStorage";
import { trackShellEvent } from "@/lib/analytics";

type OutcomeResult = "success" | "pending" | "failed";

export type OutcomeActionType =
	| "community_notice"
	| "provider_coordination"
	| "promotion";

export interface OutcomeConfirmationCardProps {
	actionType: OutcomeActionType;
	artifactId?: string | null;
	stateCode?: string;
	countyFips?: string;
	initiatedBy?: "scout" | "direct";
	initiatedAtMs?: number;
}

function makeStorageKey(actionType: OutcomeActionType, artifactId?: string | null) {
	const id = artifactId && artifactId.trim().length > 0 ? artifactId.trim() : "__anon__";
	return `ts:outcome:${actionType}:${id}`;
}

export const OutcomeConfirmationCard: React.FC<OutcomeConfirmationCardProps> = ({
	actionType,
	artifactId,
	stateCode,
	countyFips,
	initiatedBy = "direct",
	initiatedAtMs,
}) => {
	const storageKey = React.useMemo(
		() => makeStorageKey(actionType, artifactId),
		[actionType, artifactId]
	);

	const [choice, setChoice] = React.useState<OutcomeResult | null>(() => {
		const existing = safeStorage.get(storageKey);
		if (!existing) return null;
		if (existing === "success" || existing === "pending" || existing === "failed") {
			return existing;
		}
		return null;
	});

	const [hasAcknowledged, setHasAcknowledged] = React.useState<boolean>(() => {
		return choice !== null;
	});

	if (hasAcknowledged && !choice) {
		// Nothing to render once acknowledgement has been persisted and
		// we no longer need to show the follow-up message.
		return null;
	}

	const handleSelect = async (result: OutcomeResult) => {
		setChoice(result);
		safeStorage.set(storageKey, result);

		const now = Date.now();
		const timeToOutcomeMs =
			typeof initiatedAtMs === "number" && initiatedAtMs > 0 && now >= initiatedAtMs
				? now - initiatedAtMs
				: undefined;

		try {
			await trackShellEvent({
				type: "local_action_outcome",
				actionType,
				result,
				stateCode,
				countyFips,
				initiatedBy,
				timeToOutcomeMs,
				artifactId: artifactId ?? undefined,
			});
		} catch {
			// Analytics must never block or throw in UI.
		}

		// After a short delay, we can hide the follow-up message on next mount.
		setTimeout(() => {
			setHasAcknowledged(true);
		}, 0);
	};

	if (hasAcknowledged && choice) {
		// Show a one-line acknowledgement message immediately after selection.
		let message: string;
		if (choice === "success") {
			message = "Thanks — this helps TradeScout improve local coordination.";
		} else if (choice === "pending") {
			message = "Got it. We’ll check back later.";
		} else {
			message = "Thanks for the feedback.";
		}

		return (
			<Card className="mt-4 border-tsBorder bg-tsCard">
				<CardContent className="py-3 px-4 text-sm text-slate-300">
					{message}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="mt-4 border-tsBorder bg-tsCard">
			<CardContent className="py-3 px-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-sm font-medium text-white">
							Did this help coordinate what you needed?
						</p>
						<p className="text-xs text-slate-400 mt-1">
							Outcome here means coordination — not a review.
						</p>
					</div>
					<div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleSelect("success")}
							className="border-green-500/60 text-green-300 hover:bg-green-500/10"
						>
							Yes, it worked
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleSelect("pending")}
							className="border-yellow-500/60 text-yellow-300 hover:bg-yellow-500/10"
						>
							Not yet
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleSelect("failed")}
							className="border-red-500/60 text-red-300 hover:bg-red-500/10"
						>
							No
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};
