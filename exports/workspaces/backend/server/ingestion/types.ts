import type { Observation } from "@shared/schema";

export type CanonicalObservationInput = {
  occurredAt: Date;
  countyFips: string;
  stateCode: string;
  city?: string | null;
  geoJson?: Record<string, unknown> | null;
  subjectType: Observation["subjectType"];
  subjectRef?: string | null;
  actionType: string;
  sourceType: Observation["sourceType"];
  sourceRef: string;
  attributesJson: Record<string, unknown>;
  confidence?: Observation["confidence"];
};

export type ObservationAdapterContext = {
  countyFips: string;
  stateCode: string;
  cursor?: Record<string, unknown> | null;
  limit?: number;
  config?: Record<string, unknown>;
};

export type ObservationAdapterResult = {
  observations: CanonicalObservationInput[];
  nextCursor?: Record<string, unknown> | null;
};

export interface ObservationAdapter {
  sourceType: Observation["sourceType"];
  run(ctx: ObservationAdapterContext): Promise<ObservationAdapterResult>;
}
