import { object } from "./homeWorkspaceModel";
import type { HomeProject } from "./homeRecordViewModel";
export const PACKAGE_PROJECT_ID = "d703435e-f059-468a-a8b2-bafff6a5047e";
export const LAUNCH_TABS = [
  { id: "control", label: "Launch Control" },
  { id: "scope", label: "Scope Matrix" },
  { id: "packages", label: "Package Levels" },
  { id: "partners", label: "Partner Pipeline" },
  { id: "evidence", label: "Documents & references" },
  { id: "release", label: "Release Gates" },
] as const;
export type LaunchTab = (typeof LAUNCH_TABS)[number]["id"];
export type SavedFields = Record<string, unknown>;
export type PartnerTarget = { slug: string; lane: string; role: string };
function optionalObjects(value: unknown, name: string): SavedFields[] | null {
  if (value === undefined || value === null) return null;
  if (
    !Array.isArray(value) ||
    value.some((item) => !item || typeof item !== "object" || Array.isArray(item))
  )
    throw new Error(`Saved ${name} could not be read.`);
  return value as SavedFields[];
}
function optionalText(value: unknown, name: string): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error(`Saved ${name} could not be read.`);
  return value;
}
export function launchTab(search: string): LaunchTab {
  const value = new URLSearchParams(search).get("launchTab");
  return LAUNCH_TABS.find((tab) => tab.id === value)?.id || "control";
}
export function collectPartnerTargets(
  primaryTargets: SavedFields[] | null
): PartnerTarget[] | null {
  if (!primaryTargets) return null;
  const result: PartnerTarget[] = [];
  for (const item of primaryTargets) {
    const lane = typeof item.lane === "string" ? item.lane : "Unspecified category";
    for (const [key, role] of [
      ["slug", "Primary"],
      ["backupSlug", "Backup"],
      ["incentiveSlug", "Incentive"],
    ]) {
      const slug = item[key];
      if (typeof slug === "string" && slug.trim()) result.push({ slug: slug.trim(), lane, role });
    }
  }
  // A company may legitimately appear in several categories; do not drop those records.
  return [...new Map(result.map((row) => [`${row.slug}:${row.lane}:${row.role}`, row])).values()];
}
export function launchWorkspaceModel(project: HomeProject) {
  const metadata = object(project.metadata);
  const launchBoard = object(metadata.launchBoard);
  const partnerPipeline = object(metadata.partnerPipeline);
  const packageExecution = object(metadata.packageExecution);
  const sourcePlan = object(metadata.sourceDerivedPlan);
  const launchTasks = optionalObjects(launchBoard.tasks, "launch tasks");
  const primaryTargets = optionalObjects(partnerPipeline.primaryTargets, "partner targets");
  const scopeMatrix = optionalObjects(packageExecution.anchorScopeMatrix, "scope matrix");
  const packageLevels = optionalObjects(packageExecution.packageLevels, "package levels");
  const executionSteps = optionalObjects(packageExecution.executionSteps, "execution sequence");
  return {
    metadata,
    launchBoard,
    launchTasks,
    partnerPipeline,
    primaryTargets,
    partnerTargets: collectPartnerTargets(primaryTargets),
    packageExecution,
    scopeMatrix,
    packageLevels,
    executionSteps,
    currentCoverage: object(metadata.currentCoverage),
    commercialChecklists: object(metadata.commercialTermsChecklists),
    sourcePlan,
    coverageTargets: object(sourcePlan.commissionableCoverage),
    economics: object(sourcePlan.planningEconomicsExample),
    spaceExample: object(sourcePlan.mechanicalSpaceExample),
    sourceFiles: optionalObjects(metadata.sourceFilesUsed, "source files"),
    excludedFiles: optionalObjects(metadata.sourceFilesExcluded, "excluded files"),
    requiredNextInputs: optionalText(metadata.requiredNextInputs, "planning inputs"),
    screeningTemplate: object(metadata.destinationScreeningTemplate),
    quoteTemplate: object(metadata.firstPackageQuoteTemplate),
    handoffTemplate: object(metadata.builderHandoffTemplate),
    ownershipTemplate: object(metadata.ownershipActivationTemplate),
    boundaries: optionalText(metadata.boundaries, "project boundaries"),
  };
}
export type LaunchModel = ReturnType<typeof launchWorkspaceModel>;
export function savedCount(value: unknown): string {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? String(value)
    : "Not recorded";
}
export function listCount(value: unknown[] | null): string {
  return value === null ? "Not recorded" : String(value.length);
}
export function taskStatusCount(tasks: SavedFields[] | null, statuses: string[]): string {
  return tasks === null
    ? "Not recorded"
    : String(
        tasks.filter(
          (item) => typeof item.status === "string" && statuses.includes(item.status.toLowerCase())
        ).length
      );
}
export function scopeConfirmation(model: LaunchModel): string {
  if (model.scopeMatrix === null) return "Not recorded";
  const confirmed = model.scopeMatrix.filter((item) => item.status === "confirmed").length;
  return `${confirmed}/${model.scopeMatrix.length}`;
}
export function recordedNumber(value: unknown, format: "currency" | "percent" | "area"): string {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim()))
    return "Not recorded";
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "Not recorded";
  if (format === "currency")
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  return `${amount}${format === "percent" ? "%" : " sq ft"}`;
}
