import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { observations, observationSources } from "@shared/schema";
import { homeScoutListingsObservationAdapter } from "./adapters/homeScoutListingsAdapter";
import type { ObservationAdapter, ObservationAdapterContext } from "./types";

export type RunObservationAdapterParams = {
  adapter: ObservationAdapter;
  countyFips: string;
  stateCode: string;
  limit?: number;
};

export type RunObservationAdapterResult = {
  sourceType: string;
  countyFips: string;
  stateCode: string;
  inserted: number;
  observed: number;
  cursor: Record<string, unknown> | null;
};

async function upsertObservationSourceState(input: {
  sourceType:
    | "permit"
    | "inspection"
    | "enforcement"
    | "agenda"
    | "ordinance"
    | "sensor"
    | "listing"
    | "other";
  countyFips: string;
  stateCode: string;
  lastRunAt?: Date;
  lastSuccessAt?: Date;
  cursorJson?: Record<string, unknown> | null;
  healthStatus?: "healthy" | "degraded" | "failing" | "idle";
  errorMessage?: string | null;
}) {
  const now = new Date();
  await db
    .insert(observationSources)
    .values({
      sourceType: input.sourceType,
      countyFips: input.countyFips,
      stateCode: input.stateCode,
      lastRunAt: input.lastRunAt ?? now,
      lastSuccessAt: input.lastSuccessAt ?? null,
      cursorJson: input.cursorJson ?? null,
      healthStatus: input.healthStatus ?? "idle",
      errorMessage: input.errorMessage ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [observationSources.sourceType, observationSources.countyFips],
      set: {
        stateCode: input.stateCode,
        lastRunAt: input.lastRunAt ?? now,
        lastSuccessAt: input.lastSuccessAt ?? null,
        cursorJson: input.cursorJson ?? null,
        healthStatus: input.healthStatus ?? "idle",
        errorMessage: input.errorMessage ?? null,
        updatedAt: now,
      },
    });
}

export async function runObservationAdapter(
  params: RunObservationAdapterParams
): Promise<RunObservationAdapterResult> {
  const { adapter, countyFips, stateCode, limit } = params;
  const startedAt = new Date();

  const [existingSource] = await db
    .select()
    .from(observationSources)
    .where(
      and(
        eq(observationSources.sourceType, adapter.sourceType),
        eq(observationSources.countyFips, countyFips)
      )
    )
    .limit(1);

  const context: ObservationAdapterContext = {
    countyFips,
    stateCode,
    cursor: (existingSource?.cursorJson as Record<string, unknown> | null) ?? null,
    limit,
  };

  await upsertObservationSourceState({
    sourceType: adapter.sourceType,
    countyFips,
    stateCode,
    lastRunAt: startedAt,
    cursorJson: context.cursor ?? null,
    healthStatus: "degraded",
    errorMessage: null,
  });

  try {
    const result = await adapter.run(context);
    const obs = result.observations;

    if (obs.length > 0) {
      await db
        .insert(observations)
        .values(
          obs.map((row) => ({
            occurredAt: row.occurredAt,
            countyFips: row.countyFips,
            stateCode: row.stateCode,
            city: row.city ?? null,
            geoJson: row.geoJson ?? null,
            subjectType: row.subjectType,
            subjectRef: row.subjectRef ?? null,
            actionType: row.actionType,
            sourceType: row.sourceType,
            sourceRef: row.sourceRef,
            attributesJson: row.attributesJson,
            confidence: row.confidence ?? "official",
          }))
        )
        .onConflictDoNothing({
          target: [observations.sourceType, observations.sourceRef],
        });
    }

    const finishedAt = new Date();
    await upsertObservationSourceState({
      sourceType: adapter.sourceType,
      countyFips,
      stateCode,
      lastRunAt: finishedAt,
      lastSuccessAt: finishedAt,
      cursorJson: result.nextCursor ?? context.cursor ?? null,
      healthStatus: "healthy",
      errorMessage: null,
    });

    return {
      sourceType: adapter.sourceType,
      countyFips,
      stateCode,
      inserted: obs.length,
      observed: obs.length,
      cursor: (result.nextCursor as Record<string, unknown> | null) ?? context.cursor ?? null,
    };
  } catch (error) {
    const finishedAt = new Date();
    await upsertObservationSourceState({
      sourceType: adapter.sourceType,
      countyFips,
      stateCode,
      lastRunAt: finishedAt,
      cursorJson: context.cursor ?? null,
      healthStatus: "failing",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function runHomeScoutObservationAdapter(params: {
  countyFips: string;
  stateCode: string;
  limit?: number;
}) {
  return runObservationAdapter({
    adapter: homeScoutListingsObservationAdapter,
    countyFips: params.countyFips,
    stateCode: params.stateCode,
    limit: params.limit,
  });
}
