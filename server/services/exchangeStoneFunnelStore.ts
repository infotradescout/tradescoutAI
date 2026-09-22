import { createHash } from "node:crypto";
import { validateFunnelEvent, funnelEvidenceFamily, type FunnelEvent } from "./exchangeStoneFunnel";

export type FunnelQuery = { query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> };
/** Accept only server-verified events; this function must never be bound directly to browser input.
 * Pass the inquiry/payment transaction here so its outcome and metric commit or roll back together. */
export async function appendStoneFunnelEvent(transaction: FunnelQuery, event: FunnelEvent): Promise<"inserted" | "duplicate"> {
  validateFunnelEvent(event);
  const payload = { eventKey: event.eventKey, journeyKey: event.journeyKey, buyerKey: event.buyerKey, offerKey: event.offerKey, stage: event.stage, occurredAt: new Date(event.occurredAt).toISOString(), acquisition: { channel: event.acquisition.channel, medium: event.acquisition.medium, evidence: event.acquisition.evidence, referrerHost: event.acquisition.referrerHost, campaign: event.acquisition.campaign }, evidence: event.evidence, evidenceId: event.evidenceId, environment: event.environment, marketKey: event.marketKey };
  // Event key is not part of the evidence fingerprint: a provider retry with a new key is still one outcome.
  const { eventKey: _eventKey, ...rawProof } = payload;
  const proof = { ...rawProof, evidence: funnelEvidenceFamily(event.evidence) };
  const fingerprint = createHash("sha256").update(JSON.stringify(proof)).digest("hex");
  const result = await transaction.query(
    `INSERT INTO exchange_stone_funnel_events
       (event_key, evidence_family, evidence_id, stage, environment, payload, fingerprint)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT DO NOTHING RETURNING event_key`,
    [event.eventKey, funnelEvidenceFamily(event.evidence), event.evidenceId, event.stage, event.environment, JSON.stringify(payload), fingerprint]
  );
  if (result.rows.length) return "inserted";
  const current = await transaction.query(
    `SELECT fingerprint FROM exchange_stone_funnel_events WHERE event_key = $1
       OR (evidence_family = $2 AND evidence_id = $3 AND stage = $4 AND environment = $5)`,
    [event.eventKey, funnelEvidenceFamily(event.evidence), event.evidenceId, event.stage, event.environment]
  );
  if (!current.rows.length || current.rows.some(row => row.fingerprint !== fingerprint)) throw new Error("Conflicting stone funnel evidence; no outcome was overwritten");
  return "duplicate";
}
