import { createHash } from "crypto";
import type { ObservationAdapter, ObservationAdapterResult } from "../types";
import { loadJsonRecordsFromConfig, toDateValue, toStringValue } from "./fileObservationUtils";

function mapPermitAction(record: Record<string, unknown>): string {
  const explicit = toStringValue(record.actionType);
  if (explicit) return explicit.toLowerCase();
  const status = (toStringValue(record.status) || "").toLowerCase();
  if (status.includes("approve") || status.includes("issued")) return "approved";
  if (status.includes("close") || status.includes("final")) return "closed";
  return "permitted";
}

function deriveSourceRef(record: Record<string, unknown>): string {
  const candidates = [
    record.sourceRef,
    record.permitId,
    record.permitNumber,
    record.externalId,
    record.url,
    record.link,
  ];
  for (const value of candidates) {
    const normalized = toStringValue(value);
    if (normalized) return normalized;
  }
  const digest = createHash("sha256").update(JSON.stringify(record)).digest("hex").slice(0, 24);
  return `permit-hash:${digest}`;
}

export const permitsObservationAdapter: ObservationAdapter = {
  sourceType: "permit",
  async run(ctx): Promise<ObservationAdapterResult> {
    const records = await loadJsonRecordsFromConfig(ctx.config, "inputFilePath");
    const limitSource = ctx.limit ?? records.length ?? 500;
    const limit = Math.max(1, Math.min(5000, Number(limitSource)));
    const observations = records.slice(0, limit).map((record) => {
      const occurredAt =
        toDateValue(record.occurredAt) ||
        toDateValue(record.issuedAt) ||
        toDateValue(record.permitDate) ||
        toDateValue(record.date) ||
        new Date();

      const countyFips = toStringValue(record.countyFips) || ctx.countyFips;
      const stateCode = (toStringValue(record.stateCode) || ctx.stateCode).toUpperCase();
      const city = toStringValue(record.city);
      const subjectRef =
        toStringValue(record.subjectRef) ||
        toStringValue(record.parcelId) ||
        toStringValue(record.propertyId) ||
        toStringValue(record.addressId);

      return {
        occurredAt,
        countyFips,
        stateCode,
        city,
        subjectType: "property" as const,
        subjectRef,
        actionType: mapPermitAction(record),
        sourceType: "permit" as const,
        sourceRef: deriveSourceRef(record),
        attributesJson: record,
        confidence: "official" as const,
      };
    });

    return {
      observations,
      nextCursor: {
        lastRunAt: new Date().toISOString(),
        recordCount: observations.length,
      },
    };
  },
};
