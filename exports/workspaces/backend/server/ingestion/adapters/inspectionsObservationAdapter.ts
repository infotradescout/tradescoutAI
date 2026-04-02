import { createHash } from "crypto";
import type { ObservationAdapter, ObservationAdapterResult } from "../types";
import { loadJsonRecordsFromConfig, toDateValue, toStringValue } from "./fileObservationUtils";

function mapInspectionAction(record: Record<string, unknown>): string {
  const explicit = toStringValue(record.actionType);
  if (explicit) return explicit.toLowerCase();
  const result = (toStringValue(record.result) || toStringValue(record.status) || "").toLowerCase();
  if (result.includes("fail") || result.includes("violation")) return "failed";
  if (result.includes("pass") || result.includes("approved")) return "passed";
  if (result.includes("close")) return "closed";
  return "inspected";
}

function deriveSourceRef(record: Record<string, unknown>): string {
  const candidates = [
    record.sourceRef,
    record.inspectionId,
    record.reportId,
    record.caseId,
    record.externalId,
    record.url,
    record.link,
  ];
  for (const value of candidates) {
    const normalized = toStringValue(value);
    if (normalized) return normalized;
  }
  const digest = createHash("sha256").update(JSON.stringify(record)).digest("hex").slice(0, 24);
  return `inspection-hash:${digest}`;
}

export const inspectionsObservationAdapter: ObservationAdapter = {
  sourceType: "inspection",
  async run(ctx): Promise<ObservationAdapterResult> {
    const records = await loadJsonRecordsFromConfig(ctx.config, "inputFilePath");
    const limitSource = ctx.limit ?? records.length ?? 500;
    const limit = Math.max(1, Math.min(5000, Number(limitSource)));

    const observations = records.slice(0, limit).map((record) => {
      const occurredAt =
        toDateValue(record.occurredAt) ||
        toDateValue(record.inspectedAt) ||
        toDateValue(record.inspectionDate) ||
        toDateValue(record.date) ||
        new Date();

      const countyFips = toStringValue(record.countyFips) || ctx.countyFips;
      const stateCode = (toStringValue(record.stateCode) || ctx.stateCode).toUpperCase();
      const city = toStringValue(record.city);
      const subjectType =
        (toStringValue(record.subjectType) || "property").toLowerCase() === "business"
          ? ("business" as const)
          : ("property" as const);
      const subjectRef =
        toStringValue(record.subjectRef) ||
        toStringValue(record.businessId) ||
        toStringValue(record.parcelId) ||
        toStringValue(record.propertyId);

      return {
        occurredAt,
        countyFips,
        stateCode,
        city,
        subjectType,
        subjectRef,
        actionType: mapInspectionAction(record),
        sourceType: "inspection" as const,
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
