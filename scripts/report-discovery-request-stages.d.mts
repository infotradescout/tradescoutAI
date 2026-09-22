import type { RequestStagesReport } from "../shared/discoveryRequestStages";
export type RequestStageClient = { query(text: string, values?: unknown[]): Promise<{ rows: any[] }> };
export const REQUEST_STAGES_SQL: string;
export function validateWindow(from: unknown, to: unknown): { from: string; to: string };
export function reportRequestStages(client: RequestStageClient, from: string, to: string): Promise<RequestStagesReport>;
