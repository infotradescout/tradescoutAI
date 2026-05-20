import { db } from "../db";
import { trustLedgerEvents } from "@shared/schema";

export type TrustLedgerInput = {
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  eventType: string;
  sourceSurface: string;
  verificationLevel?: "none" | "self_reported" | "verified" | "system_verified";
  confidence?: number;
  metadata?: Record<string, unknown>;
};

function clampConfidence(value: number | undefined): string {
  const n = Number.isFinite(value as number) ? Number(value) : 0.5;
  const clamped = Math.max(0, Math.min(1, n));
  return clamped.toFixed(3);
}

export async function recordTrustLedgerEvent(input: TrustLedgerInput): Promise<void> {
  await db.insert(trustLedgerEvents).values({
    actorUserId: input.actorUserId || null,
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    sourceSurface: input.sourceSurface,
    verificationLevel: input.verificationLevel || "none",
    confidence: clampConfidence(input.confidence),
    metadata: input.metadata || {},
  });
}
