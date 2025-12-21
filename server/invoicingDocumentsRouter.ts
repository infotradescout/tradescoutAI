import express, { Request, Response } from "express";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import type { Pool } from "@neondatabase/serverless";
import { isAuthenticated } from "./auth";
import { storage } from "./storage";

type AuthedRequest = Request & { user?: { id?: string; role?: string; [key: string]: any } };

	r.get(
		"/api/accounting/reports/summary",
		isAuthenticated,
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const userId = String(req.user!.id);

			const overallRes = await pool.query(
				`SELECT
					COUNT(*) AS invoice_count,
					COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
					COUNT(*) FILTER (WHERE status <> 'paid') AS unpaid_count,
					COALESCE(SUM((payload->>'total')::numeric), 0) AS total_amount,
					COALESCE(SUM(CASE WHEN status = 'paid' THEN (payload->>'total')::numeric ELSE 0 END), 0) AS paid_amount
				FROM documents
				WHERE type = 'INVOICE' AND created_by = $1 AND job_id LIKE 'acct_%'`,
				[userId],
			);
			const overall = overallRes.rows[0] || {
				invoice_count: 0,
				paid_count: 0,
				unpaid_count: 0,
				total_amount: 0,
				paid_amount: 0,
			};

			const byMonthRes = await pool.query(
				`SELECT
					date_trunc('month', created_at) AS month,
					COALESCE(SUM((payload->>'total')::numeric), 0) AS total_amount,
					COALESCE(SUM(CASE WHEN status = 'paid' THEN (payload->>'total')::numeric ELSE 0 END), 0) AS paid_amount
				FROM documents
				WHERE type = 'INVOICE' AND created_by = $1 AND job_id LIKE 'acct_%'
				GROUP BY 1
				ORDER BY 1 DESC
				LIMIT 24`,
				[userId],
			);

			res.json({
				lifetime: {
					invoiceCount: Number(overall.invoice_count) || 0,
					paidCount: Number(overall.paid_count) || 0,
					unpaidCount: Number(overall.unpaid_count) || 0,
					totalAmount: Number(overall.total_amount) || 0,
					paidAmount: Number(overall.paid_amount) || 0,
					unpaidAmount:
						Number(overall.total_amount || 0) - Number(overall.paid_amount || 0),
				},
				byMonth: byMonthRes.rows.map((row) => ({
					month: (row.month as Date).toISOString(),
					totalAmount: Number(row.total_amount) || 0,
					paidAmount: Number(row.paid_amount) || 0,
				})),
			});
		}),
	);
function requireAuth(req: AuthedRequest): asserts req is AuthedRequest & { user: { id: string } } {
	if (!req.user?.id) {
		const err = new Error("AUTH_REQUIRED");
		// @ts-expect-error attach status for centralized error handler
		err.status = 401;
		throw err;
	}
}

function ipFromReq(req: Request): string {
	const xf = req.headers["x-forwarded-for"];
	if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
	return req.socket.remoteAddress || "unknown";
}

function token32(): string {
	return crypto.randomBytes(24).toString("base64url");
}

function okNumber(n: unknown): number {
	if (typeof n === "number" && Number.isFinite(n)) return n;
	if (typeof n === "string" && n.trim() !== "" && Number.isFinite(Number(n))) return Number(n);
	return 0;
}

function assertRole(role: string) {
	if (role !== "homeowner" && role !== "contractor") {
		const err = new Error("INVALID_ROLE");
		// @ts-expect-error attach status
		err.status = 400;
		throw err;
	}
}

// Homeowner can only edit whitelisted material fields
const HOMEOWNER_ITEM_EDIT_PATHS = new Set<keyof any>([
	"brand",
	"model",
	"notes",
	"choiceUrl",
	"choiceSku",
]);

function validateHomeownerMaterialListPatch(patch: any) {
	// patch format: { items: [{ id, brand?, model?, notes?, choiceUrl?, choiceSku? }, ...] }
	if (!patch || typeof patch !== "object") {
		const err = new Error("INVALID_PATCH");
		// @ts-expect-error attach status
		err.status = 400;
		throw err;
	}
	if (!Array.isArray(patch.items)) {
		const err = new Error("INVALID_PATCH_ITEMS");
		// @ts-expect-error attach status
		err.status = 400;
		throw err;
	}

	for (const item of patch.items) {
		if (!item || typeof item !== "object") {
			const err = new Error("INVALID_ITEM");
			// @ts-expect-error attach status
			err.status = 400;
			throw err;
		}
		if (!item.id || typeof item.id !== "string") {
			const err = new Error("MISSING_ITEM_ID");
			// @ts-expect-error attach status
			err.status = 400;
			throw err;
		}
		for (const key of Object.keys(item)) {
			if (key === "id") continue;
			if (!HOMEOWNER_ITEM_EDIT_PATHS.has(key)) {
				const err = new Error(`HOMEOWNER_FIELD_NOT_ALLOWED:${key}`);
				// @ts-expect-error attach status
				err.status = 403;
				throw err;
			}
		}
	}
}

function renderPdfFromDocument(docRow: any, signatures: any[]) {
	const pdf = new PDFDocument({ margin: 50 });
	const chunks: Buffer[] = [];
	pdf.on("data", (c: Buffer) => chunks.push(c));
	const done = new Promise<Buffer>((resolve) => pdf.on("end", () => resolve(Buffer.concat(chunks))));

	const title = `${docRow.type} — v${docRow.version}`;
	pdf.fontSize(18).text(title, { underline: true });
	pdf.moveDown(0.5);
	pdf.fontSize(10).fillColor("gray").text(`Document ID: ${docRow.id}`);
	if (docRow.job_id) pdf.text(`Job ID: ${docRow.job_id}`);
	pdf.text(`Status: ${docRow.status}`);
	pdf.text(`Updated: ${new Date(docRow.updated_at).toISOString()}`);
	pdf.fillColor("black");
	pdf.moveDown();

	const payload = docRow.payload || {};
	if (docRow.type === "MATERIAL_LIST") {
		pdf.fontSize(14).text("Line Items", { underline: true });
		pdf.moveDown(0.25);
		const items = Array.isArray(payload.items) ? payload.items : [];
		for (const it of items) {
			const name = it.name || it.title || "Item";
			const qty = okNumber(it.quantity);
			pdf.fontSize(11).text(`• ${name}  (qty: ${qty})`);
			if (it.brand) pdf.fontSize(10).fillColor("gray").text(`  brand: ${it.brand}`).fillColor("black");
			if (it.model) pdf.fontSize(10).fillColor("gray").text(`  model: ${it.model}`).fillColor("black");
			if (it.notes) pdf.fontSize(10).fillColor("gray").text(`  notes: ${it.notes}`).fillColor("black");
			pdf.moveDown(0.15);
		}
	} else if (docRow.type === "ESTIMATE" || docRow.type === "INVOICE" || docRow.type === "RECEIPT") {
		pdf.fontSize(14).text("Totals", { underline: true });
		pdf.moveDown(0.25);
		pdf.fontSize(11).text(`Subtotal: ${okNumber(payload.subtotal)}`);
		pdf.fontSize(11).text(`Tax: ${okNumber(payload.tax)}`);
		pdf.fontSize(11).text(`Total: ${okNumber(payload.total)}`);
		pdf.moveDown();

		const lines = Array.isArray(payload.lines) ? payload.lines : [];
		if (lines.length) {
			pdf.fontSize(14).text("Line Items", { underline: true });
			pdf.moveDown(0.25);
			for (const ln of lines) {
				const label = ln.label || ln.name || "Line";
				pdf.fontSize(11).text(`• ${label}  —  ${okNumber(ln.amount)}`);
			}
		}
	} else if (docRow.type === "CONTRACT") {
		pdf.fontSize(14).text("Contract", { underline: true });
		pdf.moveDown(0.25);
		const body = typeof payload.body === "string" ? payload.body : "";
		pdf.fontSize(11).text(body || "(No contract body)", { lineGap: 4 });
		pdf.moveDown();
	}

	if (signatures?.length) {
		pdf.moveDown();
		pdf.fontSize(14).text("Signatures", { underline: true });
		pdf.moveDown(0.25);
		for (const s of signatures) {
			pdf
				.fontSize(11)
				.text(
					`${String(s.role).toUpperCase()} signed ${new Date(s.signed_at).toISOString()} (${s.signature_type})`,
				);
			if (s.typed_name)
				pdf
					.fontSize(10)
					.fillColor("gray")
					.text(`  name: ${s.typed_name}`)
					.fillColor("black");
			pdf.fontSize(10).fillColor("gray").text(`  ip: ${s.ip}`).fillColor("black");
			pdf.moveDown(0.15);
		}
	}

	pdf.end();
	return done;
}

export function createInvoicingDocumentsRouter(pool: Pool) {
	const r = express.Router();

	async function buildCorrespondenceMetadata(doc: any, req: AuthedRequest) {
		const senderUserId = String(req.user!.id);

		const senderUserRes = await pool.query(
			"SELECT id, email, first_name, last_name, phone, active_profile_id FROM users WHERE id = $1",
			[senderUserId],
		);
		const senderUserRow = senderUserRes.rows[0] || null;

		let senderProfile: any = null;
		let senderBusiness: any = null;
		if (senderUserRow?.active_profile_id) {
			try {
				const profile = await storage.getProfileByIdForOwner(
					senderUserId,
					String(senderUserRow.active_profile_id),
				);
				if (profile) {
					senderProfile = {
						id: profile.id,
						slug: profile.slug,
						displayName: profile.displayName,
						headline: profile.headline,
						roleContext: profile.roleContext,
					};
					if (profile.businessId) {
						const business = await storage.getBusinessPublicById(profile.businessId);
						if (business) {
							senderBusiness = {
								id: business.id,
								name: business.name,
								contactEmail: (business as any).contactEmail ?? null,
								contactPhone: (business as any).contactPhone ?? null,
							};
						}
					}
				}
			} catch (e) {
				console.error("[DOC_CORRESPONDENCE] sender profile lookup failed", e);
			}
		}

		let recipientUserRow: any = null;
		const rawJobId = doc.job_id as string | null;
		if (rawJobId && typeof rawJobId === "string" && !rawJobId.startsWith("acct_")) {
			try {
				const leadRes = await pool.query(
					"SELECT id, user_id, contractor_id FROM leads WHERE id = $1",
					[rawJobId],
				);
				const leadRow = leadRes.rows[0] || null;
				if (leadRow) {
					const homeownerId = leadRow.user_id ? String(leadRow.user_id) : null;
					const contractorId = leadRow.contractor_id ? String(leadRow.contractor_id) : null;

					if (homeownerId || contractorId) {
						const currentUserId = senderUserId;

						// If the sender is the homeowner, aim at the contractor (if any).
						if (homeownerId && currentUserId === homeownerId && contractorId) {
							const contractor = await storage.getContractor(contractorId);
							if (contractor?.userId) {
								const rec = await pool.query(
									"SELECT id, email, first_name, last_name, phone FROM users WHERE id = $1",
									[String(contractor.userId)],
								);
								recipientUserRow = rec.rows[0] || null;
							}
						} else if (homeownerId && currentUserId !== homeownerId) {
							// Otherwise assume sender is the contractor (or staff) and aim at homeowner.
							const rec = await pool.query(
								"SELECT id, email, first_name, last_name, phone FROM users WHERE id = $1",
								[homeownerId],
							);
							recipientUserRow = rec.rows[0] || null;
						}
					}
				}
			} catch (e) {
				console.error("[DOC_CORRESPONDENCE] recipient lookup failed", e);
			}
		}

		return {
			channel: "email" as const,
			sender: senderUserRow
				? {
					user: {
						id: String(senderUserRow.id),
						email: senderUserRow.email ?? null,
						firstName: senderUserRow.first_name ?? null,
						lastName: senderUserRow.last_name ?? null,
						phone: senderUserRow.phone ?? null,
					},
					profile: senderProfile,
					business: senderBusiness,
				}
				: null,
			recipient: recipientUserRow
				? {
					user: {
						id: String(recipientUserRow.id),
						email: recipientUserRow.email ?? null,
						firstName: recipientUserRow.first_name ?? null,
						lastName: recipientUserRow.last_name ?? null,
						phone: recipientUserRow.phone ?? null,
					},
				}
				: null,
		};
	}

	// Small wrapper to funnel async errors into the global error handler
	const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
		async (req: Request, res: Response, next: (err?: any) => void) => {
			try {
				await fn(req, res);
			} catch (e) {
				next(e);
			}
		};

	// List all documents for a job/project
	r.get(
		"/api/jobs/:jobId/documents",
		isAuthenticated,
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { jobId } = req.params;
			const { rows } = await pool.query(
				"SELECT * FROM documents WHERE job_id = $1 ORDER BY created_at ASC, version ASC",
				[jobId],
			);
			res.json({ documents: rows });
		}),
	);

	// Create a material list draft for a job
	r.post(
		"/api/jobs/:jobId/material-list",
		isAuthenticated,
		express.json(),
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { jobId } = req.params;

			// Minimal payload shape; you can pass items, notes, etc.
			const payload = req.body?.payload ?? {};
			const permissions =
				req.body?.permissions ?? {
					homeownerEditable: [
						"items.brand",
						"items.model",
						"items.notes",
						"items.choiceUrl",
						"items.choiceSku",
					],
				};

			const { rows } = await pool.query(
				`INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
				 VALUES ($1, 'MATERIAL_LIST', 'draft', 1, $2::jsonb, $3::jsonb, $4)
				 RETURNING *`,
				[jobId, JSON.stringify(payload), JSON.stringify(permissions), req.user.id],
			);

			res.status(201).json({ document: rows[0] });
		}),
	);

	// Generic document update with field-level controls for homeowner on material lists
	r.put(
		"/api/documents/:id",
		isAuthenticated,
		express.json(),
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { id } = req.params;

			const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
			if (!docRes.rows.length) {
				const err = new Error("DOC_NOT_FOUND");
				// @ts-expect-error attach status
				err.status = 404;
				throw err;
			}
			const doc = docRes.rows[0];

			// You can harden this later with real job membership/role checks.
			const isOwner = String(doc.created_by) === String(req.user.id);

			if (doc.type === "MATERIAL_LIST" && !isOwner) {
				// homeowner patch
				validateHomeownerMaterialListPatch(req.body?.payload);
				// Merge allowed changes into payload.items by id
				const current = doc.payload || {};
				const items = Array.isArray(current.items) ? current.items : [];
				const patchItems = req.body.payload.items;

				const itemMap = new Map<string, any>(
					items.map((it: any) => [String(it.id), { ...it }]),
				);
				for (const p of patchItems) {
					const target = itemMap.get(String(p.id));
					if (!target) continue;
					for (const k of Object.keys(p)) {
						if (k === "id") continue;
						target[k] = p[k];
					}
				}

				const nextPayload = { ...current, items: Array.from(itemMap.values()) };
				const updated = await pool.query(
					"UPDATE documents SET payload = $2::jsonb WHERE id = $1 RETURNING *",
					[id, JSON.stringify(nextPayload)],
				);
				return res.json({ document: updated.rows[0] });
			}

			// Default: full update allowed only for creator until locked statuses per type
			const payload = req.body?.payload;
			if (!isOwner) {
				const err = new Error("NO_EDIT_PERMISSION");
				// @ts-expect-error attach status
				err.status = 403;
				throw err;
			}

			// lock rules
			if (doc.type === "ESTIMATE" && doc.status !== "draft") {
				const err = new Error("ESTIMATE_LOCKED");
				// @ts-expect-error attach status
				err.status = 409;
				throw err;
			}
			if (doc.type === "CONTRACT" && doc.status !== "draft") {
				const err = new Error("CONTRACT_LOCKED");
				// @ts-expect-error attach status
				err.status = 409;
				throw err;
			}
			if (doc.type === "INVOICE" && doc.status !== "draft") {
				const err = new Error("INVOICE_LOCKED");
				// @ts-expect-error attach status
				err.status = 409;
				throw err;
			}

			const updated = await pool.query(
				"UPDATE documents SET payload = $2::jsonb WHERE id = $1 RETURNING *",
				[id, JSON.stringify(payload ?? doc.payload)],
			);
			res.json({ document: updated.rows[0] });
		}),
	);

	// Send a document to the other party (status transition only).
	// A separate metadata endpoint exposes sender/recipient info for
	// correspondence flows (prefilled from profiles and users).
	r.post(
		"/api/documents/:id/send",
		isAuthenticated,
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { id } = req.params;

			const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
			if (!docRes.rows.length) {
				const err = new Error("DOC_NOT_FOUND");
				// @ts-expect-error attach status
				err.status = 404;
				throw err;
			}
			const doc = docRes.rows[0];

			if (String(doc.created_by) !== String(req.user.id)) {
				const err = new Error("ONLY_CREATOR_CAN_SEND");
				// @ts-expect-error attach status
				err.status = 403;
				throw err;
			}

			let nextStatus = doc.status as string;
			if (doc.type === "ESTIMATE") nextStatus = "sent";
			else if (doc.type === "CONTRACT") nextStatus = "sent";
			else if (doc.type === "INVOICE") nextStatus = "sent";
			else if (doc.type === "MATERIAL_LIST") nextStatus = "pending_homeowner";
			else {
				const err = new Error("SEND_NOT_SUPPORTED");
				// @ts-expect-error attach status
				err.status = 400;
				throw err;
			}

			const updated = await pool.query(
				"UPDATE documents SET status = $2 WHERE id = $1 RETURNING *",
				[id, nextStatus],
			);
			const updatedDoc = updated.rows[0];
			console.info("[DOC_TRANSITION]", {
				docId: updatedDoc.id,
				from: doc.status,
				to: updatedDoc.status,
				userId: req.user.id,
				type: updatedDoc.type,
				action: "send",
			});

			// TODO: when correspondence channels are wired, pull sender profile
			// from req.user.activeProfileId and prefill sender/recipient details
			// in the outgoing message template.

			res.json({ document: updatedDoc });
		}),
	);

	// Prefill correspondence details for a document: pulls sender info from the
	// current user's active profile and business, and recipient info from the
	// lead attached to this job when available.
	r.get(
		"/api/documents/:id/correspondence-metadata",
		isAuthenticated,
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { id } = req.params;

			const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
			if (!docRes.rows.length) {
				const err = new Error("DOC_NOT_FOUND");
				// @ts-expect-error attach status
				err.status = 404;
				throw err;
			}
			const doc = docRes.rows[0];
			const metadata = await buildCorrespondenceMetadata(doc, req);
			res.json({
				documentId: doc.id,
				jobId: doc.job_id ?? null,
				type: doc.type,
				status: doc.status,
				correspondence: metadata,
			});
		}),
	);

	// Approve an estimate and auto-create a contract draft
		r.post(
		"/api/documents/:id/approve",
		isAuthenticated,
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { id } = req.params;

			const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
			if (!docRes.rows.length) {
				const err = new Error("DOC_NOT_FOUND");
				// @ts-expect-error attach status
				err.status = 404;
				throw err;
			}
			const doc = docRes.rows[0];

			if (doc.type !== "ESTIMATE") {
				const err = new Error("NOT_AN_ESTIMATE");
				// @ts-expect-error attach status
				err.status = 400;
				throw err;
			}
			if (doc.status !== "sent") {
				const err = new Error("ESTIMATE_NOT_SENT");
				// @ts-expect-error attach status
				err.status = 409;
				throw err;
			}

			// For now: allow approval by any non-creator (prevents contractor approving own estimate).
			if (String(doc.created_by) === String(req.user.id)) {
				const err = new Error("CREATOR_CANNOT_APPROVE");
				// @ts-expect-error attach status
				err.status = 403;
				throw err;
			}

			const updated = await pool.query(
				"UPDATE documents SET status='approved' WHERE id = $1 RETURNING *",
				[id],
			);
			const approved = updated.rows[0];
			console.info("[DOC_TRANSITION]", {
				docId: approved.id,
				from: doc.status,
				to: approved.status,
				userId: req.user.id,
				type: approved.type,
				action: "approve_estimate",
			});

			const payload = doc.payload || {};
			const contractPayload = {
				body: (payload.contractTemplateBody ?? "").toString(),
				derivedFromEstimateId: doc.id,
				totals: payload.total ?? null,
			};

			const contract = await pool.query(
				`INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
				 VALUES ($1, 'CONTRACT', 'draft', 1, $2::jsonb, $3::jsonb, $4)
				 RETURNING *`,
				[doc.job_id, JSON.stringify(contractPayload), JSON.stringify({}), doc.created_by],
			);

			const contractDoc = contract.rows[0];
			console.info("[DOC_TRANSITION]", {
				docId: contractDoc.id,
				from: null,
				to: contractDoc.status,
				userId: req.user.id,
				type: contractDoc.type,
				action: "create_contract_from_estimate",
			});
			res.json({ estimate: approved, contract: contractDoc });
		}),
	);

	// Sign a contract
		r.post(
		"/api/documents/:id/sign",
		isAuthenticated,
		express.json(),
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { id } = req.params;
			const { role, signatureType, name, drawingData } = (req.body ?? {}) as any;
			assertRole(role);
			if (signatureType !== "typed" && signatureType !== "drawn") {
				const err = new Error("INVALID_SIGNATURE_TYPE");
				// @ts-expect-error attach status
				err.status = 400;
				throw err;
			}
			if (signatureType === "typed" && (!name || typeof name !== "string")) {
				const err = new Error("TYPED_NAME_REQUIRED");
				// @ts-expect-error attach status
				err.status = 400;
				throw err;
			}
			if (signatureType === "drawn" && (!drawingData || typeof drawingData !== "string")) {
				const err = new Error("DRAWING_DATA_REQUIRED");
				// @ts-expect-error attach status
				err.status = 400;
				throw err;
			}

			const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
			if (!docRes.rows.length) {
				const err = new Error("DOC_NOT_FOUND");
				// @ts-expect-error attach status
				err.status = 404;
				throw err;
			}
			const doc = docRes.rows[0];

			if (doc.type !== "CONTRACT") {
				const err = new Error("SIGN_ONLY_CONTRACT");
				// @ts-expect-error attach status
				err.status = 400;
				throw err;
			}
			if (doc.status !== "sent" && doc.status !== "partially_signed") {
				const err = new Error("CONTRACT_NOT_READY_FOR_SIGN");
				// @ts-expect-error attach status
				err.status = 409;
				throw err;
			}

			// Prevent duplicate signing by the same role; surface a clear 409.
			const existingSig = await pool.query(
				"SELECT 1 FROM document_signatures WHERE document_id = $1 AND role = $2 LIMIT 1",
				[id, role],
			);
			if (existingSig.rows.length) {
				const err = new Error("ROLE_ALREADY_SIGNED");
				// @ts-expect-error attach status
				err.status = 409;
				throw err;
			}

			const ip = ipFromReq(req);

			await pool.query(
				`INSERT INTO document_signatures (document_id, role, user_id, ip, signature_type, typed_name, drawing_data)
				 VALUES ($1,$2,$3,$4,$5,$6,$7)
				 ON CONFLICT (document_id, role) DO UPDATE SET
				   user_id=excluded.user_id,
				   signed_at=now(),
				   ip=excluded.ip,
				   signature_type=excluded.signature_type,
				   typed_name=excluded.typed_name,
				   drawing_data=excluded.drawing_data`,
				[
					id,
					role,
					req.user.id,
					ip,
					signatureType,
					signatureType === "typed" ? name : null,
					signatureType === "drawn" ? drawingData : null,
				],
			);

			const sigs = await pool.query(
				"SELECT role FROM document_signatures WHERE document_id = $1",
				[id],
			);
			const roles = new Set<string>(sigs.rows.map((r) => String(r.role)));
			const fullySigned = roles.has("homeowner") && roles.has("contractor");

			const nextStatus = fullySigned ? "signed" : "partially_signed";
			const updated = await pool.query(
				"UPDATE documents SET status=$2, signed_at=CASE WHEN $2='signed' THEN now() ELSE signed_at END WHERE id=$1 RETURNING *",
				[id, nextStatus],
			);
			const updatedDoc = updated.rows[0];
			console.info("[DOC_TRANSITION]", {
				docId: updatedDoc.id,
				from: doc.status,
				to: updatedDoc.status,
				userId: req.user.id,
				type: updatedDoc.type,
				action: "sign_contract",
				role,
				fullySigned,
			});

			res.json({ document: updatedDoc, fullySigned });
		}),
	);

	// Create an invoice for a job.
	// For structured projects with a contract, this preserves the existing
	// guardrails (require a signed contract). For smaller or off-platform
	// jobs, contractors can optionally skip straight to an invoice by passing
	// { allowSkipContract: true } in the body.
	r.post(
		"/api/jobs/:jobId/invoice",
		isAuthenticated,
		express.json(),
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { jobId } = req.params;
			const allowSkipContract = !!(req.body && (req.body as any).allowSkipContract);

			if (!allowSkipContract) {
				const contractRes = await pool.query(
					"SELECT * FROM documents WHERE job_id=$1 AND type='CONTRACT' ORDER BY created_at DESC LIMIT 1",
					[jobId],
				);
				if (!contractRes.rows.length) {
					const err = new Error("CONTRACT_REQUIRED");
					// @ts-expect-error attach status
					err.status = 409;
					throw err;
				}
				if (contractRes.rows[0].status !== "signed") {
					const err = new Error("CONTRACT_NOT_SIGNED");
					// @ts-expect-error attach status
					err.status = 409;
					throw err;
				}
			}

			const payload = (req.body && (req.body as any).payload) || req.body?.payload || {};
			const created = await pool.query(
				`INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
					 VALUES ($1,'INVOICE','draft',1,$2::jsonb,$3::jsonb,$4)
					 RETURNING *`,
				[jobId, JSON.stringify(payload), JSON.stringify({}), req.user.id],
			);
			const invoice = created.rows[0];
			console.info("[DOC_TRANSITION]", {
				docId: invoice.id,
				from: null,
				to: invoice.status,
				userId: req.user.id,
				type: invoice.type,
				action: allowSkipContract ? "create_invoice_without_contract" : "create_invoice",
			});
			res.status(201).json({ document: invoice });
		}),
	);

	// Issue a receipt for a job (requires invoice, optionally marks it paid)
	r.post(
		"/api/jobs/:jobId/receipt",
		isAuthenticated,
		express.json(),
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { jobId } = req.params;

			const invoiceRes = await pool.query(
				"SELECT * FROM documents WHERE job_id=$1 AND type='INVOICE' ORDER BY created_at DESC LIMIT 1",
				[jobId],
			);
			if (!invoiceRes.rows.length) {
				const err = new Error("INVOICE_REQUIRED");
				// @ts-expect-error attach status
				err.status = 409;
				throw err;
			}

			const markPaid = !!req.body?.markPaid;
			if (markPaid) {
				await pool.query("UPDATE documents SET status='paid' WHERE id=$1", [invoiceRes.rows[0].id]);
			}

			const invRes = await pool.query("SELECT * FROM documents WHERE id=$1", [invoiceRes.rows[0].id]);
			const inv = invRes.rows[0];
			if (inv.status !== "paid") {
				const err = new Error("INVOICE_NOT_PAID");
				// @ts-expect-error attach status
				err.status = 409;
				throw err;
			}

			const receiptPayload = {
				derivedFromInvoiceId: inv.id,
				amount: inv.payload?.total ?? null,
				currency: inv.payload?.currency ?? "USD",
			};
			const created = await pool.query(
				`INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
					 VALUES ($1,'RECEIPT','issued',1,$2::jsonb,$3::jsonb,$4)
					 RETURNING *`,
				[jobId, JSON.stringify(receiptPayload), JSON.stringify({}), req.user.id],
			);
			const receipt = created.rows[0];
			console.info("[DOC_TRANSITION]", {
				docId: receipt.id,
				from: null,
				to: receipt.status,
				userId: req.user.id,
				type: receipt.type,
				action: "issue_receipt",
				invoiceId: inv.id,
			});
			res.status(201).json({ document: receipt });
		}),
	);

	// Standalone accounting: create a manual invoice for off-platform or past work.
	// This does not require a contract and creates a dedicated accounting job id prefix so it
	// can still flow through the deal room UI.
	r.post(
		"/api/accounting/standalone-invoice",
		isAuthenticated,
		express.json(),
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { projectTitle, clientName, notes, total, currency } = (req.body ?? {}) as any;

			const amount = okNumber(total);
			if (!Number.isFinite(amount) || amount <= 0) {
				const err = new Error("INVALID_TOTAL");
				// @ts-expect-error attach status
				err.status = 400;
				throw err;
			}

			const jobId = `acct_${token32()}`;
			const safeCurrency =
				typeof currency === "string" && currency.trim()
					? currency.trim().toUpperCase()
					: "USD";
			const title =
				typeof projectTitle === "string" && projectTitle.trim()
					? projectTitle.trim()
					: "Manual project";
			const client =
				typeof clientName === "string" && clientName.trim()
					? clientName.trim()
					: null;
			const memo =
				typeof notes === "string" && notes.trim()
					? notes.trim()
					: null;

			const payload = {
				projectTitle: title,
				clientName: client,
				notes: memo,
				subtotal: amount,
				tax: 0,
				total: amount,
				currency: safeCurrency,
				lines: [],
			};

			const created = await pool.query(
				`INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
					 VALUES ($1,'INVOICE','draft',1,$2::jsonb,$3::jsonb,$4)
					 RETURNING *`,
				[jobId, JSON.stringify(payload), JSON.stringify({}), req.user.id],
			);
			const invoice = created.rows[0];
			console.info("[DOC_TRANSITION]", {
				docId: invoice.id,
				from: null,
				to: invoice.status,
				userId: req.user.id,
				type: invoice.type,
				action: "create_standalone_invoice",
				jobId,
			});

			res.status(201).json({ document: invoice, jobId });
		}),
	);

	// Standalone accounting: list manual invoices for the current user, with basic pagination.
	r.get(
		"/api/accounting/standalone-invoices",
		isAuthenticated,
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const pageRaw = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
			const pageSizeRaw = Array.isArray(req.query.pageSize)
				? req.query.pageSize[0]
				: req.query.pageSize;

			const page = Math.max(1, Number(pageRaw || 1) || 1);
			const pageSize = Math.min(200, Math.max(1, Number(pageSizeRaw || 50) || 50));
			const offset = (page - 1) * pageSize;

			const totalRes = await pool.query(
				`SELECT COUNT(*)::int AS count
					FROM documents
					WHERE type='INVOICE' AND created_by=$1 AND job_id LIKE 'acct_%'`,
				[req.user.id],
			);
			const totalCount: number = totalRes.rows[0]?.count ?? 0;

			const { rows } = await pool.query(
				`SELECT id, job_id, type, status, payload, created_at, updated_at
					FROM documents
					WHERE type='INVOICE' AND created_by=$1 AND job_id LIKE 'acct_%'
					ORDER BY updated_at DESC NULLS LAST, created_at DESC
					LIMIT $2 OFFSET $3`,
				[req.user.id, pageSize, offset],
			);
			res.json({
				invoices: rows,
				pagination: {
					page,
					pageSize,
					totalCount,
					pageCount: pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0,
				},
			});
		}),
	);

	// Mark an invoice as paid (manual or external payment) and auto-issue a receipt.
	// Supports both job-linked and standalone (job_id NULL) invoices.
	r.post(
		"/api/documents/:id/mark-paid",
		isAuthenticated,
		express.json(),
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { id } = req.params;
			const { method, reference, receivedAt } = (req.body ?? {}) as any;

			const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
			if (!docRes.rows.length) {
				const err = new Error("DOC_NOT_FOUND");
				// @ts-expect-error attach status
				err.status = 404;
				throw err;
			}
			const invoiceDoc = docRes.rows[0];

			if (invoiceDoc.type !== "INVOICE") {
				const err = new Error("NOT_AN_INVOICE");
				// @ts-expect-error attach status
				err.status = 400;
				throw err;
			}

			if (invoiceDoc.status !== "sent" && invoiceDoc.status !== "approved") {
				const err = new Error("INVOICE_NOT_READY_FOR_PAYMENT");
				// @ts-expect-error attach status
				err.status = 409;
				throw err;
			}

			const payment = {
				method: typeof method === "string" ? method : "other",
				reference: typeof reference === "string" ? reference : undefined,
				receivedAt: typeof receivedAt === "string" ? receivedAt : new Date().toISOString(),
				recordedBy: req.user.id,
			};

			const existingPayload = invoiceDoc.payload || {};
			const nextPayload = {
				...existingPayload,
				payment,
			};

			const updated = await pool.query(
				"UPDATE documents SET status='paid', payload=$2::jsonb WHERE id=$1 RETURNING *",
				[id, JSON.stringify(nextPayload)],
			);
			const paidInvoice = updated.rows[0];
			console.info("[DOC_TRANSITION]", {
				docId: paidInvoice.id,
				from: invoiceDoc.status,
				to: paidInvoice.status,
				userId: req.user.id,
				type: paidInvoice.type,
				action: "mark_invoice_paid",
				paymentMethod: payment.method,
			});

			const receiptPayload = {
				derivedFromInvoiceId: paidInvoice.id,
				amount: paidInvoice.payload?.total ?? null,
				currency: paidInvoice.payload?.currency ?? "USD",
				payment,
			};

			const created = await pool.query(
				`INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
					 VALUES ($1,'RECEIPT','issued',1,$2::jsonb,$3::jsonb,$4)
					 RETURNING *`,
				[paidInvoice.job_id ?? null, JSON.stringify(receiptPayload), JSON.stringify({}), req.user.id],
			);
			const receipt = created.rows[0];
			console.info("[DOC_TRANSITION]", {
				docId: receipt.id,
				from: null,
				to: receipt.status,
				userId: req.user.id,
				type: receipt.type,
				action: "auto_issue_receipt_on_paid",
				invoiceId: paidInvoice.id,
			});

			res.status(200).json({ document: paidInvoice, receipt });
		}),
	);

	// Create or fetch a share token for a document
	r.post(
		"/api/documents/:id/share",
		isAuthenticated,
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { id } = req.params;

			const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
			if (!docRes.rows.length) {
				const err = new Error("DOC_NOT_FOUND");
				// @ts-expect-error attach status
				err.status = 404;
				throw err;
			}
			const doc = docRes.rows[0];

			if (String(doc.created_by) !== String(req.user.id)) {
				const err = new Error("ONLY_CREATOR_CAN_SHARE");
				// @ts-expect-error attach status
				err.status = 403;
				throw err;
			}

			const shareToken = doc.share_token || token32();
			const updated = await pool.query(
				"UPDATE documents SET share_token=$2 WHERE id=$1 RETURNING *",
				[id, shareToken],
			);

			res.json({ shareUrl: `/d/${updated.rows[0].share_token}` });
		}),
	);

	// Public share endpoint (no auth)
	r.get(
		"/d/:shareToken",
		wrap(async (req: Request, res: Response) => {
			const { shareToken } = req.params;
			const docRes = await pool.query(
				"SELECT * FROM documents WHERE share_token = $1",
				[shareToken],
			);
			if (!docRes.rows.length) {
				return res.status(404).send("Not found");
			}

			const doc = docRes.rows[0];
			const sigs = await pool.query(
				"SELECT role,user_id,signed_at,ip,signature_type,typed_name FROM document_signatures WHERE document_id=$1 ORDER BY signed_at ASC",
				[doc.id],
			);

			res.json({ document: doc, signatures: sigs.rows });
		}),
	);

	// Authenticated PDF download
	r.get(
		"/api/documents/:id/pdf",
		isAuthenticated,
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { id } = req.params;

			const docRes = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
			if (!docRes.rows.length) {
				const err = new Error("DOC_NOT_FOUND");
				// @ts-expect-error attach status
				err.status = 404;
				throw err;
			}
			const doc = docRes.rows[0];

			// Tight read permission: creator can download; you can widen later (job members)
			if (String(doc.created_by) !== String(req.user.id)) {
				const err = new Error("NO_DOWNLOAD_PERMISSION");
				// @ts-expect-error attach status
				err.status = 403;
				throw err;
			}

			const sigs = await pool.query(
				"SELECT role,user_id,signed_at,ip,signature_type,typed_name FROM document_signatures WHERE document_id=$1 ORDER BY signed_at ASC",
				[id],
			);
			const pdfBuf = await renderPdfFromDocument(doc, sigs.rows);

			res.setHeader("Content-Type", "application/pdf");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="${String(doc.type).toLowerCase()}-${doc.id}.pdf"`,
			);
			res.send(pdfBuf);
		}),
	);

	return r;
}
