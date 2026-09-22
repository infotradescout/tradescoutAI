export const REQUEST_STAGE_KEYS = [
  "created_requests", "linked_created_requests", "unlinked_created_requests",
  "requests_with_conflicting_creation_attribution", "linked_submitted_requests",
  "requests_with_provider_response", "requester_confirmed_completions",
] as const;
export const REQUEST_SOURCE_GROUPS = ["search_labeled", "ai_labeled", "other_labeled", "direct_or_unknown"] as const;
export type RequestSourceGroup = (typeof REQUEST_SOURCE_GROUPS)[number];
export type RequestStageCounts = Record<(typeof REQUEST_STAGE_KEYS)[number], number>;
export type RequestStageSource = Pick<RequestStageCounts, "linked_created_requests" | "linked_submitted_requests" | "requests_with_provider_response" | "requester_confirmed_completions"> & { source_group: RequestSourceGroup };
export type RequestStagesReport = RequestStageCounts & {
  schema_version: 1;
  window: { from: string; to: string };
  source_groups: RequestStageSource[];
  qualified_requests: null;
  verified_unique_people: null;
  search_console_impressions: null;
  search_console_clicks: null;
};
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const sourceKeys = ["linked_created_requests", "linked_submitted_requests", "requests_with_provider_response", "requester_confirmed_completions"] as const;

/** Whitelist the aggregate response; do not pass through unrecognized database fields. */
export function projectRequestStagesReport(raw: unknown): RequestStagesReport {
  if (!object(raw) || raw.schema_version !== 1 || !object(raw.window)) throw new Error("Invalid report");
  const { from, to } = raw.window;
  if (typeof from !== "string" || typeof to !== "string" || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(to) <= Date.parse(from)) throw new Error("Invalid report window");
  for (const key of REQUEST_STAGE_KEYS) if (!count(raw[key])) throw new Error("Unavailable report count");
  if (!Array.isArray(raw.source_groups) || raw.source_groups.length > REQUEST_SOURCE_GROUPS.length) throw new Error("Invalid source groups");
  const seen = new Set<string>();
  const groups: RequestStageSource[] = raw.source_groups.map((row) => {
    if (!object(row) || !REQUEST_SOURCE_GROUPS.includes(row.source_group as RequestSourceGroup) || seen.has(String(row.source_group))) throw new Error("Invalid source group");
    seen.add(String(row.source_group));
    for (const key of sourceKeys) if (!count(row[key])) throw new Error("Unavailable source count");
    if (Number(row.linked_submitted_requests) > Number(row.linked_created_requests) || Number(row.requests_with_provider_response) > Number(row.linked_submitted_requests) || Number(row.requester_confirmed_completions) > Number(row.linked_submitted_requests)) throw new Error("Inconsistent source counts");
    return { source_group: row.source_group as RequestSourceGroup, linked_created_requests: row.linked_created_requests as number, linked_submitted_requests: row.linked_submitted_requests as number, requests_with_provider_response: row.requests_with_provider_response as number, requester_confirmed_completions: row.requester_confirmed_completions as number };
  });
  for (const key of sourceKeys) if (groups.reduce((total, row) => total + row[key], 0) !== raw[key]) throw new Error("Inconsistent report total");
  if (Number(raw.linked_created_requests) + Number(raw.unlinked_created_requests) !== raw.created_requests || Number(raw.requests_with_conflicting_creation_attribution) > Number(raw.unlinked_created_requests)) throw new Error("Inconsistent creation attribution");
  for (const key of ["qualified_requests", "verified_unique_people", "search_console_impressions", "search_console_clicks"]) if (raw[key] !== null) throw new Error("Unsupported audience or qualification claim");
  return {
    schema_version: 1, window: { from, to },
    ...Object.fromEntries(REQUEST_STAGE_KEYS.map((key) => [key, raw[key]])) as RequestStageCounts,
    source_groups: groups,
    qualified_requests: null, verified_unique_people: null, search_console_impressions: null, search_console_clicks: null,
  };
}
