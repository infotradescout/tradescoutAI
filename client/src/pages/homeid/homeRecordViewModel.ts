import type { HomeIdPropertyDetail, HomeIdRequestPacket } from "@/lib/homeidPersistence";
import { HOME_SECTIONS, homeHref, object, type HomeSection, type HomeSummary } from "./homeWorkspaceModel";

export type HomeRecord = { id?: string; recordType?: string; occurredAt?: string | null; title?: string | null; details?: string | null; createdAt?: string | null };
export type HomeDocument = { id?: string; documentType?: string | null; originalName?: string | null; bytes?: number | null; createdAt?: string | null };
export type HomeProject = { id?: string; title?: string | null; description?: string | null; projectType?: string | null; status?: string | null; estimatedCost?: string | number | null; desiredStartAt?: string | null; metadata?: unknown };
export type HomeSchedule = { id?: string; title?: string | null; cadenceDays?: number | null; nextDueAt?: string | null; status?: string | null };
export type HomeSystem = { id: string; type: string; label: string; status: "known" | "needs_review" | "unknown" };
export type HomeEvidence = { id: string; title: string; description?: string; status: "pending" | "verified" | "needs_review"; fileUrl?: string; fileName?: string };
export type HomeAppliance = { id?: string; category?: string; brand?: string; model?: string; serial?: string; installedAt?: string; notes?: string };
export type RecordPersistence = { propertyDetails: HomeIdPropertyDetail[]; requestPackets: HomeIdRequestPacket[]; components: HomeSystem[]; evidence: HomeEvidence[] };

export function rows<T>(value: unknown, key: string): T[] {
  const items = object(value)[key];
  if (!Array.isArray(items) || items.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error(`The ${key} response could not be read. Please retry.`);
  }
  return items as T[];
}
export function readRecordDetail(value: unknown, homeId: string) {
  const data = object(value);
  if (object(data.home).id !== homeId) throw new Error("The selected property could not be loaded.");
  return { home: data.home as HomeSummary, records: rows<HomeRecord>(data, "records"),
    documents: rows<HomeDocument>(data, "documents"), appliances: rows<HomeAppliance>(data, "appliances") };
}
export function readRecordPersistence(value: unknown): RecordPersistence {
  const data = object(object(value).persistence);
  const propertyDetails = rows<HomeIdPropertyDetail>(data, "propertyDetails");
  const requestPackets = rows<HomeIdRequestPacket>(data, "requestPackets");
  // Never enable a whole-collection save from a malformed/partial read.
  if (propertyDetails.some((item) => typeof item.id !== "string" || typeof item.note !== "string" || typeof item.category !== "string" || !["known", "needs_review"].includes(item.status))) {
    throw new Error("Saved property details could not be read. Please retry.");
  }
  if (requestPackets.some((item) => typeof item.id !== "string" || !Array.isArray(item.selectedDetailIds) || !Array.isArray(item.missingHelpfulInfo))) {
    throw new Error("Saved request details could not be read. Please retry.");
  }
  return { propertyDetails, requestPackets, components: rows<HomeSystem>(data, "components"), evidence: rows<HomeEvidence>(data, "evidence") };
}
export function recordTab(search: string): HomeSection {
  const tab = new URLSearchParams(search).get("tab");
  return HOME_SECTIONS.find((item) => item.id === tab)?.id || "overview";
}
export function recordHref(homeId: string | null, tab: HomeSection = "overview", projectId?: string | null): string {
  const url = new URL(homeHref(homeId, tab, projectId || undefined), "https://example.invalid");
  url.searchParams.set("workspace", "record");
  return url.pathname + url.search;
}
export function buildTimelineHref(homeId: string, projectId?: string | null): string {
  const query = new URLSearchParams({ homeId });
  if (projectId) query.set("projectId", projectId);
  return `/homes/build?${query}`;
}
export function selectRecordProject(projects: HomeProject[], requestedId: string | null): HomeProject | null {
  return requestedId ? projects.find((item) => item.id === requestedId) || null : projects[0] || null;
}
export function savedProjectStage(project: HomeProject | null): string | null {
  const value = object(project?.metadata).currentStage;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
export function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}
export function recordedMissingInputs(project: HomeProject | null, packets: HomeIdRequestPacket[]): string[] {
  return [...new Set([...textList(object(project?.metadata).requiredNextInputs), ...packets.flatMap((item) => textList(item.missingHelpfulInfo))])];
}
export function savedValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "Not recorded";
  return JSON.stringify(value, null, 2);
}
export function documentDownloadHref(homeId: string, documentId: string): string {
  return `/api/homes/${encodeURIComponent(homeId)}/documents/${encodeURIComponent(documentId)}/download`;
}
export function safeEvidenceHref(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || /[\u0000-\u001f\u007f\\]/.test(value)) return null;
  const href = value.trim();
  if (href.startsWith("//")) return null;
  try {
    const url = new URL(href, "https://example.invalid");
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    if (href.startsWith("/")) return href;
    return /^https?:\/\//i.test(href) ? url.href : null;
  } catch { return null; }
}
export const SYSTEM_GROUPS = [
  ["Structure & envelope", ["structural_system", "roofing", "windows_doors", "insulation"]],
  ["Property & site", ["site_foundation_utilities"]],
  ["Mechanical & utilities", ["hvac", "water_heater", "plumbing", "electrical_lighting"]],
  ["Interior package", ["cabinets", "natural_stone", "flooring", "appliances", "interior_finishes"]],
  ["Protection", ["warranty_protection"]],
  ["Plans & logistics", ["plans_engineering", "freight_logistics"]],
] as const;
export function groupedSystems(components: HomeSystem[]) {
  const groups = SYSTEM_GROUPS.map(([name, types]) => ({ name, items: components.filter((item) => (types as readonly string[]).includes(item.type)) }));
  const recognized = new Set<string>(SYSTEM_GROUPS.flatMap(([, types]) => [...types]));
  const other = components.filter((item) => !recognized.has(item.type));
  if (other.length) groups.push({ name: "Other systems" as (typeof groups)[number]["name"], items: other });
  return groups;
}
