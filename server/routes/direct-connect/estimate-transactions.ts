import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<any> };
export type EstimateActor = { userId: string; contractorId: string | null; workerId: string | null };
export class EstimateOperationError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
const fail = (status: number, message: string): never => { throw new EstimateOperationError(status, message); };
const first = (result: any) => result.rows?.[0] || null;

/** One row lock serializes additions, edits, sending and customer responses. */
export async function lockEstimate(tx: Executor, workspaceId: string, estimateId: string, readOnly = false) {
  const row = first(await tx.execute(sql`
    SELECT * FROM job_estimates WHERE id=${estimateId} AND workspace_id=${workspaceId}
    ${readOnly ? sql`FOR SHARE` : sql`FOR UPDATE`}
  `));
  if (!row) fail(404, "Estimate not found");
  return row;
}

export async function requireEstimateProvider(tx: Executor, row: any, actor: EstimateActor) {
  if (String(row.requester_user_id || "") === actor.userId) fail(403, "Only the eligible business can modify this estimate.");
  const eligible = first(await tx.execute(sql`
    SELECT c.id FROM direct_connect_dispatch_candidates c
    WHERE c.request_id=${String(row.request_id)} AND c.eligibility_state='eligible'
      AND (c.responder_user_id=${actor.userId}
        OR c.contractor_id=${actor.contractorId}::text
        OR c.worker_id=${actor.workerId}::text)
    LIMIT 1 FOR SHARE
  `));
  if (!eligible) fail(403, "Estimate not available for this account.");
  // A different eligible bidder does not acquire another business's draft.
  if (row.created_by && String(row.created_by) !== actor.userId) fail(403, "Only the estimate author can modify this estimate.");
}

export async function requireReleasedEstimateContact(tx: Executor, requestId: string) {
  const request = first(await tx.execute(sql`
    SELECT contact_gate_state FROM direct_connect_dispatch_requests WHERE id=${requestId} FOR SHARE
  `));
  if (request?.contact_gate_state !== "released") fail(409, "Estimate changes require released contact.");
}

export function estimateMutationId(estimateId: string, actorId: string, key?: string): string {
  if (key === undefined) return "eli_" + randomUUID();
  if (!/^[A-Za-z0-9_.:-]{8,100}$/.test(key)) fail(400, "Invalid Idempotency-Key.");
  return "eli_" + createHash("sha256").update(JSON.stringify([estimateId, actorId, key])).digest("hex").slice(0,48);
}

export async function recordEstimateEvent(tx: Executor, args: {
  estimate: any; actorId: string; eventType: string; metadata?: Record<string, unknown>;
  recipientId?: string | null; recipientRole?: "requester" | "business";
}) {
  const eventId = randomUUID();
  const e = args.estimate;
  const requester = String(e.requester_user_id) === args.actorId;
  const actorType = requester ? "requester" : "contractor";
  const metadata = { estimateId: String(e.id), jobWorkspaceId: String(e.workspace_id), ...args.metadata };
  await tx.execute(sql`
    INSERT INTO direct_connect_dispatch_events(event_id,request_id,actor_type,actor_id,event_type,metadata_json,created_at)
    VALUES(${eventId},${String(e.request_id)},${actorType},${args.actorId},${args.eventType},${JSON.stringify(metadata)}::jsonb,now())
  `);
  if (args.recipientId && args.recipientRole) {
    const title = args.eventType === "estimate_sent" ? "Estimate sent"
      : args.eventType === "estimate_accepted" ? "Estimate accepted"
      : args.eventType === "estimate_change_requested" ? "Estimate changes requested" : "Estimate declined";
    const actionKey = args.recipientRole === "requester" ? "review_estimate" : "view_job_workspace";
    const recipientType = args.recipientRole === "requester" ? "requester" : "contractor";
    await tx.execute(sql`
      INSERT INTO direct_connect_lifecycle_notifications(id,request_id,actor_type,actor_id,recipient_type,recipient_id,event_type,lifecycle_status,message_key,message_text,is_read,created_at)
      VALUES(${randomUUID()},${String(e.request_id)},${actorType},${args.actorId},${recipientType},${args.recipientId},${args.eventType},${args.eventType},${"direct_connect.lifecycle."+args.eventType},${title},false,now())
    `);
    await tx.execute(sql`
      INSERT INTO direct_connect_notifications(id,request_id,job_workspace_id,event_id,recipient_user_id,recipient_role,actor_type,actor_id,notification_type,title,message,action_key,status,priority,metadata_json,created_at)
      VALUES(${randomUUID()},${String(e.request_id)},${String(e.workspace_id)},${eventId},${args.recipientId},${args.recipientRole},${actorType},${args.actorId},${args.eventType},${title},${title},${actionKey},'unread','high',${JSON.stringify(metadata)}::jsonb,now())
    `);
  }
  return eventId;
}

/** Caller owns the transaction and acquired the estimate row lock. */
export async function addEstimateLine(tx: Executor, estimate: any, actor: EstimateActor, input: any, key?: string) {
  await requireEstimateProvider(tx, estimate, actor);
  await requireReleasedEstimateContact(tx, String(estimate.request_id));
  const id = estimateMutationId(String(estimate.id), actor.userId, key);
  const value = {
    lineType: String(input.lineType), name: String(input.name).trim(),
    description: input.description?.trim() || null, quantity: Number(input.quantity), unit: String(input.unit).trim(),
    rate: input.rate ?? null, unitCost: input.unitCost ?? null,
    supplier: input.supplier?.trim() || null, sku: input.sku?.trim() || null, notes: input.notes?.trim() || null,
  };
  if (!Number.isFinite(value.quantity) || value.quantity < 0 || !Number.isFinite(Number(value.unitCost ?? value.rate ?? 0))) fail(400,"Invalid line item amounts.");
  if (key) {
    const previous = first(await tx.execute(sql`SELECT * FROM job_estimate_line_items WHERE id=${id} AND estimate_id=${String(estimate.id)}`));
    if (previous) {
      const saved = { lineType: previous.line_type, name: previous.name, description: previous.description, quantity: Number(previous.quantity), unit: previous.unit,
        rate: previous.rate === null ? null : Number(previous.rate), unitCost: previous.unit_price === null ? null : Number(previous.unit_price),
        supplier: previous.supplier, sku: previous.sku, notes: previous.notes };
      if (JSON.stringify(saved) !== JSON.stringify(value)) fail(409,"Idempotency-Key already identifies a different line item.");
      return { lineItemId: id, estimateId: String(estimate.id), replayed: true, totals: estimateTotals(estimate) };
    }
  }
  if (!["draft","change_requested"].includes(estimate.status)) fail(409,"Line items can be edited only while estimate is draft or change requested.");
  const line = first(await tx.execute(sql`
    INSERT INTO job_estimate_line_items(id,estimate_id,line_type,name,description,quantity,unit,rate,unit_price,total_cost,supplier,sku,notes,created_at)
    VALUES(${id},${String(estimate.id)},${value.lineType},${value.name},${value.description},${value.quantity},${value.unit},${value.rate},${value.unitCost},
      round(${value.quantity}::numeric * ${value.unitCost ?? value.rate ?? 0}::numeric,2),${value.supplier},${value.sku},${value.notes},now())
    RETURNING total_cost
  `));
  // The stored other subtotal includes the starting allowance and previous
  // other lines. Add this line once; never add the accumulated SUM again.
  const otherDelta = ["material","labor"].includes(value.lineType) ? 0 : Number(line.total_cost);
  const updated = first(await tx.execute(sql`
    UPDATE job_estimates SET
      subtotal_materials=(SELECT COALESCE(SUM(total_cost),0) FROM job_estimate_line_items WHERE estimate_id=${String(estimate.id)} AND line_type='material'),
      subtotal_labor=(SELECT COALESCE(SUM(total_cost),0) FROM job_estimate_line_items WHERE estimate_id=${String(estimate.id)} AND line_type='labor'),
      subtotal_other=subtotal_other+${otherDelta}::numeric, updated_at=now()
    WHERE id=${String(estimate.id)} RETURNING *
  `));
  const total = first(await tx.execute(sql`
    UPDATE job_estimates SET total_estimate=round(subtotal_materials+subtotal_labor+subtotal_other,2)
    WHERE id=${String(estimate.id)} RETURNING *
  `));
  await recordEstimateEvent(tx,{estimate:updated,actorId:actor.userId,eventType:"estimate_line_item_added",metadata:{lineId:id,lineType:value.lineType}});
  return { lineItemId:id,estimateId:String(estimate.id),replayed:false,totals:estimateTotals(total) };
}

export function estimateTotals(row: any) {
  return { subtotalMaterials:Number(row.subtotal_materials),subtotalLabor:Number(row.subtotal_labor),subtotalOther:Number(row.subtotal_other),totalEstimate:Number(row.total_estimate) };
}

export async function sendEstimate(tx: Executor, estimate: any, actor: EstimateActor, note?: string | null) {
  await requireEstimateProvider(tx,estimate,actor);
  await requireReleasedEstimateContact(tx,String(estimate.request_id));
  if (estimate.status === "sent") return {ok:true,estimateId:String(estimate.id),status:"sent",replayed:true};
  if (!["draft","change_requested"].includes(estimate.status)) fail(409,"Only draft or revised estimates can be sent.");
  const lines = first(await tx.execute(sql`SELECT COUNT(*)::int AS count FROM job_estimate_line_items WHERE estimate_id=${String(estimate.id)}`));
  if (!lines.count) fail(409,"Add at least one item before sending this estimate.");
  await tx.execute(sql`UPDATE job_estimates SET status='sent',sent_at=now(),updated_at=now() WHERE id=${String(estimate.id)}`);
  await tx.execute(sql`UPDATE direct_connect_job_workspaces SET active_stage='estimate',status='estimate_sent',updated_at=now() WHERE id=${String(estimate.workspace_id)}`);
  await recordEstimateEvent(tx,{estimate,actorId:actor.userId,eventType:"estimate_sent",metadata:{note:note?.trim()||null},recipientId:String(estimate.requester_user_id),recipientRole:"requester"});
  return {ok:true,estimateId:String(estimate.id),status:"sent",replayed:false};
}

export async function respondToEstimate(tx: Executor, estimate: any, actorId: string, decision: string, note?: string | null) {
  if (String(estimate.requester_user_id) !== actorId) fail(403,"Only the request owner can respond to this estimate.");
  const status = decision === "accept" ? "accepted" : decision === "request_changes" ? "change_requested" : decision === "decline" ? "declined" : fail(400,"Invalid estimate decision.");
  if (estimate.status === status) return {ok:true,estimateId:String(estimate.id),status,replayed:true};
  if (estimate.status !== "sent") fail(409,"Only sent estimates can be responded to.");
  await tx.execute(sql`UPDATE job_estimates SET status=${status},responded_at=now(),updated_at=now() WHERE id=${String(estimate.id)}`);
  if (status === "accepted") await tx.execute(sql`
    INSERT INTO job_acceptances(id,workspace_id,estimate_id,accepted_by,accepted_at,note)
    VALUES(${"acc_"+randomUUID()},${String(estimate.workspace_id)},${String(estimate.id)},${actorId},now(),${note?.trim()||null})
  `);
  await tx.execute(sql`UPDATE direct_connect_job_workspaces SET active_stage=${status === "accepted" ? "acceptance" : "estimate"},status=${"estimate_"+status},updated_at=now() WHERE id=${String(estimate.workspace_id)}`);
  await recordEstimateEvent(tx,{estimate,actorId,eventType:"estimate_"+status,metadata:{note:note?.trim()||null},recipientId:estimate.created_by ? String(estimate.created_by) : null,recipientRole:"business"});
  return {ok:true,estimateId:String(estimate.id),status,replayed:false};
}
