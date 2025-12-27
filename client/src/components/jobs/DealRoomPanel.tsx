import { useMemo, useState } from "react";
import { useJobDocuments } from "@/hooks/useJobDocuments";
import { deriveDealRoomState, type DealRoomRole } from "@/lib/dealRoomState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface DealRoomPanelProps {
	jobId: string | null;
	userRole: DealRoomRole;
}

export function DealRoomPanel({ jobId, userRole }: DealRoomPanelProps) {
	const { toast } = useToast();
	const { documents, isLoading, error, refetch } = useJobDocuments(jobId);
	const [invoiceTotalInput, setInvoiceTotalInput] = useState("");

	const state = deriveDealRoomState(documents, userRole);

	const latestMaterial = state.latestByType.MATERIAL_LIST;
	const latestEstimate = state.latestByType.ESTIMATE;
	const latestContract = state.latestByType.CONTRACT;
	const latestInvoice = state.latestByType.INVOICE;
	const latestReceipt = state.latestByType.RECEIPT;
	const canStartMaterialList = !documents.some((d) => d.type === "MATERIAL_LIST");
	const isStandalone = !jobId;

	const latestInvoicePayload = (latestInvoice?.payload as any) || {};
	const invoiceLines: Array<{
		description?: string;
		quantity?: number;
		unitPrice?: number;
		amount?: number;
	}> = Array.isArray(latestInvoicePayload?.lines) ? latestInvoicePayload.lines : [];
	const invoiceSubtotal: number | null =
		typeof latestInvoicePayload?.subtotal === "number" ? latestInvoicePayload.subtotal : null;
	const invoiceTax: number | null =
		typeof latestInvoicePayload?.tax === "number" ? latestInvoicePayload.tax : null;
	const invoiceTotal: number | null =
		typeof latestInvoicePayload?.total === "number" ? latestInvoicePayload.total : null;
	const invoiceCurrency: string =
		typeof latestInvoicePayload?.currency === "string" && latestInvoicePayload.currency.trim()
			? latestInvoicePayload.currency.trim().toUpperCase()
			: "USD";
	const invoicePayment = latestInvoicePayload?.payment as
		| { method?: string; reference?: string; receivedAt?: string }
		| undefined;
	const invoiceStatusRaw = latestInvoice?.status ?? "";
	const invoiceStatusLabel =
		invoiceStatusRaw === "draft"
			? "Draft"
			: invoiceStatusRaw === "sent"
				? "Issued"
				: invoiceStatusRaw === "approved"
					? "Approved"
					: invoiceStatusRaw === "paid"
						? "Paid / recorded"
						: invoiceStatusRaw || "";
	const invoiceStatusClass =
		invoiceStatusRaw === "paid"
			? "bg-emerald-900/60 border-emerald-500/60 text-emerald-100"
			: invoiceStatusRaw === "sent" || invoiceStatusRaw === "approved"
				? "bg-amber-900/60 border-amber-500/60 text-amber-100"
				: "bg-slate-800 border-slate-600 text-slate-100";
	const invoiceNumberDisplay =
		typeof latestInvoicePayload?.invoiceNumber === "string" &&
		latestInvoicePayload.invoiceNumber.trim()
			? latestInvoicePayload.invoiceNumber.trim()
			: latestInvoice
				? `INV-${latestInvoice.id.slice(0, 8).toUpperCase()}`
				: "";
	const invoiceIssuedBy =
		userRole === "contractor"
			? "Issued by you"
			: userRole === "homeowner"
				? "Issued by your contractor"
				: "Issued for this project";

	const headerPrimary = isStandalone ? "Standalone Accounting" : "Project Deal Room";
	const headerSecondary = isStandalone
		? "Track any documents for this off-platform work. Create, attach, or convert documents in any order."
		: "Track any documents related to this project. Create, attach, or convert documents in any order.";

	const mapDocErrorMessage = (code?: string | null, fallback?: string) => {
		switch (code) {
			case "ESTIMATE_NOT_SENT":
				return "Estimate must be sent before it can be approved.";
			case "ESTIMATE_LOCKED":
				return "This estimate is locked and can no longer be changed or re-sent.";
			case "CREATOR_CANNOT_APPROVE":
				return "Only the homeowner can approve this estimate.";
			case "CONTRACT_NOT_READY_FOR_SIGN":
				return "The contract isn’t ready for signatures yet.";
			case "CONTRACT_LOCKED":
				return "This contract is locked and can no longer be changed or re-sent.";
			case "ROLE_ALREADY_SIGNED":
				return "You’ve already signed this contract.";
			case "CONTRACT_REQUIRED":
				return "You need a signed contract before you can generate an invoice.";
			case "CONTRACT_NOT_SIGNED":
				return "The contract must be fully signed before you can generate an invoice.";
			case "INVOICE_LOCKED":
				return "This invoice is locked and can no longer be changed.";
			case "INVOICE_REQUIRED":
				return "You need an invoice before you can issue a receipt.";
			case "INVOICE_NOT_PAID":
				return "Invoice must be marked paid before a receipt can be created.";
			case "INVOICE_NOT_READY_FOR_PAYMENT":
				return "Invoice must be sent before you can record payment.";
			case "ONLY_CREATOR_CAN_SEND":
				return "Only the contractor who created this document can send it.";
			case "SEND_NOT_SUPPORTED":
				return "This document type cannot be sent.";
			default:
				return fallback || "This action is currently blocked for this document.";
		}
	};

	const extractErrorCode = async (res: Response) => {
		try {
			const data = (await res.json()) as any;
			return typeof data?.message === "string" ? data.message : null;
		} catch {
			return null;
		}
	};

	const handleApproveEstimate = async () => {
		if (!latestEstimate) return;
		try {
			const res = await fetch(`/api/documents/${latestEstimate.id}/approve`, {
				method: "POST",
				credentials: "include",
			});
			if (!res.ok) {
				const code = await extractErrorCode(res);
				throw new Error(mapDocErrorMessage(code, `Approve failed (${res.status})`));
			}
			toast({ title: "Estimate approved", description: "A contract draft has been created." });
			refetch();
		} catch (e: any) {
			toast({ title: "Could not approve estimate", description: e?.message || "Please try again.", variant: "destructive" });
		}
	};

	const handleSignContract = async () => {
		if (!latestContract) return;
		const name = window.prompt("Type your full name to sign this contract:");
		if (!name) return;
		try {
			const res = await fetch(`/api/documents/${latestContract.id}/sign`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ role: userRole, signatureType: "typed", name }),
			});
			if (!res.ok) {
				const code = await extractErrorCode(res);
				throw new Error(mapDocErrorMessage(code, `Sign failed (${res.status})`));
			}
			toast({ title: "Contract signed", description: "Your signature has been recorded." });
			refetch();
		} catch (e: any) {
			toast({ title: "Could not sign contract", description: e?.message || "Please try again.", variant: "destructive" });
		}
	};

	const handleCreateInvoice = async () => {
		if (!jobId || !state.canCreateInvoice) return;
		const total = Number(invoiceTotalInput || 0);
		if (!Number.isFinite(total) || total <= 0) {
			toast({ title: "Enter a valid total", description: "Invoice total must be greater than zero.", variant: "destructive" });
			return;
		}
		// For projects without a signed contract (or very small/off-platform jobs),
		// allow contractors to jump straight to an invoice by explicitly setting
		// allowSkipContract. If there is a signed contract, keep the original
		// guardrails and rely on the server-side contract checks.
		const allowSkipContract = !latestContract || latestContract.status !== "signed";
		try {
			const res = await fetch(`/api/jobs/${jobId}/invoice`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					allowSkipContract,
					payload: {
						subtotal: total,
						tax: 0,
						total,
						currency: "USD",
						lines: [],
					},
				}),
			});
			if (!res.ok) {
				const code = await extractErrorCode(res);
				throw new Error(mapDocErrorMessage(code, `Invoice creation failed (${res.status})`));
			}
			toast({ title: "Invoice created", description: "You can now send this invoice to the homeowner." });
			setInvoiceTotalInput("");
			refetch();
		} catch (e: any) {
			toast({ title: "Could not create invoice", description: e?.message || "Please try again.", variant: "destructive" });
		}
	};

	const handleIssueReceipt = async () => {
		if (!latestInvoice) return;
		try {
			const res = await fetch(`/api/documents/${latestInvoice.id}/mark-paid`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method: "other",
					reference: "Recorded manually from deal room",
				}),
			});
			if (!res.ok) {
				const code = await extractErrorCode(res);
				throw new Error(mapDocErrorMessage(code, `Payment recording failed (${res.status})`));
			}
			toast({ title: "Payment recorded", description: "Invoice marked paid and receipt issued." });
			refetch();
		} catch (e: any) {
			toast({ title: "Could not record payment", description: e?.message || "Please try again.", variant: "destructive" });
		}
	};

	const handleShare = async (documentId: string) => {
		try {
			const res = await fetch(`/api/documents/${documentId}/share`, {
				method: "POST",
				credentials: "include",
			});
			if (!res.ok) {
				throw new Error(`Share failed (${res.status})`);
			}
			const data = (await res.json()) as { shareUrl: string };
			await navigator.clipboard.writeText(data.shareUrl);
			toast({ title: "Share link copied", description: "Send this link to anyone who needs to review." });
		} catch (e: any) {
			toast({ title: "Could not create share link", description: e?.message || "Please try again.", variant: "destructive" });
		}
	};

	const handleDownloadPdf = async (documentId: string) => {
		try {
			const res = await fetch(`/api/documents/${documentId}/pdf`, {
				credentials: "include",
			});
			if (!res.ok) {
				throw new Error(`Download failed (${res.status})`);
			}
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "project-document.pdf";
			a.click();
			URL.revokeObjectURL(url);
		} catch (e: any) {
			toast({ title: "Could not download PDF", description: e?.message || "Please try again.", variant: "destructive" });
		}
	};

	const handleCreateMaterialList = async () => {
		if (!jobId || !canStartMaterialList) return;
		try {
			const res = await fetch(`/api/jobs/${jobId}/material-list`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify({
					payload: {
						items: [],
						notes: "Starter material list draft created from the deal room.",
					},
				}),
			});
			if (!res.ok) {
				const code = await extractErrorCode(res);
				throw new Error(mapDocErrorMessage(code, `Material list creation failed (${res.status})`));
			}
			toast({ title: "Material list created", description: "You can now edit and send this list.", variant: "default" });
			refetch();
		} catch (e: any) {
			toast({ title: "Could not create material list", description: e?.message || "Please try again.", variant: "destructive" });
		}
	};

	const handleSendDocument = async (id: string, label: string) => {
		try {
			const res = await fetch(`/api/documents/${id}/send`, {
				method: "POST",
				credentials: "include",
			});
			if (!res.ok) {
				const code = await extractErrorCode(res);
				throw new Error(mapDocErrorMessage(code, `${label} could not be sent (${res.status})`));
			}
			toast({ title: `${label} sent`, description: "Homeowner can now review this document." });
			refetch();
		} catch (e: any) {
			toast({ title: `Could not send ${label.toLowerCase()}`, description: e?.message || "Please try again.", variant: "destructive" });
		}
	};

	type PrimaryActionKind = "none" | "simple" | "invoiceFromContract";

	const primaryAction = useMemo(
		() => {
			const base = {
				kind: "none" as PrimaryActionKind,
				label: "",
				explanation: state.waitingOn || "You're up to date for now.",
				action: undefined as (() => void) | undefined,
			};

			// If there's already a receipt, lifecycle is complete.
			if (latestReceipt) {
				return {
					...base,
					kind: "none" as PrimaryActionKind,
					explanation:
						"This project has a receipt issued. You can still share or download documents below.",
				};
			}

			// Invoice stage: focus on recording payment or sending invoice.
			if (latestInvoice) {
				if (latestInvoice.status === "paid") {
					return {
						...base,
						kind: "none" as PrimaryActionKind,
						explanation:
							"This invoice is recorded as paid and a receipt has been issued. You can download or share it below for your records.",
					};
				}

				if (state.canMarkPaymentReceived && userRole === "contractor") {
					return {
						...base,
						kind: "simple" as PrimaryActionKind,
						label: "Mark as paid",
						explanation:
							"Record that this invoice has been paid. Scout will mark it paid and issue a receipt for your records.",
						action: handleIssueReceipt,
					};
				}

				if (latestInvoice.status === "draft" && userRole === "contractor") {
					return {
						...base,
						kind: "simple" as PrimaryActionKind,
						label: "Issue invoice",
						explanation:
							"Issue this invoice so your client can review it and pay using whatever method you agree on. Scout will treat it as outstanding until you record payment.",
						action: () => handleSendDocument(latestInvoice.id, "Invoice"),
					};
				}

				return {
					...base,
					kind: "none" as PrimaryActionKind,
					explanation:
						"Invoice is issued and waiting on payment. Once you've collected payment, record it here so your ledger stays accurate.",
				};
			}

			// Contract stage: signing or sending contract, or generating invoice from a signed contract.
			if (latestContract) {
				if (state.canSignContract) {
					return {
						...base,
						kind: "simple" as PrimaryActionKind,
						label: "Sign contract",
						explanation:
							"Sign this contract to finalize the agreement. Once both sides have signed, you can generate an invoice.",
						action: handleSignContract,
					};
				}

				if (latestContract.status === "draft" && userRole === "contractor") {
					return {
						...base,
						kind: "simple" as PrimaryActionKind,
						label: "Send contract",
						explanation:
							"Send this contract so your client can review and sign it.",
						action: () => handleSendDocument(latestContract.id, "Contract"),
					};
				}

				if (latestContract.status === "signed" && state.canCreateInvoice && userRole === "contractor") {
					return {
						...base,
						kind: "invoiceFromContract" as PrimaryActionKind,
						label: "Generate invoice",
						explanation:
							"Create an invoice from this signed contract. Set a total and generate the invoice.",
						action: handleCreateInvoice,
					};
				}

				return {
					...base,
					kind: "none" as PrimaryActionKind,
					explanation:
						"Waiting on contract signatures. Once both sides sign, you can generate an invoice.",
				};
			}

			// Estimate stage: send or approve estimate.
			if (latestEstimate) {
				if (state.canApproveEstimate) {
					return {
						...base,
						kind: "simple" as PrimaryActionKind,
						label: "Approve estimate",
						explanation:
							"Approve this estimate to move forward to a formal contract.",
						action: handleApproveEstimate,
					};
				}

				if (latestEstimate.status === "draft" && userRole === "contractor") {
					return {
						...base,
						kind: "simple" as PrimaryActionKind,
						label: "Send estimate",
						explanation:
							"Send this estimate so your client can review and approve it.",
						action: () => handleSendDocument(latestEstimate.id, "Estimate"),
					};
				}

				if (latestEstimate.status === "sent") {
					return {
						...base,
						kind: "none" as PrimaryActionKind,
						explanation:
							"Waiting on the homeowner to approve this estimate.",
					};
				}

				return {
					...base,
					kind: "none" as PrimaryActionKind,
					explanation:
						"Estimate is approved. The next step is to finalize and send a contract.",
				};
			}

			// Material list stage: start or send a material list.
			if (latestMaterial) {
				if (latestMaterial.status === "draft" && userRole === "contractor") {
					return {
						...base,
						kind: "simple" as PrimaryActionKind,
						label: "Send material list",
						explanation:
							"Send this material list so your client can choose materials and options.",
						action: () => handleSendDocument(latestMaterial.id, "Material list"),
					};
				}

				if (latestMaterial.status === "sent") {
					return {
						...base,
						kind: "none" as PrimaryActionKind,
						explanation:
							"Waiting on the homeowner to review and choose materials.",
					};
				}
			}

			// No documents yet: let contractors start with a material list on job-linked work.
			if (!documents.length && userRole === "contractor" && jobId) {
				return {
					...base,
					kind: "simple" as PrimaryActionKind,
					label: "Start material list",
					explanation:
						"Kick off this project by drafting a material list. You can refine it and send it to your client.",
					action: handleCreateMaterialList,
				};
			}

			return base;
		},
		[
			jobId,
			latestContract,
			latestEstimate,
			latestInvoice,
			latestMaterial,
			latestReceipt,
			state.canApproveEstimate,
			state.canCreateInvoice,
			state.canMarkPaymentReceived,
			state.canSignContract,
			state.waitingOn,
			userRole,
			documents.length,
			handleApproveEstimate,
			handleCreateInvoice,
			handleCreateMaterialList,
			handleIssueReceipt,
			handleSendDocument,
			handleSignContract,
		]
	);

	const stageLabel =
		state.stage === "EMPTY"
			? "Getting started"
			: state.stage === "MATERIALS"
				? "Materials"
				: state.stage === "ESTIMATE"
					? "Estimate"
					: state.stage === "CONTRACT"
						? "Contract"
						: state.stage === "INVOICE"
							? "Invoice"
							: "Receipt";

	return (
		<Card className="bg-slate-900/60 border-slate-700 h-full flex flex-col">
			<CardHeader className="pb-3 space-y-1">
				<p className="text-[11px] uppercase tracking-wide text-slate-400">{headerPrimary}</p>
				<CardTitle className="text-sm text-gray-100">Deal Room</CardTitle>
				<p className="text-[11px] text-gray-400">{headerSecondary}</p>
			</CardHeader>
			<CardContent className="space-y-4 flex-1 flex flex-col">
				{isLoading ? (
					<div className="text-xs text-gray-400">Loading documents…</div>
				) : error ? (
					<div className="text-xs text-red-400">Could not load documents.</div>
				) : (
					<>
						<div className="rounded-md border border-slate-700 bg-slate-900/60 p-3 mb-2">
							<p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Current stage</p>
							<p className="text-sm font-semibold text-white mb-1">{stageLabel}</p>
							<p className="text-xs text-gray-300 mb-2">{primaryAction.explanation}</p>
							{primaryAction.kind === "simple" && primaryAction.action && primaryAction.label && (
								<Button size="sm" className="w-full" onClick={primaryAction.action}>
									{primaryAction.label}
								</Button>
							)}
							{primaryAction.kind === "invoiceFromContract" && state.canCreateInvoice && userRole === "contractor" && (
								<div className="space-y-2">
									<p className="text-[11px] text-gray-400">
										Set an invoice total, then generate the invoice.
									</p>
									<div className="flex items-center gap-2">
										<Input
											placeholder="Total"
											value={invoiceTotalInput}
											onChange={(e) => setInvoiceTotalInput(e.target.value)}
											className="h-8 text-xs bg-slate-900/60 border-slate-700 text-white"
										/>
										<Button size="sm" className="h-8" onClick={primaryAction.action}>
											Generate invoice
										</Button>
									</div>
								</div>
							)}
						</div>

						{latestInvoice && (
							<div
								className={`mt-1 rounded-md border border-slate-800 bg-slate-950/70 p-3 space-y-3 ${
									invoiceStatusRaw === "paid" ? "opacity-90" : ""
								}`}
							>
								<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
									<div>
										<p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Invoice</p>
										<p className="text-sm font-semibold text-white">
											{invoiceNumberDisplay}
										</p>
										<p className="text-[11px] text-gray-400">
											Created {new Date(latestInvoice.created_at).toLocaleDateString()}
										</p>
										<p className="text-[11px] text-gray-400 mt-1">{invoiceIssuedBy}</p>
									</div>
									<div className="flex flex-col items-end gap-1 text-right">
										<Badge className={`text-[10px] px-2 py-0.5 ${invoiceStatusClass}`}>
											{invoiceStatusLabel}
										</Badge>
										{invoiceTotal !== null && (
											<div className="text-sm font-semibold text-sky-400">
												{invoiceTotal.toLocaleString(undefined, {
													style: "currency",
													currency: invoiceCurrency,
												})}
											</div>
										)}
									</div>
								</div>

								{invoiceStatusRaw === "paid" && (
									<p className="text-[11px] text-emerald-300/90">
										This invoice is locked for editing. Keep it as a permanent record in your files and ledger.
									</p>
								)}

								<div className="rounded-md border border-slate-800 bg-slate-900/70">
									<Table className="text-[11px]">
										<TableHeader>
											<TableRow className="border-slate-800">
												<TableHead className="text-slate-400">Description</TableHead>
												<TableHead className="text-slate-400 w-16 text-right">Qty</TableHead>
												<TableHead className="text-slate-400 w-24 text-right">Unit</TableHead>
												<TableHead className="text-slate-400 w-24 text-right">Amount</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{invoiceLines.length === 0 ? (
												<TableRow className="border-slate-800">
													<TableCell colSpan={4} className="text-slate-500 text-center py-4">
														No line items recorded on this invoice.
													</TableCell>
												</TableRow>
											) : (
												invoiceLines.map((line, idx) => {
													const qty = typeof line.quantity === "number" ? line.quantity : 1;
													const unit = typeof line.unitPrice === "number" ? line.unitPrice : 0;
													const amount = typeof line.amount === "number" ? line.amount : qty * unit;
													return (
														<TableRow key={idx} className="border-slate-800">
															<TableCell className="text-slate-200">
																{line.description || "Line item"}
															</TableCell>
															<TableCell className="text-right text-slate-200">
																{qty}
															</TableCell>
															<TableCell className="text-right text-slate-200">
																{unit.toLocaleString(undefined, { style: "currency", currency: invoiceCurrency })}
															</TableCell>
															<TableCell className="text-right text-slate-200">
																{amount.toLocaleString(undefined, { style: "currency", currency: invoiceCurrency })}
															</TableCell>
														</TableRow>
													);
												})
											)}
										</TableBody>
									</Table>
								</div>

								<div className="mt-3 flex flex-col items-end gap-1 text-[11px] text-slate-200">
									{invoiceSubtotal !== null && (
										<div className="flex justify-between gap-6 w-full max-w-xs">
											<span className="text-slate-400">Subtotal</span>
											<span>
												{invoiceSubtotal.toLocaleString(undefined, { style: "currency", currency: invoiceCurrency })}
											</span>
										</div>
									)}
									{invoiceTax !== null && (
										<div className="flex justify-between gap-6 w-full max-w-xs">
											<span className="text-slate-400">Tax</span>
											<span>
												{invoiceTax.toLocaleString(undefined, { style: "currency", currency: invoiceCurrency })}
											</span>
										</div>
									)}
									{invoiceTotal !== null && (
										<div className="flex justify-between gap-6 w-full max-w-xs font-semibold">
											<span className="text-slate-200">Total</span>
											<span>
												{invoiceTotal.toLocaleString(undefined, { style: "currency", currency: invoiceCurrency })}
											</span>
										</div>
									)}
								</div>

								{invoicePayment && (
									<div className="mt-3 border-t border-slate-800 pt-2 text-[11px] text-slate-300">
										<p className="font-semibold mb-1">Payment</p>
										<p>
											Method: <span className="text-slate-100">{invoicePayment.method || "other"}</span>
										</p>
										{invoicePayment.reference && (
											<p>
												Reference: <span className="text-slate-100">{invoicePayment.reference}</span>
											</p>
										)}
										{invoicePayment.receivedAt && (
											<p>
												Received {new Date(invoicePayment.receivedAt).toLocaleString()}
											</p>
										)}
									</div>
								)}
							</div>
						)}

						<div className="mt-2 rounded-md border border-slate-800 bg-slate-950/60 p-3">
							<p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Timeline</p>
							<div className="space-y-1 text-[11px] text-gray-300">
								<p>
									<span className="font-semibold">Material list:</span>{" "}
									{latestMaterial ? latestMaterial.status : "Not created yet"}
								</p>
								<p>
									<span className="font-semibold">Estimate:</span>{" "}
									{latestEstimate ? latestEstimate.status : "Not created yet"}
								</p>
								<p>
									<span className="font-semibold">Contract:</span>{" "}
									{latestContract ? latestContract.status : "Not created yet"}
								</p>
								<p>
									<span className="font-semibold">Invoice:</span>{" "}
									{latestInvoice ? latestInvoice.status : "Not created yet"}
								</p>
								<p>
									<span className="font-semibold">Receipt:</span>{" "}
									{latestReceipt ? latestReceipt.status : "Not created yet"}
								</p>
							</div>
						</div>

						<div className="mt-3 space-y-2 flex-1 overflow-auto">
							<p className="text-xs uppercase tracking-wide text-gray-500">All documents</p>
							{documents.length === 0 ? (
								<p className="text-xs text-gray-400">
									No documents recorded yet. When you create or attach a document, it will show up here.
								</p>
							) : (
								<div className="space-y-2">
									{documents.map((doc) => (
										<div
											key={doc.id}
											className="border border-slate-800 rounded-md p-2 bg-slate-950/60"
										>
											<div className="flex items-center justify-between mb-1">
												<p className="text-xs font-semibold text-white">
													{doc.type}
												</p>
												<Badge className="text-[10px] px-2 py-0.5 bg-slate-800 border-slate-600">
													{doc.status}
												</Badge>
											</div>
											<p className="text-[11px] text-gray-400 mb-1">
												Updated {new Date(doc.updated_at).toLocaleString()}
											</p>
											<div className="flex items-center gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleShare(doc.id)}
												>
													Share
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleDownloadPdf(doc.id)}
												>
													PDF
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
