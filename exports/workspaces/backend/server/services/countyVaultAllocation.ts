export type CountyVaultAllocationBucket =
  | "local_tradeschool_scholarships"
  | "giveback"
  | "investment_engine"
  | "events"
  | "projects";

export const COUNTY_VAULT_ALLOCATION_PLAN: ReadonlyArray<{
  key: CountyVaultAllocationBucket;
  label: string;
  percent: number;
}> = Object.freeze([
  {
    key: "local_tradeschool_scholarships",
    label: "Local Tradeschool + Culinary Scholarships",
    percent: 20,
  },
  { key: "giveback", label: "Giveback", percent: 20 },
  { key: "investment_engine", label: "Investment Engine", percent: 20 },
  { key: "events", label: "Events", percent: 20 },
  { key: "projects", label: "Projects", percent: 20 },
]);

export function buildCountyVaultAllocation(amount: number) {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return COUNTY_VAULT_ALLOCATION_PLAN.map((bucket) => ({
    ...bucket,
    amount: Number(((safeAmount * bucket.percent) / 100).toFixed(2)),
  }));
}
