export const PACKAGE_HOME_ID = "073b355c-1aa3-4658-a776-ebedaa6aaefc";

export const HOME_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "property", label: "Property details" },
  { id: "build", label: "Projects & build" },
  { id: "systems", label: "Systems" },
  { id: "documents", label: "Documents" },
  { id: "timeline", label: "History" },
  { id: "maintenance", label: "Maintenance" },
  { id: "requests", label: "Requests" },
  { id: "sale", label: "Sale & transfer" },
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number]["id"];
export type HomeView = "overview" | "record" | "launch";
export type HomeSummary = {
  id: string;
  nickname?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  stateCode?: string | null;
  zipCode?: string | null;
  propertyType?: string | null;
  yearBuilt?: number | null;
};
export type SavedProject = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  desiredStartAt?: string | null;
};
export type SavedRecord = { id?: string; title?: string | null; occurredAt?: string | null; createdAt?: string | null; recordType?: string | null };
export type SavedDocument = { id?: string; originalName?: string | null; documentType?: string | null; createdAt?: string | null };
export type SavedSchedule = { id?: string; title?: string | null; status?: string | null; nextDueAt?: string | null };
export type SavedDetail = { id?: string; note?: string | null; status?: string | null };
export type HomeDetailResponse = { home: HomeSummary; records: SavedRecord[]; documents: SavedDocument[] };
export type HomePersistenceResponse = { propertyDetails: SavedDetail[]; requestPackets: unknown[]; components: unknown[]; evidence: unknown[] };

export function homeName(home?: HomeSummary | null): string {
  return home?.nickname?.trim() || home?.address1?.trim() || "Untitled property";
}
export function homeAddress(home?: HomeSummary | null): string {
  return [home?.address1, home?.address2, [home?.city, home?.stateCode].filter(Boolean).join(", "), home?.zipCode].filter(Boolean).join(" · ");
}
export function humanLabel(value?: string | null): string {
  return value?.trim().replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase()) || "Not recorded";
}

export function homeHref(homeId: string | null, section: HomeSection = "overview", projectId?: string): string {
  const query = new URLSearchParams();
  if (homeId) query.set("homeId", homeId);
  if (section !== "overview") {
    query.set("workspace", "record");
    query.set("tab", section);
  }
  if (projectId) query.set("projectId", projectId);
  return `/homes${query.size ? `?${query}` : ""}`;
}

/** Keep specialized tools reachable without using a record ID as the user's intent. */
export function resolveHomeView(search: string, selectedHomeId: string | null): HomeView {
  const query = new URLSearchParams(search);
  if (query.get("mode") === "passport" || query.get("workspace") === "record") return "record";
  const launchTab = query.get("launchTab");
  const requestedLaunch = query.get("workspace") === "launch" ||
    (launchTab != null && ["control", "scope", "packages", "partners", "evidence", "release"].includes(launchTab));
  if (selectedHomeId === PACKAGE_HOME_ID && requestedLaunch) return "launch";
  const tab = query.get("tab");
  if (HOME_SECTIONS.some((section) => section.id === tab && section.id !== "overview")) return "record";
  return "overview";
}

export function object(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function collection<T>(value: unknown, key: string): T[] {
  const items = object(value)[key];
  if (!Array.isArray(items)) throw new Error(`The ${key} response could not be read. Please retry.`);
  return items as T[];
}
export function readHomeDetail(value: unknown, requestedId: string): HomeDetailResponse {
  const data = object(value);
  const home = object(data.home);
  if (home.id !== requestedId) throw new Error("The selected property could not be loaded.");
  return { home: home as HomeSummary, records: collection(data, "records"), documents: collection(data, "documents") };
}
export function readPersistence(value: unknown): HomePersistenceResponse {
  const data = object(object(value).persistence);
  return { propertyDetails: collection(data, "propertyDetails"), requestPackets: collection(data, "requestPackets"),
    components: collection(data, "components"), evidence: collection(data, "evidence") };
}

export function dateLabel(value?: string | null): string {
  if (!value) return "Date not recorded";
  // Calendar dates are local dates, not midnight UTC (which shifts a day in Chicago).
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date not recorded" : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function dueMaintenance(items: SavedSchedule[], now: Date): SavedSchedule[] {
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return items.filter((item) => {
    if (item.status && item.status !== "active") return false;
    if (!item.nextDueAt) return false;
    const due = new Date(/^\d{4}-\d{2}-\d{2}$/.test(item.nextDueAt) ? `${item.nextDueAt}T12:00:00` : item.nextDueAt);
    return Number.isFinite(due.getTime()) && due <= end;
  }).sort((a, b) => String(a.nextDueAt).localeCompare(String(b.nextDueAt)));
}
export function recentRecords(items: SavedRecord[]): SavedRecord[] {
  return items.filter((item) => !item.title?.startsWith("homeid:")).slice().sort((a, b) => {
    const stamp = (item: SavedRecord) => { const n = new Date(item.occurredAt || item.createdAt || "").getTime(); return Number.isFinite(n) ? n : 0; };
    return stamp(b) - stamp(a);
  }).slice(0, 5);
}
