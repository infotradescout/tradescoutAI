import type { JobDocument, JobDocumentType } from "@/hooks/useJobDocuments";

export type DealRoomStage =
	| "EMPTY"
	| "MATERIALS"
	| "ESTIMATE"
	| "CONTRACT"
	| "INVOICE"
	| "RECEIPT";

export type DealRoomRole = "homeowner" | "contractor" | "guest";

export interface DealRoomState {
	stage: DealRoomStage;
	waitingOn: string;
	latestByType: Partial<Record<JobDocumentType, JobDocument>>;
	canApproveEstimate: boolean;
	canSignContract: boolean;
	canCreateInvoice: boolean;
	canIssueReceipt: boolean;
	canMarkPaymentReceived: boolean;
}

function getLatestByType(documents: JobDocument[]): Partial<Record<JobDocumentType, JobDocument>> {
	const latest: Partial<Record<JobDocumentType, JobDocument>> = {};
	for (const doc of documents) {
		const existing = latest[doc.type];
		if (!existing) {
			latest[doc.type] = doc;
			continue;
		}
		if (new Date(doc.created_at).getTime() >= new Date(existing.created_at).getTime()) {
			latest[doc.type] = doc;
		}
	}
	return latest;
}

export function deriveDealRoomState(
	documents: JobDocument[],
	userRole: DealRoomRole,
): DealRoomState {
	if (!documents.length) {
		return {
			stage: "EMPTY",
			waitingOn:
				"Track any documents related to this project. Start by creating a material list, estimate, contract, or invoice—whatever makes sense first.",
			latestByType: {},
			canApproveEstimate: false,
			canSignContract: false,
			canCreateInvoice: false,
			canIssueReceipt: false,
			canMarkPaymentReceived: false,
		};
	}

	const latestByType = getLatestByType(documents);
	const material = latestByType.MATERIAL_LIST;
	const estimate = latestByType.ESTIMATE;
	const contract = latestByType.CONTRACT;
	const invoice = latestByType.INVOICE;
	const receipt = latestByType.RECEIPT;

	let stage: DealRoomStage = "EMPTY";
	let waitingOn = "";

	// We still derive a "stage" to summarize where things stand,
	// but documents can be created in any order.
	if (receipt) {
		stage = "RECEIPT";
		waitingOn = "This project has a receipt issued.";
	} else if (invoice) {
		stage = "INVOICE";
		if (invoice.status === "paid") {
			waitingOn = "Issue a receipt to close out this project.";
		} else if (invoice.status === "sent") {
			waitingOn = "Waiting for payment on the invoice.";
		} else {
			waitingOn = "Review and send the invoice to the homeowner.";
		}
	} else if (contract) {
		stage = "CONTRACT";
		if (contract.status === "signed") {
			waitingOn = "Create an invoice based on this signed contract.";
		} else if (contract.status === "partially_signed") {
			waitingOn = "Waiting for the other party to sign the contract.";
		} else if (contract.status === "sent") {
			waitingOn = "Waiting for signatures on the contract.";
		} else {
			waitingOn = "Review and send the contract for signature.";
		}
	} else if (estimate) {
		stage = "ESTIMATE";
		if (estimate.status === "approved") {
			waitingOn = "Prepare a contract from the approved estimate.";
		} else if (estimate.status === "sent") {
			waitingOn = "Waiting for the homeowner to approve the estimate.";
		} else {
			waitingOn = "Draft and send the estimate to the homeowner.";
		}
	} else if (material) {
		stage = "MATERIALS";
		if (material.status === "pending_homeowner") {
			waitingOn = "Waiting for the homeowner to finalize material choices.";
		} else {
			waitingOn = "Review and share the material list with the homeowner.";
		}
	} else {
		stage = "EMPTY";
		waitingOn =
			"Track any documents related to this project. Start by creating a material list, estimate, contract, or invoice—whatever makes sense first.";
	}

	const canApproveEstimate =
		!!estimate &&
		estimate.status === "sent" &&
		userRole === "homeowner";

	const canSignContract =
		!!contract &&
		(contract.status === "sent" || contract.status === "partially_signed") &&
		(userRole === "homeowner" || userRole === "contractor");

	// Allow contractors to create an invoice even if they didn't use every
	// step (material list, estimate, contract). A signed contract still
	// unlocks the path in guided flows, but small or off-platform jobs can
	// jump straight to an invoice.
	const canCreateInvoice = !invoice && userRole === "contractor";

	const canIssueReceipt =
		!!invoice &&
		invoice.status === "paid" &&
		!receipt &&
		userRole === "contractor";

	const canMarkPaymentReceived =
		!!invoice &&
		(invoice.status === "sent" || invoice.status === "approved") &&
		userRole === "contractor";

	return {
		stage,
		waitingOn,
		latestByType,
		canApproveEstimate,
		canSignContract,
		canCreateInvoice,
		canIssueReceipt,
		canMarkPaymentReceived,
	};
}
