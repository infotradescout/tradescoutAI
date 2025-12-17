import express, { Request, Response } from "express";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import type { Pool } from "@neondatabase/serverless";
import { isAuthenticated } from "./auth";

type AuthedRequest = Request & { user?: { id?: string; role?: string; [key: string]: any } };

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
	pdf.on("data", (c) => chunks.push(c as Buffer));
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

	// Small wrapper to funnel async errors into the global error handler
	const wrap = (fn: (req: Request, res: Response) => Promise<void>) =>
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

	// Send a document to the other party (status transition only)
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
			res.json({ document: updated.rows[0] });
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

			res.json({ estimate: updated.rows[0], contract: contract.rows[0] });
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
			const { role, signatureType, name, drawingData } = req.body ?? {};
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

			res.json({ document: updated.rows[0], fullySigned });
		}),
	);

	// Create an invoice for a job (requires signed contract)
	r.post(
		"/api/jobs/:jobId/invoice",
		isAuthenticated,
		express.json(),
		wrap(async (req: AuthedRequest, res: Response) => {
			requireAuth(req);
			const { jobId } = req.params;

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

			const payload = req.body?.payload ?? {};
			const created = await pool.query(
				`INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
				 VALUES ($1,'INVOICE','draft',1,$2::jsonb,$3::jsonb,$4)
				 RETURNING *`,
				[jobId, JSON.stringify(payload), JSON.stringify({}), req.user.id],
			);
			res.status(201).json({ document: created.rows[0] });
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
				totals: inv.payload?.total ?? null,
			};
			const created = await pool.query(
				`INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)
				 VALUES ($1,'RECEIPT','issued',1,$2::jsonb,$3::jsonb,$4)
				 RETURNING *`,
				[jobId, JSON.stringify(receiptPayload), JSON.stringify({}), req.user.id],
			);
			res.status(201).json({ document: created.rows[0] });
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
