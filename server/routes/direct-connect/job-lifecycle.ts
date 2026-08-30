import type { Express, Request, Response } from "express";

type AuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; role?: string | null; [key: string]: any };
};

export type DirectConnectJobLifecycleRouteDependencies = Record<
  | "isAuthenticated"
  | "db"
  | "sql"
  | "storage"
  | "workers"
  | "eq"
  | "createId"
  | "toNumber"
  | "normalizeEstimateStatus"
  | "labelLifecycleAction"
  | "getAllowedLifecycleActions"
  | "getLifecycleStatusForRecipient"
  | "getUnreadLifecycleStatusCount"
  | "getJobWorkspaceByRequestId"
  | "appendDispatchEvent"
  | "notificationService"
  | "logDirectConnectFunnelEvent"
  | "recordOutcomeEvent"
  | "updateUserConfidenceStateFromOutcome"
  | "appendHomeIdTimelineEventFromDirectConnect"
  | "appendHomeIdCompletedWorkEnrichmentFromDirectConnect"
  | "finalizeDirectConnectCompletion"
  | "estimateCreateSchema"
  | "estimateUpdateSchema"
  | "estimateSendSchema"
  | "estimateRespondSchema"
  | "estimateLineItemSchema"
  | "paymentRequestCreateSchema"
  | "paymentRequestRespondSchema"
  | "scheduleProposalCreateSchema"
  | "scheduleProposalRespondSchema"
  | "checkpointCreateSchema"
  | "checkpointUpdateSchema"
  | "checkpointRespondSchema"
  | "changeOrderCreateSchema"
  | "changeOrderRespondSchema"
  | "punchItemCreateSchema"
  | "punchItemUpdateSchema"
  | "punchItemRespondSchema"
  | "completionRequestCreateSchema"
  | "completionRequestRespondSchema"
  | "invoiceCreateSchema"
  | "invoiceLineItemSchema"
  | "invoiceUpdateSchema"
  | "invoiceSendSchema"
  | "invoiceRespondSchema"
  | "receiptCreateSchema",
  any
>;

export function registerDirectConnectJobLifecycleRoutes(
  app: Express,
  dependencies: DirectConnectJobLifecycleRouteDependencies
) {
  const {
    isAuthenticated,
    db,
    sql,
    storage,
    workers,
    eq,
    createId,
    toNumber,
    normalizeEstimateStatus,
    labelLifecycleAction,
    getAllowedLifecycleActions,
    getLifecycleStatusForRecipient,
    getUnreadLifecycleStatusCount,
    getJobWorkspaceByRequestId,
    appendDispatchEvent,
    notificationService,
    logDirectConnectFunnelEvent,
    recordOutcomeEvent,
    updateUserConfidenceStateFromOutcome,
    appendHomeIdTimelineEventFromDirectConnect,
    appendHomeIdCompletedWorkEnrichmentFromDirectConnect,
    finalizeDirectConnectCompletion,
    estimateCreateSchema,
    estimateUpdateSchema,
    estimateSendSchema,
    estimateRespondSchema,
    estimateLineItemSchema,
    paymentRequestCreateSchema,
    paymentRequestRespondSchema,
    scheduleProposalCreateSchema,
    scheduleProposalRespondSchema,
    checkpointCreateSchema,
    checkpointUpdateSchema,
    checkpointRespondSchema,
    changeOrderCreateSchema,
    changeOrderRespondSchema,
    punchItemCreateSchema,
    punchItemUpdateSchema,
    punchItemRespondSchema,
    completionRequestCreateSchema,
    completionRequestRespondSchema,
    invoiceCreateSchema,
    invoiceLineItemSchema,
    invoiceUpdateSchema,
    invoiceSendSchema,
    invoiceRespondSchema,
    receiptCreateSchema,
  } = dependencies;

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });

        const parse = estimateCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid estimate payload", issues: parse.error.flatten() });
        }

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id, active_stage, status
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const dispatchRows = await db.execute(sql`
          SELECT contact_gate_state
          FROM direct_connect_dispatch_requests
          WHERE id = ${String(workspace.request_id)}
          LIMIT 1
        `);
        const contactGateState = String(
          ((dispatchRows.rows || []) as any[])[0]?.contact_gate_state || "locked"
        );
        if (contactGateState !== "released") {
          return res.status(409).json({ message: "Estimate creation requires released contact." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;

        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can create this estimate." });
        }

        const estimateId = createId("est");
        await db.execute(sql`
          INSERT INTO job_estimates (
            id, workspace_id, request_id, requester_user_id, business_id, contractor_id, title, scope_summary,
            status, subtotal_materials, subtotal_labor, subtotal_other, total_estimate, terms, expiration_date,
            created_by, created_at, updated_at
          )
          VALUES (
            ${estimateId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${parse.data.title.trim()},
            ${parse.data.scopeSummary.trim()},
            'draft',
            0,
            0,
            ${parse.data.subtotalOther ?? 0},
            ${parse.data.subtotalOther ?? 0},
            ${parse.data.terms ? parse.data.terms.trim() : null},
            ${parse.data.expirationDate ? new Date(parse.data.expirationDate).toISOString() : null},
            ${userId},
            now(),
            now()
          )
        `);

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'estimate', status = 'estimate_draft', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);

        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "estimate_started",
          metadata: { jobWorkspaceId, estimateId },
        });

        return res.status(201).json({
          estimateId,
          jobWorkspaceId,
          status: "draft",
          requestId: String(workspace.request_id),
        });
      } catch (error) {
        console.error("Error creating estimate:", error);
        return res.status(500).json({
          message: "Failed to create estimate",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/line-items",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const estimateId = String(req.params.estimateId || "").trim();
        const parse = estimateLineItemSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid line item payload", issues: parse.error.flatten() });
        }
        const estimateRows = await db.execute(sql`
          SELECT e.id, e.workspace_id, e.request_id, e.status
          FROM job_estimates e
          WHERE e.id = ${estimateId}
            AND e.workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((estimateRows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        const estimateStatus = normalizeEstimateStatus(estimate.status);
        if (!["draft", "change_requested"].includes(estimateStatus)) {
          return res.status(409).json({
            message: "Line items can be edited only while estimate is draft or change requested.",
          });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can edit this estimate." });
        }

        const quantity = Number(parse.data.quantity);
        const unitPrice = parse.data.unitCost ?? parse.data.rate ?? 0;
        const totalCost = Number((quantity * Number(unitPrice)).toFixed(2));
        const lineId = createId("eli");
        await db.execute(sql`
          INSERT INTO job_estimate_line_items (
            id, estimate_id, line_type, name, description, quantity, unit, rate, unit_price, total_cost, supplier, sku, notes, created_at
          )
          VALUES (
            ${lineId},
            ${estimateId},
            ${parse.data.lineType},
            ${parse.data.name.trim()},
            ${parse.data.description ? parse.data.description.trim() : null},
            ${quantity},
            ${parse.data.unit.trim()},
            ${parse.data.rate ?? null},
            ${parse.data.unitCost ?? null},
            ${totalCost},
            ${parse.data.supplier ? parse.data.supplier.trim() : null},
            ${parse.data.sku ? parse.data.sku.trim() : null},
            ${parse.data.notes ? parse.data.notes.trim() : null},
            now()
          )
        `);

        const totalsRows = await db.execute(sql`
          SELECT
            COALESCE(SUM(CASE WHEN line_type = 'material' THEN total_cost ELSE 0 END), 0) AS subtotal_materials,
            COALESCE(SUM(CASE WHEN line_type = 'labor' THEN total_cost ELSE 0 END), 0) AS subtotal_labor,
            COALESCE(SUM(CASE WHEN line_type NOT IN ('material', 'labor') THEN total_cost ELSE 0 END), 0) AS subtotal_other_lines
          FROM job_estimate_line_items
          WHERE estimate_id = ${estimateId}
        `);
        const totals = ((totalsRows.rows || []) as any[])[0] || {};
        const material = toNumber(totals.subtotal_materials);
        const labor = toNumber(totals.subtotal_labor);
        const otherLines = toNumber(totals.subtotal_other_lines);
        const currentEstimateRows = await db.execute(sql`
          SELECT subtotal_other
          FROM job_estimates
          WHERE id = ${estimateId}
          LIMIT 1
        `);
        const fixedOther = toNumber(((currentEstimateRows.rows || []) as any[])[0]?.subtotal_other);
        const subtotalOther = Number((otherLines + fixedOther).toFixed(2));
        const totalEstimate = Number((material + labor + subtotalOther).toFixed(2));
        await db.execute(sql`
          UPDATE job_estimates
          SET subtotal_materials = ${material},
              subtotal_labor = ${labor},
              subtotal_other = ${subtotalOther},
              total_estimate = ${totalEstimate},
              updated_at = now()
          WHERE id = ${estimateId}
        `);

        await appendDispatchEvent({
          requestId: String(estimate.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "estimate_line_item_added",
          metadata: { estimateId, lineType: parse.data.lineType, lineId },
        });

        return res.status(201).json({
          lineItemId: lineId,
          estimateId,
          totals: {
            subtotalMaterials: material,
            subtotalLabor: labor,
            subtotalOther,
            totalEstimate,
          },
        });
      } catch (error) {
        console.error("Error adding estimate line item:", error);
        return res.status(500).json({
          message: "Failed to add estimate line item",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const estimateId = String(req.params.estimateId || "").trim();
        if (!jobWorkspaceId || !estimateId) {
          return res.status(400).json({ message: "jobWorkspaceId and estimateId are required" });
        }
        const rows = await db.execute(sql`
          SELECT
            e.id,
            e.workspace_id,
            e.request_id,
            e.requester_user_id,
            e.title,
            e.scope_summary,
            e.status,
            e.subtotal_materials,
            e.subtotal_labor,
            e.subtotal_other,
            e.total_estimate,
            e.terms,
            e.expiration_date,
            e.sent_at,
            e.responded_at,
            e.created_at,
            e.updated_at
          FROM job_estimates e
          WHERE e.id = ${estimateId}
            AND e.workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((rows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        const status = normalizeEstimateStatus(estimate.status);
        const requesterUserId = String(estimate.requester_user_id || "").trim();
        const isRequester = requesterUserId === userId;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(sql`
                SELECT c.request_id
                FROM direct_connect_dispatch_candidates c
                WHERE c.request_id = ${String(estimate.request_id)}
                  AND c.eligibility_state = 'eligible'
                  AND (
                    c.contractor_id = ${contractorId}
                    OR c.responder_user_id = ${userId}
                    OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                  )
                LIMIT 1
              `)
            : await db.execute(sql`
                SELECT c.request_id
                FROM direct_connect_dispatch_candidates c
                WHERE c.request_id = ${String(estimate.request_id)}
                  AND c.eligibility_state = 'eligible'
                  AND (
                    c.responder_user_id = ${userId}
                    OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                  )
                LIMIT 1
              `);
          if (!((eligibilityResult.rows || []) as any[])[0]) {
            return res.status(403).json({ message: "Estimate not available for this account." });
          }
        }
        if (isRequester && status === "draft") {
          return res.status(404).json({ message: "Estimate not available" });
        }
        const lineRows = await db.execute(sql`
          SELECT id, line_type, name, description, quantity, unit, rate, unit_price, total_cost, supplier, sku, notes
          FROM job_estimate_line_items
          WHERE estimate_id = ${estimateId}
          ORDER BY created_at ASC
        `);
        return res.status(200).json({
          estimateId: String(estimate.id),
          jobWorkspaceId: String(estimate.workspace_id),
          requestId: String(estimate.request_id || ""),
          title: String(estimate.title || ""),
          scopeSummary: String(estimate.scope_summary || ""),
          status,
          subtotalMaterials: toNumber(estimate.subtotal_materials),
          subtotalLabor: toNumber(estimate.subtotal_labor),
          subtotalOther: toNumber(estimate.subtotal_other),
          totalEstimate: toNumber(estimate.total_estimate),
          terms: estimate.terms ? String(estimate.terms) : null,
          expirationDate: estimate.expiration_date || null,
          sentAt: estimate.sent_at || null,
          respondedAt: estimate.responded_at || null,
          createdAt: estimate.created_at || null,
          updatedAt: estimate.updated_at || null,
          lineItems: ((lineRows.rows || []) as any[]).map((item: any) => ({
            id: String(item.id),
            lineType: String(item.line_type || "other"),
            name: String(item.name || ""),
            description: item.description ? String(item.description) : null,
            quantity: Number(item.quantity || 0),
            unit: item.unit ? String(item.unit) : null,
            rate: item.rate === null || item.rate === undefined ? null : Number(item.rate),
            unitCost:
              item.unit_price === null || item.unit_price === undefined
                ? null
                : Number(item.unit_price),
            totalCost: Number(item.total_cost || 0),
            supplier: item.supplier ? String(item.supplier) : null,
            sku: item.sku ? String(item.sku) : null,
            notes: item.notes ? String(item.notes) : null,
          })),
        });
      } catch (error) {
        console.error("Error fetching estimate:", error);
        return res
          .status(500)
          .json({ message: "Failed to load estimate", requestId: (req as any).requestId || null });
      }
    }
  );

  app.patch(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const estimateId = String(req.params.estimateId || "").trim();
        const parse = estimateUpdateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid estimate update payload", issues: parse.error.flatten() });
        }
        const estimateRows = await db.execute(sql`
          SELECT id, request_id, status
          FROM job_estimates
          WHERE id = ${estimateId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((estimateRows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        const status = normalizeEstimateStatus(estimate.status);
        if (!["draft", "change_requested"].includes(status)) {
          return res
            .status(409)
            .json({ message: "Only draft or change-requested estimates can be revised." });
        }
        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can revise this estimate." });
        }
        const payload = parse.data;
        await db.execute(sql`
          UPDATE job_estimates
          SET
            title = COALESCE(${payload.title ? payload.title.trim() : null}, title),
            scope_summary = COALESCE(${payload.scopeSummary ? payload.scopeSummary.trim() : null}, scope_summary),
            terms = COALESCE(${payload.terms ? payload.terms.trim() : null}, terms),
            expiration_date = COALESCE(${payload.expirationDate ? new Date(payload.expirationDate).toISOString() : null}, expiration_date),
            status = COALESCE(${payload.status ?? null}, status),
            updated_at = now()
          WHERE id = ${estimateId}
        `);
        const updateEventType = payload.status === "void" ? "estimate_voided" : "estimate_started";
        await appendDispatchEvent({
          requestId: String(estimate.request_id || ""),
          actorType: "contractor",
          actorId: userId,
          eventType: updateEventType,
          metadata: { estimateId, revised: true },
        });
        return res.status(200).json({ ok: true, estimateId });
      } catch (error) {
        console.error("Error updating estimate:", error);
        return res.status(500).json({
          message: "Failed to update estimate",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/send",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const estimateId = String(req.params.estimateId || "").trim();
        const parse = estimateSendSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid estimate send payload", issues: parse.error.flatten() });
        }
        const rows = await db.execute(sql`
          SELECT id, request_id, status
          FROM job_estimates
          WHERE id = ${estimateId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((rows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        const status = normalizeEstimateStatus(estimate.status);
        if (!["draft", "change_requested"].includes(status)) {
          return res.status(409).json({ message: "Only draft or revised estimates can be sent." });
        }
        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can send this estimate." });
        }
        await db.execute(sql`
          UPDATE job_estimates
          SET status = 'sent', sent_at = now(), updated_at = now()
          WHERE id = ${estimateId}
        `);
        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'estimate', status = 'estimate_sent', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(estimate.request_id || ""),
          actorType: "contractor",
          actorId: userId,
          eventType: "estimate_sent",
          metadata: { estimateId, note: parse.data.note ? parse.data.note.trim() : null },
        });
        await appendHomeIdTimelineEventFromDirectConnect({
          requestId: String(estimate.request_id || ""),
          eventType: "direct_connect_estimate_sent",
          title: "Estimate sent",
          summary: "A contractor sent an estimate for this request.",
        });
        return res.status(200).json({ ok: true, estimateId, status: "sent" });
      } catch (error) {
        console.error("Error sending estimate:", error);
        return res
          .status(500)
          .json({ message: "Failed to send estimate", requestId: (req as any).requestId || null });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const estimateId = String(req.params.estimateId || "").trim();
        const parse = estimateRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid estimate response payload", issues: parse.error.flatten() });
        }
        const rows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, status
          FROM job_estimates
          WHERE id = ${estimateId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((rows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        if (String(estimate.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this estimate." });
        }
        const status = normalizeEstimateStatus(estimate.status);
        if (status !== "sent") {
          return res.status(409).json({ message: "Only sent estimates can be responded to." });
        }

        let nextStatus: "accepted" | "change_requested" | "declined" = "declined";
        let eventType: "estimate_accepted" | "estimate_change_requested" | "estimate_declined" =
          "estimate_declined";
        let workspaceStage: "acceptance" | "estimate" = "estimate";
        let workspaceStatus = "estimate_declined";
        if (parse.data.decision === "accept") {
          nextStatus = "accepted";
          eventType = "estimate_accepted";
          workspaceStage = "acceptance";
          workspaceStatus = "estimate_accepted";
        } else if (parse.data.decision === "request_changes") {
          nextStatus = "change_requested";
          eventType = "estimate_change_requested";
          workspaceStage = "estimate";
          workspaceStatus = "estimate_change_requested";
        }

        await db.execute(sql`
          UPDATE job_estimates
          SET status = ${nextStatus}, responded_at = now(), updated_at = now()
          WHERE id = ${estimateId}
        `);
        if (nextStatus === "accepted") {
          await db.execute(sql`
            INSERT INTO job_acceptances (id, workspace_id, estimate_id, accepted_by, accepted_at, note)
            VALUES (${createId("acc")}, ${jobWorkspaceId}, ${estimateId}, ${userId}, now(), ${parse.data.note ? parse.data.note.trim() : null})
          `);
        }
        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = ${workspaceStage}, status = ${workspaceStatus}, updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(estimate.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { estimateId, note: parse.data.note ? parse.data.note.trim() : null },
        });
        if (eventType === "estimate_accepted") {
          await appendHomeIdTimelineEventFromDirectConnect({
            requestId: String(estimate.request_id || ""),
            eventType: "direct_connect_estimate_accepted",
            title: "Estimate accepted",
            summary: "The request owner accepted an estimate.",
          });
        }
        return res.status(200).json({ ok: true, estimateId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to estimate:", error);
        return res.status(500).json({
          message: "Failed to respond to estimate",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/payment-requests",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });
        const parse = paymentRequestCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid payment request payload", issues: parse.error.flatten() });
        }

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id, active_stage
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const estimateRows = await db.execute(sql`
          SELECT id, status
          FROM job_estimates
          WHERE id = ${parse.data.estimateId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((estimateRows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        if (normalizeEstimateStatus(estimate.status) !== "accepted") {
          return res
            .status(409)
            .json({ message: "Payment requests require an accepted estimate." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can request deposit or prepayment." });
        }

        const paymentRequestId = createId("payreq");
        await db.execute(sql`
          INSERT INTO job_payment_requests (
            id, workspace_id, request_id, estimate_id, requester_user_id, business_id, contractor_id,
            payment_type, amount, currency, description, due_date, status, note, created_by, sent_at, created_at, updated_at
          )
          VALUES (
            ${paymentRequestId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${String(parse.data.estimateId)},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${parse.data.type},
            ${parse.data.amount},
            'USD',
            ${parse.data.description.trim()},
            ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null},
            'sent',
            ${parse.data.note ? parse.data.note.trim() : null},
            ${userId},
            now(),
            now(),
            now()
          )
        `);

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'deposit', status = 'deposit_requested', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);

        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "deposit_requested",
          metadata: { paymentRequestId, type: parse.data.type, amount: parse.data.amount },
        });

        return res.status(201).json({
          paymentRequestId,
          jobWorkspaceId,
          status: "sent",
        });
      } catch (error) {
        console.error("Error creating payment request:", error);
        return res.status(500).json({
          message: "Failed to create payment request",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/payment-requests/:paymentRequestId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const paymentRequestId = String(req.params.paymentRequestId || "").trim();
        if (!jobWorkspaceId || !paymentRequestId) {
          return res
            .status(400)
            .json({ message: "jobWorkspaceId and paymentRequestId are required" });
        }
        const rows = await db.execute(sql`
          SELECT
            id, workspace_id, request_id, requester_user_id, payment_type, amount, currency,
            description, due_date, status, note, sent_at, responded_at, created_at, updated_at
          FROM job_payment_requests
          WHERE id = ${paymentRequestId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const paymentRequest = ((rows.rows || []) as any[])[0] || null;
        if (!paymentRequest) return res.status(404).json({ message: "Payment request not found" });
        const requesterUserId = String(paymentRequest.requester_user_id || "").trim();
        const isRequester = requesterUserId === userId;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(sql`
                SELECT c.request_id
                FROM direct_connect_dispatch_candidates c
                WHERE c.request_id = ${String(paymentRequest.request_id)}
                  AND c.eligibility_state = 'eligible'
                  AND (
                    c.contractor_id = ${contractorId}
                    OR c.responder_user_id = ${userId}
                    OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                  )
                LIMIT 1
              `)
            : await db.execute(sql`
                SELECT c.request_id
                FROM direct_connect_dispatch_candidates c
                WHERE c.request_id = ${String(paymentRequest.request_id)}
                  AND c.eligibility_state = 'eligible'
                  AND (
                    c.responder_user_id = ${userId}
                    OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                  )
                LIMIT 1
              `);
          if (!((eligibilityResult.rows || []) as any[])[0]) {
            return res
              .status(403)
              .json({ message: "Payment request not available for this account." });
          }
        }
        return res.status(200).json({
          paymentRequestId: String(paymentRequest.id),
          jobWorkspaceId: String(paymentRequest.workspace_id),
          requestId: String(paymentRequest.request_id || ""),
          type: String(paymentRequest.payment_type || "other"),
          amount: toNumber(paymentRequest.amount),
          description: String(paymentRequest.description || ""),
          dueDate: paymentRequest.due_date || null,
          status: String(paymentRequest.status || "sent"),
          note: paymentRequest.note ? String(paymentRequest.note) : null,
          sentAt: paymentRequest.sent_at || null,
          respondedAt: paymentRequest.responded_at || null,
        });
      } catch (error) {
        console.error("Error fetching payment request:", error);
        return res.status(500).json({
          message: "Failed to load payment request",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/payment-requests/:paymentRequestId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const paymentRequestId = String(req.params.paymentRequestId || "").trim();
        const parse = paymentRequestRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res.status(400).json({
            message: "Invalid payment request response payload",
            issues: parse.error.flatten(),
          });
        }

        const rows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, status
          FROM job_payment_requests
          WHERE id = ${paymentRequestId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const paymentRequest = ((rows.rows || []) as any[])[0] || null;
        if (!paymentRequest) return res.status(404).json({ message: "Payment request not found" });
        if (String(paymentRequest.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this payment request." });
        }

        let nextStatus: string = "acknowledged";
        let eventType:
          | "deposit_acknowledged"
          | "deposit_paid_outside_platform"
          | "deposit_waived"
          | "payment_request_canceled" = "deposit_acknowledged";
        if (parse.data.decision === "paid_outside_platform") {
          nextStatus = "paid_outside_platform";
          eventType = "deposit_paid_outside_platform";
        } else if (parse.data.decision === "waive") {
          nextStatus = "waived";
          eventType = "deposit_waived";
        } else if (parse.data.decision === "decline") {
          nextStatus = "canceled";
          eventType = "payment_request_canceled";
        }

        await db.execute(sql`
          UPDATE job_payment_requests
          SET status = ${nextStatus}, acknowledged_at = now(), note = COALESCE(${parse.data.note ? parse.data.note.trim() : null}, note), updated_at = now()
          WHERE id = ${paymentRequestId}
        `);
        await appendDispatchEvent({
          requestId: String(paymentRequest.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { paymentRequestId, decision: parse.data.decision },
        });

        return res.status(200).json({ ok: true, paymentRequestId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to payment request:", error);
        return res.status(500).json({
          message: "Failed to respond to payment request",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });
        const parse = scheduleProposalCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid schedule proposal payload", issues: parse.error.flatten() });
        }
        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        if (parse.data.estimateId) {
          const estimateRows = await db.execute(sql`
            SELECT id, status
            FROM job_estimates
            WHERE id = ${parse.data.estimateId}
              AND workspace_id = ${jobWorkspaceId}
            LIMIT 1
          `);
          const estimate = ((estimateRows.rows || []) as any[])[0] || null;
          if (!estimate || normalizeEstimateStatus(estimate.status) !== "accepted") {
            return res
              .status(409)
              .json({ message: "Schedule proposals require an accepted estimate." });
          }
        } else {
          const acceptedEstimateRows = await db.execute(sql`
            SELECT id
            FROM job_estimates
            WHERE workspace_id = ${jobWorkspaceId}
              AND status = 'accepted'
            LIMIT 1
          `);
          if (!((acceptedEstimateRows.rows || []) as any[])[0]) {
            return res
              .status(409)
              .json({ message: "Schedule proposals require an accepted estimate." });
          }
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can propose schedule." });
        }

        const scheduleProposalId = createId("sched");
        await db.execute(sql`
          INSERT INTO job_schedule_proposals (
            id, workspace_id, request_id, estimate_id, requester_user_id, business_id, contractor_id,
            proposed_start, proposed_end, time_window, notes, status, created_by, created_at, updated_at
          )
          VALUES (
            ${scheduleProposalId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${parse.data.estimateId ? parse.data.estimateId : null},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${new Date(parse.data.proposedStart).toISOString()},
            ${parse.data.proposedEnd ? new Date(parse.data.proposedEnd).toISOString() : null},
            ${parse.data.timeWindow ? parse.data.timeWindow.trim() : null},
            ${parse.data.notes ? parse.data.notes.trim() : null},
            'proposed',
            ${userId},
            now(),
            now()
          )
        `);
        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'scheduling', status = 'schedule_proposed', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "schedule_proposed",
          metadata: { scheduleProposalId },
        });
        return res.status(201).json({ scheduleProposalId, status: "proposed", jobWorkspaceId });
      } catch (error) {
        console.error("Error proposing schedule:", error);
        return res.status(500).json({
          message: "Failed to propose schedule",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals/:scheduleProposalId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const scheduleProposalId = String(req.params.scheduleProposalId || "").trim();
        if (!jobWorkspaceId || !scheduleProposalId) {
          return res
            .status(400)
            .json({ message: "jobWorkspaceId and scheduleProposalId are required" });
        }
        const rows = await db.execute(sql`
          SELECT
            id, workspace_id, request_id, requester_user_id, proposed_start, proposed_end,
            time_window, notes, status, responded_at, created_at, updated_at
          FROM job_schedule_proposals
          WHERE id = ${scheduleProposalId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const proposal = ((rows.rows || []) as any[])[0] || null;
        if (!proposal) return res.status(404).json({ message: "Schedule proposal not found" });
        const requesterUserId = String(proposal.requester_user_id || "").trim();
        const isRequester = requesterUserId === userId;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(sql`
                SELECT c.request_id
                FROM direct_connect_dispatch_candidates c
                WHERE c.request_id = ${String(proposal.request_id)}
                  AND c.eligibility_state = 'eligible'
                  AND (
                    c.contractor_id = ${contractorId}
                    OR c.responder_user_id = ${userId}
                    OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                  )
                LIMIT 1
              `)
            : await db.execute(sql`
                SELECT c.request_id
                FROM direct_connect_dispatch_candidates c
                WHERE c.request_id = ${String(proposal.request_id)}
                  AND c.eligibility_state = 'eligible'
                  AND (
                    c.responder_user_id = ${userId}
                    OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                  )
                LIMIT 1
              `);
          if (!((eligibilityResult.rows || []) as any[])[0]) {
            return res
              .status(403)
              .json({ message: "Schedule proposal not available for this account." });
          }
        }
        return res.status(200).json({
          scheduleProposalId: String(proposal.id),
          jobWorkspaceId: String(proposal.workspace_id),
          requestId: String(proposal.request_id || ""),
          proposedStart: proposal.proposed_start || null,
          proposedEnd: proposal.proposed_end || null,
          timeWindow: proposal.time_window ? String(proposal.time_window) : null,
          notes: proposal.notes ? String(proposal.notes) : null,
          status: String(proposal.status || "proposed"),
          respondedAt: proposal.responded_at || null,
          createdAt: proposal.created_at || null,
        });
      } catch (error) {
        console.error("Error fetching schedule proposal:", error);
        return res.status(500).json({
          message: "Failed to load schedule proposal",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals/:scheduleProposalId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const scheduleProposalId = String(req.params.scheduleProposalId || "").trim();
        const parse = scheduleProposalRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid schedule response payload", issues: parse.error.flatten() });
        }
        const rows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, status
          FROM job_schedule_proposals
          WHERE id = ${scheduleProposalId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const proposal = ((rows.rows || []) as any[])[0] || null;
        if (!proposal) return res.status(404).json({ message: "Schedule proposal not found" });
        if (String(proposal.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this schedule proposal." });
        }
        if (String(proposal.status || "proposed") !== "proposed") {
          return res.status(409).json({ message: "Only proposed schedules can be responded to." });
        }
        let nextStatus: "accepted" | "change_requested" | "declined" = "declined";
        let eventType: "schedule_accepted" | "schedule_change_requested" | "schedule_declined" =
          "schedule_declined";
        let workspaceStatus = "schedule_declined";
        if (parse.data.decision === "accept") {
          nextStatus = "accepted";
          eventType = "schedule_accepted";
          workspaceStatus = "job_scheduled";
        } else if (parse.data.decision === "request_changes") {
          nextStatus = "change_requested";
          eventType = "schedule_change_requested";
          workspaceStatus = "schedule_change_requested";
        }
        await db.execute(sql`
          UPDATE job_schedule_proposals
          SET status = ${nextStatus}, notes = COALESCE(${parse.data.note ? parse.data.note.trim() : null}, notes), responded_at = now(), updated_at = now()
          WHERE id = ${scheduleProposalId}
        `);
        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'scheduling', status = ${workspaceStatus}, updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(proposal.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { scheduleProposalId, decision: parse.data.decision },
        });
        if (eventType === "schedule_accepted") {
          await appendDispatchEvent({
            requestId: String(proposal.request_id || ""),
            actorType: "system",
            actorId: null,
            eventType: "job_scheduled",
            metadata: { scheduleProposalId },
          });
          await appendHomeIdTimelineEventFromDirectConnect({
            requestId: String(proposal.request_id || ""),
            eventType: "direct_connect_scheduled",
            title: "Job scheduled",
            summary: "A schedule proposal was accepted for this request.",
          });
        }
        return res.status(200).json({ ok: true, scheduleProposalId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to schedule proposal:", error);
        return res.status(500).json({
          message: "Failed to respond to schedule proposal",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/start-work",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const acceptedEstimateRows = await db.execute(sql`
          SELECT id
          FROM job_estimates
          WHERE workspace_id = ${jobWorkspaceId}
            AND status = 'accepted'
          LIMIT 1
        `);
        if (!((acceptedEstimateRows.rows || []) as any[])[0]) {
          return res.status(409).json({ message: "Work start requires an accepted estimate." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res.status(403).json({ message: "Only the eligible business can start work." });
        }

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'in_progress', status = 'in_progress', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "work_started",
          metadata: { jobWorkspaceId },
        });
        await appendHomeIdTimelineEventFromDirectConnect({
          requestId: String(workspace.request_id),
          eventType: "direct_connect_work_started",
          title: "Work started",
          summary: "A contractor started work for this request.",
        });
        return res.status(200).json({ ok: true, jobWorkspaceId, status: "in_progress" });
      } catch (error) {
        console.error("Error starting work:", error);
        return res
          .status(500)
          .json({ message: "Failed to start work", requestId: (req as any).requestId || null });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/checkpoints",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = checkpointCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid checkpoint payload", issues: parse.error.flatten() });
        }
        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const acceptedEstimateRows = await db.execute(sql`
          SELECT id
          FROM job_estimates
          WHERE workspace_id = ${jobWorkspaceId}
            AND status = 'accepted'
          LIMIT 1
        `);
        if (!((acceptedEstimateRows.rows || []) as any[])[0]) {
          return res.status(409).json({ message: "Checkpoints require an accepted estimate." });
        }
        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can create checkpoints." });
        }

        const checkpointId = createId("chk");
        const checkpointStatus = parse.data.status || "planned";
        await db.execute(sql`
          INSERT INTO job_checkpoints (
            id, workspace_id, request_id, requester_user_id, business_id, contractor_id,
            title, description, status, due_date, created_by, created_at, updated_at
          )
          VALUES (
            ${checkpointId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${parse.data.title.trim()},
            ${parse.data.description ? parse.data.description.trim() : null},
            ${checkpointStatus},
            ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null},
            ${userId},
            now(),
            now()
          )
        `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "checkpoint_created",
          metadata: { checkpointId, status: checkpointStatus },
        });
        return res.status(201).json({ checkpointId, status: checkpointStatus, jobWorkspaceId });
      } catch (error) {
        console.error("Error creating checkpoint:", error);
        return res.status(500).json({
          message: "Failed to create checkpoint",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/checkpoints",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });

        const workspaceRows = await db.execute(
          sql`SELECT id, request_id, requester_user_id FROM direct_connect_job_workspaces WHERE id = ${jobWorkspaceId} LIMIT 1`
        );
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const isRequester = String(workspace.requester_user_id || "") === userId;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              );
          if (!((eligibilityResult.rows || []) as any[])[0]) {
            return res.status(403).json({ message: "Checkpoints not available for this account." });
          }
        }

        const rows = await db.execute(sql`
          SELECT id, title, description, status, due_date, requester_responded_at, created_at, updated_at
          FROM job_checkpoints
          WHERE workspace_id = ${jobWorkspaceId}
          ORDER BY created_at ASC
        `);
        return res.status(200).json({
          jobWorkspaceId,
          checkpoints: ((rows.rows || []) as any[]).map((row) => ({
            checkpointId: String(row.id),
            title: String(row.title || ""),
            description: row.description ? String(row.description) : null,
            status: String(row.status || "planned"),
            dueDate: row.due_date || null,
            respondedAt: row.requester_responded_at || null,
            createdAt: row.created_at || null,
          })),
        });
      } catch (error) {
        console.error("Error listing checkpoints:", error);
        return res.status(500).json({
          message: "Failed to load checkpoints",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.patch(
    "/api/direct-connect/jobs/:jobWorkspaceId/checkpoints/:checkpointId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const checkpointId = String(req.params.checkpointId || "").trim();
        const parse = checkpointUpdateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid checkpoint update payload", issues: parse.error.flatten() });
        }
        const workspaceRows = await db.execute(sql`
          SELECT id, request_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const checkpointRows = await db.execute(sql`
          SELECT id, status
          FROM job_checkpoints
          WHERE id = ${checkpointId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const checkpoint = ((checkpointRows.rows || []) as any[])[0] || null;
        if (!checkpoint) return res.status(404).json({ message: "Checkpoint not found" });

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can update checkpoints." });
        }

        await db.execute(sql`
          UPDATE job_checkpoints
          SET
            title = COALESCE(${parse.data.title ? parse.data.title.trim() : null}, title),
            description = COALESCE(${parse.data.description ? parse.data.description.trim() : null}, description),
            due_date = CASE
              WHEN ${parse.data.dueDate === null} THEN NULL
              WHEN ${typeof parse.data.dueDate === "string"} THEN ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null}::timestamptz
              ELSE due_date
            END,
            status = COALESCE(${parse.data.status ? parse.data.status : null}, status),
            completed_at = CASE WHEN ${parse.data.status === "completed"} THEN now() ELSE completed_at END,
            updated_at = now()
          WHERE id = ${checkpointId}
        `);

        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "checkpoint_updated",
          metadata: { checkpointId, status: parse.data.status || String(checkpoint.status || "") },
        });
        if (parse.data.status === "completed") {
          await appendDispatchEvent({
            requestId: String(workspace.request_id),
            actorType: "contractor",
            actorId: userId,
            eventType: "checkpoint_completed",
            metadata: { checkpointId },
          });
        }
        return res.status(200).json({ ok: true, checkpointId });
      } catch (error) {
        console.error("Error updating checkpoint:", error);
        return res.status(500).json({
          message: "Failed to update checkpoint",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/checkpoints/:checkpointId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const checkpointId = String(req.params.checkpointId || "").trim();
        const parse = checkpointRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res.status(400).json({
            message: "Invalid checkpoint response payload",
            issues: parse.error.flatten(),
          });
        }
        const rows = await db.execute(sql`
          SELECT c.id, c.request_id, c.requester_user_id
          FROM job_checkpoints c
          WHERE c.id = ${checkpointId}
            AND c.workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const checkpoint = ((rows.rows || []) as any[])[0] || null;
        if (!checkpoint) return res.status(404).json({ message: "Checkpoint not found" });
        if (String(checkpoint.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this checkpoint." });
        }

        const nextStatus = parse.data.decision === "approve" ? "approved" : "issue_reported";
        const eventType =
          parse.data.decision === "approve" ? "checkpoint_approved" : "checkpoint_issue_reported";
        await db.execute(sql`
          UPDATE job_checkpoints
          SET status = ${nextStatus}, requester_responded_at = now(), updated_at = now()
          WHERE id = ${checkpointId}
        `);
        await appendDispatchEvent({
          requestId: String(checkpoint.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { checkpointId, note: parse.data.note ? parse.data.note.trim() : null },
        });
        return res.status(200).json({ ok: true, checkpointId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to checkpoint:", error);
        return res.status(500).json({
          message: "Failed to respond to checkpoint",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/change-orders",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = changeOrderCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid change order payload", issues: parse.error.flatten() });
        }
        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const acceptedEstimateRows = await db.execute(sql`
          SELECT id
          FROM job_estimates
          WHERE workspace_id = ${jobWorkspaceId}
            AND status = 'accepted'
          LIMIT 1
        `);
        if (!((acceptedEstimateRows.rows || []) as any[])[0]) {
          return res.status(409).json({ message: "Change orders require an accepted estimate." });
        }
        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can create change orders." });
        }

        const materialDelta = parse.data.materialDelta ?? 0;
        const laborDelta = parse.data.laborDelta ?? 0;
        const otherDelta = parse.data.otherDelta ?? 0;
        const totalDelta = materialDelta + laborDelta + otherDelta;
        const changeOrderId = createId("chg");
        await db.execute(sql`
          INSERT INTO job_change_orders (
            id, workspace_id, request_id, requester_user_id, business_id, contractor_id,
            title, reason, scope_change_summary, material_delta, labor_delta, other_delta, total_delta,
            timeline_delta_days, status, created_by, sent_at, created_at, updated_at
          )
          VALUES (
            ${changeOrderId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${parse.data.title.trim()},
            ${parse.data.reason ? parse.data.reason.trim() : null},
            ${parse.data.scopeChangeSummary.trim()},
            ${materialDelta},
            ${laborDelta},
            ${otherDelta},
            ${totalDelta},
            ${parse.data.timelineDeltaDays ?? null},
            'sent',
            ${userId},
            now(),
            now(),
            now()
          )
        `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "change_order_created",
          metadata: { changeOrderId, totalDelta },
        });
        await appendHomeIdTimelineEventFromDirectConnect({
          requestId: String(workspace.request_id),
          eventType: "direct_connect_change_order_created",
          title: "Change order created",
          summary: "A change order was created for this request.",
        });
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "change_order_sent",
          metadata: {
            changeOrderId,
            totalDelta,
            note: parse.data.note ? parse.data.note.trim() : null,
          },
        });
        return res.status(201).json({ changeOrderId, status: "sent", totalDelta, jobWorkspaceId });
      } catch (error) {
        console.error("Error creating change order:", error);
        return res.status(500).json({
          message: "Failed to create change order",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/change-orders",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });

        const workspaceRows = await db.execute(
          sql`SELECT id, request_id, requester_user_id FROM direct_connect_job_workspaces WHERE id = ${jobWorkspaceId} LIMIT 1`
        );
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const isRequester = String(workspace.requester_user_id || "") === userId;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              );
          if (!((eligibilityResult.rows || []) as any[])[0]) {
            return res
              .status(403)
              .json({ message: "Change orders not available for this account." });
          }
        }

        const rows = await db.execute(sql`
          SELECT id, title, reason, scope_change_summary, total_delta, timeline_delta_days, status, created_at, responded_at
          FROM job_change_orders
          WHERE workspace_id = ${jobWorkspaceId}
          ORDER BY created_at ASC
        `);
        return res.status(200).json({
          jobWorkspaceId,
          changeOrders: ((rows.rows || []) as any[]).map((row) => ({
            changeOrderId: String(row.id),
            title: String(row.title || ""),
            reason: row.reason ? String(row.reason) : null,
            scopeChangeSummary: String(row.scope_change_summary || ""),
            totalDelta: toNumber(row.total_delta),
            timelineDeltaDays:
              row.timeline_delta_days === null || row.timeline_delta_days === undefined
                ? null
                : Number(row.timeline_delta_days),
            status: String(row.status || "sent"),
            createdAt: row.created_at || null,
            respondedAt: row.responded_at || null,
          })),
        });
      } catch (error) {
        console.error("Error listing change orders:", error);
        return res.status(500).json({
          message: "Failed to load change orders",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/change-orders/:changeOrderId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const changeOrderId = String(req.params.changeOrderId || "").trim();

        const rows = await db.execute(sql`
          SELECT c.*, w.requester_user_id
          FROM job_change_orders c
          JOIN direct_connect_job_workspaces w ON w.id = c.workspace_id
          WHERE c.id = ${changeOrderId}
            AND c.workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const changeOrder = ((rows.rows || []) as any[])[0] || null;
        if (!changeOrder) return res.status(404).json({ message: "Change order not found" });

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const isRequester = String(changeOrder.requester_user_id || "") === userId;
        const isEligibleBusiness = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(changeOrder.request_id || "")}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(changeOrder.request_id || "")}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!isRequester && !((isEligibleBusiness.rows || []) as any[])[0]) {
          return res.status(403).json({ message: "Not allowed to view this change order." });
        }

        return res.status(200).json({
          id: String(changeOrder.id),
          jobWorkspaceId: String(changeOrder.workspace_id),
          requestId: String(changeOrder.request_id || ""),
          title: String(changeOrder.title || ""),
          reason: changeOrder.reason ? String(changeOrder.reason) : null,
          scopeChangeSummary: String(changeOrder.scope_change_summary || ""),
          materialDelta: Number(changeOrder.material_delta || 0),
          laborDelta: Number(changeOrder.labor_delta || 0),
          otherDelta: Number(changeOrder.other_delta || 0),
          totalDelta: Number(changeOrder.total_delta || 0),
          timelineDeltaDays:
            changeOrder.timeline_delta_days === null ||
            changeOrder.timeline_delta_days === undefined
              ? null
              : Number(changeOrder.timeline_delta_days),
          status: String(changeOrder.status || "draft"),
          sentAt: changeOrder.sent_at || null,
          respondedAt: changeOrder.responded_at || null,
          createdAt: changeOrder.created_at || null,
          updatedAt: changeOrder.updated_at || null,
        });
      } catch (error) {
        console.error("Error loading change order:", error);
        return res.status(500).json({
          message: "Failed to load change order",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/change-orders/:changeOrderId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const changeOrderId = String(req.params.changeOrderId || "").trim();
        const parse = changeOrderRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res.status(400).json({
            message: "Invalid change order response payload",
            issues: parse.error.flatten(),
          });
        }
        const rows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, status
          FROM job_change_orders
          WHERE id = ${changeOrderId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const changeOrder = ((rows.rows || []) as any[])[0] || null;
        if (!changeOrder) return res.status(404).json({ message: "Change order not found" });
        if (String(changeOrder.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this change order." });
        }
        if (String(changeOrder.status || "sent") !== "sent") {
          return res.status(409).json({ message: "Only sent change orders can be responded to." });
        }

        let nextStatus: "approved" | "declined" | "change_requested" = "declined";
        let eventType:
          | "change_order_approved"
          | "change_order_declined"
          | "change_order_change_requested" = "change_order_declined";
        if (parse.data.decision === "approve") {
          nextStatus = "approved";
          eventType = "change_order_approved";
        } else if (parse.data.decision === "request_changes") {
          nextStatus = "change_requested";
          eventType = "change_order_change_requested";
        }

        await db.execute(sql`
          UPDATE job_change_orders
          SET status = ${nextStatus}, responded_at = now(), updated_at = now()
          WHERE id = ${changeOrderId}
        `);
        await appendDispatchEvent({
          requestId: String(changeOrder.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { changeOrderId, note: parse.data.note ? parse.data.note.trim() : null },
        });
        return res.status(200).json({ ok: true, changeOrderId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to change order:", error);
        return res.status(500).json({
          message: "Failed to respond to change order",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/ready-for-punchout",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const acceptedEstimateRows = await db.execute(sql`
          SELECT id FROM job_estimates WHERE workspace_id = ${jobWorkspaceId} AND status = 'accepted' LIMIT 1
        `);
        if (!((acceptedEstimateRows.rows || []) as any[])[0]) {
          return res.status(409).json({ message: "Punchout requires an accepted estimate." });
        }
        const startedRows = await db.execute(sql`
          SELECT id FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
            AND status IN ('in_progress', 'schedule_proposed', 'schedule_change_requested', 'job_scheduled', 'punchout')
          LIMIT 1
        `);
        if (!((startedRows.rows || []) as any[])[0]) {
          return res.status(409).json({ message: "Punchout requires work to be started." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can start punchout." });
        }

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'punch_list', status = 'punchout', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "punch_list_started",
          metadata: { jobWorkspaceId },
        });
        return res.status(200).json({ ok: true, jobWorkspaceId, status: "punchout" });
      } catch (error) {
        console.error("Error marking ready for punchout:", error);
        return res.status(500).json({
          message: "Failed to mark ready for punchout",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = punchItemCreateSchema.safeParse(req.body ?? {});
        if (!parse.success)
          return res
            .status(400)
            .json({ message: "Invalid punch item payload", issues: parse.error.flatten() });

        const workspaceRows = await db.execute(
          sql`SELECT id, request_id, requester_user_id, business_id, contractor_id FROM direct_connect_job_workspaces WHERE id = ${jobWorkspaceId} LIMIT 1`
        );
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const acceptedEstimateRows = await db.execute(
          sql`SELECT id FROM job_estimates WHERE workspace_id = ${jobWorkspaceId} AND status = 'accepted' LIMIT 1`
        );
        if (!((acceptedEstimateRows.rows || []) as any[])[0])
          return res.status(409).json({ message: "Punch list requires an accepted estimate." });

        const isRequester = String(workspace.requester_user_id || "") === userId;
        let canBusinessWrite = false;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              );
          canBusinessWrite = Boolean(((eligibilityResult.rows || []) as any[])[0]);
        }
        if (!isRequester && !canBusinessWrite)
          return res.status(403).json({ message: "Not allowed to create punch list items." });

        const punchItemId = createId("punch");
        await db.execute(sql`
        INSERT INTO job_punch_list_items (
          id, workspace_id, request_id, requester_user_id, business_id, contractor_id, title, description, status, created_by, assigned_to, due_date, created_at, updated_at
        ) VALUES (
          ${punchItemId}, ${jobWorkspaceId}, ${String(workspace.request_id)}, ${String(workspace.requester_user_id || "")},
          ${workspace.business_id ? String(workspace.business_id) : null}, ${workspace.contractor_id ? String(workspace.contractor_id) : null},
          ${parse.data.title.trim()}, ${parse.data.description ? parse.data.description.trim() : null}, 'open', ${userId},
          ${parse.data.assignedTo ? parse.data.assignedTo.trim() : null}, ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null}, now(), now()
        )
      `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: isRequester ? "requester" : "contractor",
          actorId: userId,
          eventType: "punch_item_created",
          metadata: { punchItemId },
        });
        return res.status(201).json({ punchItemId, status: "open", jobWorkspaceId });
      } catch (error) {
        console.error("Error creating punch list item:", error);
        return res.status(500).json({
          message: "Failed to create punch list item",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });

        const workspaceRows = await db.execute(
          sql`SELECT id, request_id, requester_user_id FROM direct_connect_job_workspaces WHERE id = ${jobWorkspaceId} LIMIT 1`
        );
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const isRequester = String(workspace.requester_user_id || "") === userId;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              );
          if (!((eligibilityResult.rows || []) as any[])[0]) {
            return res.status(403).json({ message: "Punch list not available for this account." });
          }
        }

        const rows = await db.execute(sql`
          SELECT id, title, description, status, assigned_to, due_date, created_by, created_at, updated_at
          FROM job_punch_list_items
          WHERE workspace_id = ${jobWorkspaceId}
          ORDER BY created_at ASC
        `);
        return res.status(200).json({
          jobWorkspaceId,
          punchListItems: ((rows.rows || []) as any[]).map((row) => ({
            punchItemId: String(row.id),
            title: String(row.title || ""),
            description: row.description ? String(row.description) : null,
            status: String(row.status || "open"),
            assignedTo: row.assigned_to ? String(row.assigned_to) : null,
            dueDate: row.due_date || null,
            createdByViewer: String(row.created_by || "") === userId,
            createdAt: row.created_at || null,
          })),
        });
      } catch (error) {
        console.error("Error listing punch list items:", error);
        return res.status(500).json({
          message: "Failed to load punch list items",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.patch(
    "/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items/:punchItemId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const punchItemId = String(req.params.punchItemId || "").trim();
        const parse = punchItemUpdateSchema.safeParse(req.body ?? {});
        if (!parse.success)
          return res
            .status(400)
            .json({ message: "Invalid punch item update payload", issues: parse.error.flatten() });

        const rows = await db.execute(sql`
        SELECT p.id, p.request_id, p.requester_user_id, p.status
        FROM job_punch_list_items p
        WHERE p.id = ${punchItemId} AND p.workspace_id = ${jobWorkspaceId}
        LIMIT 1
      `);
        const item = ((rows.rows || []) as any[])[0] || null;
        if (!item) return res.status(404).json({ message: "Punch list item not found" });

        const workspaceRows = await db.execute(
          sql`SELECT request_id FROM direct_connect_job_workspaces WHERE id = ${jobWorkspaceId} LIMIT 1`
        );
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            )
          : await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            );
        if (!((eligibilityResult.rows || []) as any[])[0])
          return res
            .status(403)
            .json({ message: "Only the eligible business can update punch list items." });

        await db.execute(sql`
        UPDATE job_punch_list_items
        SET
          title = COALESCE(${parse.data.title ? parse.data.title.trim() : null}, title),
          description = COALESCE(${parse.data.description ? parse.data.description.trim() : null}, description),
          assigned_to = CASE WHEN ${parse.data.assignedTo === null} THEN NULL WHEN ${typeof parse.data.assignedTo === "string"} THEN ${parse.data.assignedTo ? parse.data.assignedTo.trim() : null} ELSE assigned_to END,
          due_date = CASE WHEN ${parse.data.dueDate === null} THEN NULL WHEN ${typeof parse.data.dueDate === "string"} THEN ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null}::timestamptz ELSE due_date END,
          status = COALESCE(${parse.data.status ? parse.data.status : null}, status),
          resolved_at = CASE WHEN ${parse.data.status === "resolved"} THEN now() ELSE resolved_at END,
          updated_at = now()
        WHERE id = ${punchItemId}
      `);

        let eventType: "punch_item_acknowledged" | "punch_item_started" | "punch_item_resolved" =
          "punch_item_acknowledged";
        if (parse.data.status === "in_progress") eventType = "punch_item_started";
        if (parse.data.status === "resolved") eventType = "punch_item_resolved";
        await appendDispatchEvent({
          requestId: String(item.request_id || ""),
          actorType: "contractor",
          actorId: userId,
          eventType,
          metadata: { punchItemId, status: parse.data.status || String(item.status || "") },
        });
        return res.status(200).json({ ok: true, punchItemId });
      } catch (error) {
        console.error("Error updating punch list item:", error);
        return res.status(500).json({
          message: "Failed to update punch list item",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items/:punchItemId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const punchItemId = String(req.params.punchItemId || "").trim();
        const parse = punchItemRespondSchema.safeParse(req.body ?? {});
        if (!parse.success)
          return res.status(400).json({
            message: "Invalid punch item response payload",
            issues: parse.error.flatten(),
          });
        const rows = await db.execute(
          sql`SELECT id, request_id, requester_user_id, status FROM job_punch_list_items WHERE id = ${punchItemId} AND workspace_id = ${jobWorkspaceId} LIMIT 1`
        );
        const item = ((rows.rows || []) as any[])[0] || null;
        if (!item) return res.status(404).json({ message: "Punch list item not found" });
        if (String(item.requester_user_id || "") !== userId)
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this punch item." });

        let nextStatus: "resolved" | "open" | "waived" = "open";
        let eventType: "punch_item_approved" | "punch_item_rejected" | "punch_item_waived" =
          "punch_item_rejected";
        if (parse.data.decision === "approve_resolved") {
          nextStatus = "resolved";
          eventType = "punch_item_approved";
        } else if (parse.data.decision === "waive_item") {
          nextStatus = "waived";
          eventType = "punch_item_waived";
        }
        await db.execute(
          sql`UPDATE job_punch_list_items SET status = ${nextStatus}, requester_responded_at = now(), updated_at = now() WHERE id = ${punchItemId}`
        );
        await appendDispatchEvent({
          requestId: String(item.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { punchItemId, note: parse.data.note ? parse.data.note.trim() : null },
        });
        return res.status(200).json({ ok: true, punchItemId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to punch list item:", error);
        return res.status(500).json({
          message: "Failed to respond to punch list item",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/completion-request",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = completionRequestCreateSchema.safeParse(req.body ?? {});
        if (!parse.success)
          return res
            .status(400)
            .json({ message: "Invalid completion request payload", issues: parse.error.flatten() });

        const workspaceRows = await db.execute(
          sql`SELECT id, request_id, requester_user_id FROM direct_connect_job_workspaces WHERE id = ${jobWorkspaceId} LIMIT 1`
        );
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const acceptedEstimateRows = await db.execute(
          sql`SELECT id FROM job_estimates WHERE workspace_id = ${jobWorkspaceId} AND status = 'accepted' LIMIT 1`
        );
        if (!((acceptedEstimateRows.rows || []) as any[])[0])
          return res
            .status(409)
            .json({ message: "Completion request requires an accepted estimate." });
        const startedRows = await db.execute(
          sql`SELECT id FROM direct_connect_job_workspaces WHERE id = ${jobWorkspaceId} AND active_stage IN ('in_progress','punch_list','checkpoint','change_order') LIMIT 1`
        );
        if (!((startedRows.rows || []) as any[])[0])
          return res.status(409).json({ message: "Completion request requires started work." });

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            )
          : await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            );
        if (!((eligibilityResult.rows || []) as any[])[0])
          return res
            .status(403)
            .json({ message: "Only the eligible business can request completion." });

        const completionRequestId = createId("complete");
        await db.execute(sql`
        INSERT INTO job_completion_requests (
          id, workspace_id, request_id, requester_user_id, business_id, contractor_id, status, business_notes, requested_at, created_at, updated_at
        ) VALUES (
          ${completionRequestId}, ${jobWorkspaceId}, ${String(workspace.request_id)}, ${String(workspace.requester_user_id || "")},
          null, ${contractorId}, 'requested', ${parse.data.businessNotes ? parse.data.businessNotes.trim() : null}, now(), now(), now()
        )
      `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "completion_requested",
          metadata: { completionRequestId },
        });
        return res.status(201).json({ completionRequestId, status: "requested", jobWorkspaceId });
      } catch (error) {
        console.error("Error requesting completion:", error);
        return res.status(500).json({
          message: "Failed to request completion",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/completion-request/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = completionRequestRespondSchema.safeParse(req.body ?? {});
        if (!parse.success)
          return res.status(400).json({
            message: "Invalid completion response payload",
            issues: parse.error.flatten(),
          });

        const completionRows = await db.execute(sql`
        SELECT id, request_id, requester_user_id, status
        FROM job_completion_requests
        WHERE workspace_id = ${jobWorkspaceId}
        ORDER BY created_at DESC
        LIMIT 1
      `);
        const completionRequest = ((completionRows.rows || []) as any[])[0] || null;
        if (!completionRequest)
          return res.status(404).json({ message: "Completion request not found" });
        if (String(completionRequest.requester_user_id || "") !== userId)
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to completion." });
        const completionStatus = String(completionRequest.status || "requested");
        if (parse.data.decision === "reject") {
          if (completionStatus !== "requested") {
            return res.status(409).json({ message: "Completion request is no longer pending." });
          }
          const rejectionResult = await db.execute(sql`
            UPDATE job_completion_requests
            SET
              status = 'rejected',
              requester_notes = ${parse.data.requesterNotes ? parse.data.requesterNotes.trim() : null},
              responded_at = now(),
              updated_at = now()
            WHERE id = ${String(completionRequest.id)}
              AND status = 'requested'
            RETURNING id
          `);
          if (!((rejectionResult.rows || []) as any[])[0]) {
            return res.status(409).json({ message: "Completion request is no longer pending." });
          }
          await appendDispatchEvent({
            requestId: String(completionRequest.request_id || ""),
            actorType: "requester",
            actorId: userId,
            eventType: "completion_rejected",
            metadata: { completionRequestId: String(completionRequest.id) },
          });
          return res.status(200).json({
            ok: true,
            completionRequestId: String(completionRequest.id),
            status: "rejected",
            idempotencyReplayed: false,
          });
        }

        if (completionStatus !== "requested" && completionStatus !== "confirmed") {
          return res.status(409).json({ message: "Completion request is no longer pending." });
        }
        if (completionStatus === "requested") {
          const unresolvedRows = await db.execute(sql`
            SELECT COUNT(*)::int AS count
            FROM job_punch_list_items
            WHERE workspace_id = ${jobWorkspaceId}
              AND status NOT IN ('resolved', 'waived', 'canceled')
          `);
          const unresolvedCount = Number(((unresolvedRows.rows || []) as any[])[0]?.count || 0);
          if (unresolvedCount > 0) {
            return res.status(409).json({
              message: "Unresolved punch list items block completion.",
              completionBlockedReason: "open_punch_items",
            });
          }
        }

        const completionDecision = await finalizeDirectConnectCompletion({
          requestId: String(completionRequest.request_id || ""),
          actorUserId: userId,
          confirmation: {
            completionRequestId: String(completionRequest.id),
            jobWorkspaceId,
            requesterNotes: parse.data.requesterNotes ? parse.data.requesterNotes.trim() : null,
          },
        });
        if (!completionDecision.ok) {
          return res.status(completionDecision.status).json(completionDecision.body);
        }
        return res.status(200).json({
          ok: true,
          completionRequestId: String(completionRequest.id),
          status: "confirmed",
          idempotencyReplayed: !completionDecision.completedNow,
        });
      } catch (error) {
        console.error("Error responding to completion request:", error);
        return res.status(500).json({
          message: "Failed to respond to completion request",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/invoices",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = invoiceCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid invoice payload", issues: parse.error.flatten() });
        }

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const completionRows = await db.execute(sql`
          SELECT id, status
          FROM job_completion_requests
          WHERE workspace_id = ${jobWorkspaceId}
          ORDER BY created_at DESC
          LIMIT 1
        `);
        const completion = ((completionRows.rows || []) as any[])[0] || null;
        if (String(completion?.status || "") !== "confirmed") {
          return res
            .status(409)
            .json({ message: "Invoice creation requires confirmed completion." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            )
          : await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            );
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can create invoices." });
        }

        const estimateId =
          parse.data.estimateId && parse.data.estimateId.trim().length > 0
            ? parse.data.estimateId.trim()
            : null;

        const invoiceId = createId("inv");
        await db.execute(sql`
          INSERT INTO job_invoices (
            id, workspace_id, request_id, requester_user_id, business_id, contractor_id, estimate_id,
            title, summary, status, subtotal, adjustments, total_due, due_date, terms, created_by, created_at, updated_at
          ) VALUES (
            ${invoiceId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${estimateId},
            ${parse.data.title.trim()},
            ${parse.data.summary.trim()},
            'draft',
            0,
            ${parse.data.adjustments ?? 0},
            ${parse.data.adjustments ?? 0},
            ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null},
            ${parse.data.terms ? parse.data.terms.trim() : null},
            ${userId},
            now(),
            now()
          )
        `);

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'invoicing', status = 'invoice_draft', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);

        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "invoice_started",
          metadata: { invoiceId, jobWorkspaceId },
        });

        return res.status(201).json({ invoiceId, status: "draft", jobWorkspaceId });
      } catch (error) {
        console.error("Error creating invoice:", error);
        return res.status(500).json({
          message: "Failed to create invoice",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const invoiceId = String(req.params.invoiceId || "").trim();

        const rows = await db.execute(sql`
          SELECT id, workspace_id, request_id, requester_user_id, title, summary, status, subtotal, adjustments, total_due, due_date, terms, sent_at, responded_at, created_at, updated_at
          FROM job_invoices
          WHERE id = ${invoiceId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const invoice = ((rows.rows || []) as any[])[0] || null;
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        const status = String(invoice.status || "draft");
        const isRequester = String(invoice.requester_user_id || "") === userId;
        if (isRequester && status === "draft") {
          return res.status(404).json({ message: "Invoice not available" });
        }
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(invoice.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(invoice.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              );
          if (!((eligibilityResult.rows || []) as any[])[0]) {
            return res.status(403).json({ message: "Invoice not available for this account." });
          }
        }

        const lineRows = await db.execute(sql`
          SELECT id, line_type, name, description, quantity, unit, unit_amount, total_amount, source_estimate_line_item_id, source_change_order_id, notes
          FROM job_invoice_line_items
          WHERE invoice_id = ${invoiceId}
          ORDER BY created_at ASC
        `);

        return res.status(200).json({
          invoiceId: String(invoice.id),
          jobWorkspaceId: String(invoice.workspace_id),
          requestId: String(invoice.request_id || ""),
          title: String(invoice.title || ""),
          summary: String(invoice.summary || ""),
          status,
          subtotal: toNumber(invoice.subtotal),
          adjustments: toNumber(invoice.adjustments),
          totalDue: toNumber(invoice.total_due),
          dueDate: invoice.due_date || null,
          terms: invoice.terms ? String(invoice.terms) : null,
          sentAt: invoice.sent_at || null,
          respondedAt: invoice.responded_at || null,
          lineItems: ((lineRows.rows || []) as any[]).map((line) => ({
            id: String(line.id),
            type: String(line.line_type || "other"),
            name: String(line.name || ""),
            description: line.description ? String(line.description) : null,
            quantity: toNumber(line.quantity),
            unit: line.unit ? String(line.unit) : null,
            unitAmount: toNumber(line.unit_amount),
            totalAmount: toNumber(line.total_amount),
            sourceEstimateLineItemId: line.source_estimate_line_item_id
              ? String(line.source_estimate_line_item_id)
              : null,
            sourceChangeOrderId: line.source_change_order_id
              ? String(line.source_change_order_id)
              : null,
            notes: line.notes ? String(line.notes) : null,
          })),
        });
      } catch (error) {
        console.error("Error fetching invoice:", error);
        return res.status(500).json({
          message: "Failed to fetch invoice",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.patch(
    "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const invoiceId = String(req.params.invoiceId || "").trim();
        const parse = invoiceUpdateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid invoice update payload", issues: parse.error.flatten() });
        }

        const invoiceRows = await db.execute(sql`
          SELECT id, workspace_id, request_id, status
          FROM job_invoices
          WHERE id = ${invoiceId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const invoice = ((invoiceRows.rows || []) as any[])[0] || null;
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });
        const status = String(invoice.status || "draft");
        if (!["draft", "disputed"].includes(status)) {
          return res
            .status(409)
            .json({ message: "Invoice can only be edited while draft or disputed." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(invoice.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            )
          : await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(invoice.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            );
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can edit this invoice." });
        }

        await db.execute(sql`
          UPDATE job_invoices
          SET
            title = COALESCE(${parse.data.title ? parse.data.title.trim() : null}, title),
            summary = COALESCE(${parse.data.summary ? parse.data.summary.trim() : null}, summary),
            adjustments = COALESCE(${typeof parse.data.adjustments === "number" ? parse.data.adjustments : null}, adjustments),
            due_date = CASE WHEN ${parse.data.dueDate === null} THEN NULL WHEN ${typeof parse.data.dueDate === "string"} THEN ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null}::timestamptz ELSE due_date END,
            terms = CASE WHEN ${parse.data.terms === null} THEN NULL WHEN ${typeof parse.data.terms === "string"} THEN ${parse.data.terms ? parse.data.terms.trim() : null} ELSE terms END,
            status = COALESCE(${parse.data.status ? parse.data.status : null}, status),
            updated_at = now()
          WHERE id = ${invoiceId}
        `);

        if (Array.isArray(parse.data.lineItems)) {
          await db.execute(sql`DELETE FROM job_invoice_line_items WHERE invoice_id = ${invoiceId}`);
          for (const rawLine of parse.data.lineItems) {
            const quantity = Number(rawLine.quantity ?? 0);
            const unitAmount = Number(rawLine.unitAmount ?? 0);
            const totalAmount = Number((quantity * unitAmount).toFixed(2));
            const lineId = createId("invli");
            await db.execute(sql`
              INSERT INTO job_invoice_line_items (
                id, invoice_id, line_type, name, description, quantity, unit, unit_amount, total_amount,
                source_estimate_line_item_id, source_change_order_id, notes, created_at
              ) VALUES (
                ${lineId},
                ${invoiceId},
                ${rawLine.type},
                ${rawLine.name.trim()},
                ${rawLine.description ? rawLine.description.trim() : null},
                ${quantity},
                ${rawLine.unit ? rawLine.unit.trim() : null},
                ${unitAmount},
                ${totalAmount},
                ${rawLine.sourceEstimateLineItemId ? rawLine.sourceEstimateLineItemId.trim() : null},
                ${rawLine.sourceChangeOrderId ? rawLine.sourceChangeOrderId.trim() : null},
                ${rawLine.notes ? rawLine.notes.trim() : null},
                now()
              )
            `);
            await appendDispatchEvent({
              requestId: String(invoice.request_id || ""),
              actorType: "contractor",
              actorId: userId,
              eventType: "invoice_line_item_added",
              metadata: { invoiceId, lineItemId: lineId, lineType: rawLine.type },
            });
          }
        }

        const totalsRows = await db.execute(sql`
          SELECT COALESCE(SUM(total_amount), 0) AS subtotal
          FROM job_invoice_line_items
          WHERE invoice_id = ${invoiceId}
        `);
        const subtotal = toNumber(((totalsRows.rows || []) as any[])[0]?.subtotal);
        const invoiceMetaRows = await db.execute(
          sql`SELECT adjustments FROM job_invoices WHERE id = ${invoiceId} LIMIT 1`
        );
        const adjustments = toNumber(((invoiceMetaRows.rows || []) as any[])[0]?.adjustments);
        const totalDue = Number((subtotal + adjustments).toFixed(2));
        await db.execute(sql`
          UPDATE job_invoices
          SET subtotal = ${subtotal}, total_due = ${totalDue}, updated_at = now()
          WHERE id = ${invoiceId}
        `);

        return res.status(200).json({ invoiceId, subtotal, adjustments, totalDue });
      } catch (error) {
        console.error("Error updating invoice:", error);
        return res.status(500).json({
          message: "Failed to update invoice",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId/send",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const invoiceId = String(req.params.invoiceId || "").trim();
        const parse = invoiceSendSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid invoice send payload", issues: parse.error.flatten() });
        }

        const invoiceRows = await db.execute(sql`
          SELECT id, workspace_id, request_id, status
          FROM job_invoices
          WHERE id = ${invoiceId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const invoice = ((invoiceRows.rows || []) as any[])[0] || null;
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        const completionRows = await db.execute(sql`
          SELECT id, status
          FROM job_completion_requests
          WHERE workspace_id = ${jobWorkspaceId}
          ORDER BY created_at DESC
          LIMIT 1
        `);
        const completion = ((completionRows.rows || []) as any[])[0] || null;
        if (String(completion?.status || "") !== "confirmed") {
          return res.status(409).json({ message: "Invoice send requires confirmed completion." });
        }

        if (!["draft", "disputed"].includes(String(invoice.status || "draft"))) {
          return res
            .status(409)
            .json({ message: "Invoice can only be sent from draft or disputed." });
        }

        await db.execute(sql`
          UPDATE job_invoices
          SET status = 'sent', sent_at = now(), updated_at = now()
          WHERE id = ${invoiceId}
        `);
        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'invoicing', status = 'invoice_sent', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);

        await appendDispatchEvent({
          requestId: String(invoice.request_id || ""),
          actorType: "contractor",
          actorId: userId,
          eventType: "invoice_sent",
          metadata: { invoiceId, note: parse.data.note ? parse.data.note.trim() : null },
        });

        return res.status(200).json({ ok: true, invoiceId, status: "sent" });
      } catch (error) {
        console.error("Error sending invoice:", error);
        return res.status(500).json({
          message: "Failed to send invoice",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const invoiceId = String(req.params.invoiceId || "").trim();
        const parse = invoiceRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid invoice response payload", issues: parse.error.flatten() });
        }

        const invoiceRows = await db.execute(sql`
          SELECT id, workspace_id, request_id, requester_user_id, status
          FROM job_invoices
          WHERE id = ${invoiceId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const invoice = ((invoiceRows.rows || []) as any[])[0] || null;
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });
        if (String(invoice.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to invoice." });
        }
        if (String(invoice.status || "") !== "sent") {
          return res.status(409).json({ message: "Invoice is not awaiting requester response." });
        }

        let nextStatus = "acknowledged";
        let eventType:
          | "invoice_acknowledged"
          | "invoice_disputed"
          | "invoice_marked_paid_outside_platform" = "invoice_acknowledged";
        if (parse.data.decision === "dispute") {
          nextStatus = "disputed";
          eventType = "invoice_disputed";
        } else if (parse.data.decision === "mark_paid_outside_platform") {
          nextStatus = "marked_paid_outside_platform";
          eventType = "invoice_marked_paid_outside_platform";
        }

        await db.execute(sql`
          UPDATE job_invoices
          SET status = ${nextStatus}, responded_at = now(), updated_at = now()
          WHERE id = ${invoiceId}
        `);
        await appendDispatchEvent({
          requestId: String(invoice.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { invoiceId, note: parse.data.note ? parse.data.note.trim() : null },
        });

        return res.status(200).json({
          ok: true,
          invoiceId,
          status: nextStatus,
          platformPaymentProcessed: false,
        });
      } catch (error) {
        console.error("Error responding to invoice:", error);
        return res.status(500).json({
          message: "Failed to respond to invoice",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/receipts",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = receiptCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid receipt payload", issues: parse.error.flatten() });
        }

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const completionRows = await db.execute(sql`
          SELECT id, status
          FROM job_completion_requests
          WHERE workspace_id = ${jobWorkspaceId}
          ORDER BY created_at DESC
          LIMIT 1
        `);
        const completion = ((completionRows.rows || []) as any[])[0] || null;
        if (String(completion?.status || "") !== "confirmed") {
          return res.status(409).json({ message: "Receipt records require confirmed completion." });
        }

        const isRequester = String(workspace.requester_user_id || "") === userId;
        let isEligibleBusiness = false;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              );
          isEligibleBusiness = Boolean(((eligibilityResult.rows || []) as any[])[0]);
        }
        if (!isRequester && !isEligibleBusiness) {
          return res
            .status(403)
            .json({ message: "Only requester or eligible business can record receipts." });
        }

        const receiptId = createId("rcpt");
        await db.execute(sql`
          INSERT INTO job_receipts (
            id, workspace_id, request_id, invoice_id, requester_user_id, business_id, contractor_id,
            receipt_type, payment_method, amount, status, paid_at, notes, created_by, created_at, updated_at
          ) VALUES (
            ${receiptId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${parse.data.invoiceId ? parse.data.invoiceId.trim() : null},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : null},
            ${parse.data.type},
            ${parse.data.paymentMethod},
            ${parse.data.amount},
            ${parse.data.status ?? "recorded"},
            ${parse.data.paidAt ? new Date(parse.data.paidAt).toISOString() : null},
            ${parse.data.notes ? parse.data.notes.trim() : null},
            ${userId},
            now(),
            now()
          )
        `);

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'receipt', status = 'receipt_recorded', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);

        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: isRequester ? "requester" : "contractor",
          actorId: userId,
          eventType: parse.data.type === "receipt" ? "receipt_uploaded" : "payment_recorded",
          metadata: {
            receiptId,
            invoiceId: parse.data.invoiceId ?? null,
            paymentMethod: parse.data.paymentMethod,
          },
        });

        return res.status(201).json({ receiptId, status: parse.data.status ?? "recorded" });
      } catch (error) {
        console.error("Error creating receipt record:", error);
        return res.status(500).json({
          message: "Failed to create receipt record",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/receipts/:receiptId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const receiptId = String(req.params.receiptId || "").trim();

        const rows = await db.execute(sql`
          SELECT id, workspace_id, request_id, requester_user_id, invoice_id, receipt_type, payment_method, amount, status, paid_at, notes, created_at, updated_at
          FROM job_receipts
          WHERE id = ${receiptId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const receipt = ((rows.rows || []) as any[])[0] || null;
        if (!receipt) return res.status(404).json({ message: "Receipt not found" });

        const isRequester = String(receipt.requester_user_id || "") === userId;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(receipt.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(receipt.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              );
          if (!((eligibilityResult.rows || []) as any[])[0]) {
            return res.status(403).json({ message: "Receipt not available for this account." });
          }
        }

        return res.status(200).json({
          receiptId: String(receipt.id),
          jobWorkspaceId: String(receipt.workspace_id),
          requestId: String(receipt.request_id || ""),
          invoiceId: receipt.invoice_id ? String(receipt.invoice_id) : null,
          type: String(receipt.receipt_type || "receipt"),
          paymentMethod: String(receipt.payment_method || "outside_platform"),
          amount: toNumber(receipt.amount),
          status: String(receipt.status || "recorded"),
          paidAt: receipt.paid_at || null,
          notes: receipt.notes ? String(receipt.notes) : null,
          storesPaymentCredentials: false,
          createdAt: receipt.created_at || null,
          updatedAt: receipt.updated_at || null,
        });
      } catch (error) {
        console.error("Error fetching receipt record:", error);
        return res.status(500).json({
          message: "Failed to fetch receipt record",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );
}
