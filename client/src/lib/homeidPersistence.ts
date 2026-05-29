export type HomeIdDetailStatus = "known" | "needs_review";

export type HomeIdPropertyDetail = {
  id: string;
  category: string;
  note: string;
  status: HomeIdDetailStatus;
  createdAt: string;
  savedAt: string;
};

export type HomeIdRequestPacketStatus = "draft" | "ready" | "needs_info";

export type HomeIdRequestPacket = {
  id: string;
  requestType: string;
  selectedDetailIds: string[];
  missingHelpfulInfo: string[];
  missingHelpfulInfoCount: number;
  status: HomeIdRequestPacketStatus;
  createdAt: string;
  savedAt: string;
};

export type HomeIdPersistenceState = {
  propertyDetails: HomeIdPropertyDetail[];
  requestPackets: HomeIdRequestPacket[];
  updatedAt: string;
};

const STORAGE_KEY_PREFIX = "homeid:persistence:v1:";

function storageKey(homeId: string): string {
  return `${STORAGE_KEY_PREFIX}${homeId}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeState(raw: unknown): HomeIdPersistenceState | null {
  if (!isObject(raw)) return null;
  const propertyDetailsRaw = Array.isArray(raw.propertyDetails) ? raw.propertyDetails : [];
  const requestPacketsRaw = Array.isArray(raw.requestPackets) ? raw.requestPackets : [];

  const propertyDetails: HomeIdPropertyDetail[] = propertyDetailsRaw
    .map((entry) => {
      if (!isObject(entry)) return null;
      const id = String(entry.id || "").trim();
      const category = String(entry.category || "").trim();
      const note = String(entry.note || "").trim();
      const status = entry.status === "needs_review" ? "needs_review" : "known";
      const createdAt = String(entry.createdAt || "").trim() || new Date().toISOString();
      const savedAt = String(entry.savedAt || "").trim() || createdAt;
      if (!id || !category || !note) return null;
      return { id, category, note, status, createdAt, savedAt } as HomeIdPropertyDetail;
    })
    .filter(Boolean) as HomeIdPropertyDetail[];

  const requestPackets: HomeIdRequestPacket[] = requestPacketsRaw
    .map((entry) => {
      if (!isObject(entry)) return null;
      const id = String(entry.id || "").trim();
      const requestType = String(entry.requestType || "").trim();
      const selectedDetailIds = Array.isArray(entry.selectedDetailIds)
        ? entry.selectedDetailIds.map((value) => String(value || "").trim()).filter(Boolean)
        : [];
      const missingHelpfulInfo = Array.isArray(entry.missingHelpfulInfo)
        ? entry.missingHelpfulInfo.map((value) => String(value || "").trim()).filter(Boolean)
        : [];
      const missingHelpfulInfoCount =
        Number.isFinite(Number(entry.missingHelpfulInfoCount)) &&
        Number(entry.missingHelpfulInfoCount) >= 0
          ? Number(entry.missingHelpfulInfoCount)
          : missingHelpfulInfo.length;
      const statusValue = String(entry.status || "").trim();
      const status: HomeIdRequestPacketStatus =
        statusValue === "ready" || statusValue === "needs_info" ? statusValue : "draft";
      const createdAt = String(entry.createdAt || "").trim() || new Date().toISOString();
      const savedAt = String(entry.savedAt || "").trim() || createdAt;
      if (!id || !requestType) return null;
      return {
        id,
        requestType,
        selectedDetailIds,
        missingHelpfulInfo,
        missingHelpfulInfoCount,
        status,
        createdAt,
        savedAt,
      } as HomeIdRequestPacket;
    })
    .filter(Boolean) as HomeIdRequestPacket[];

  return {
    propertyDetails,
    requestPackets,
    updatedAt: String(raw.updatedAt || "").trim() || new Date().toISOString(),
  };
}

export function loadHomeIdPersistence(homeId: string): {
  state: HomeIdPersistenceState | null;
  warning?: string;
} {
  if (!homeId || typeof window === "undefined") return { state: null };
  try {
    const raw = window.localStorage.getItem(storageKey(homeId));
    if (!raw) return { state: null };
    const parsed = JSON.parse(raw);
    const state = sanitizeState(parsed);
    return { state };
  } catch {
    return { state: null, warning: "Saved HomeID data could not be loaded. You can keep working." };
  }
}

export function saveHomeIdPersistence(
  homeId: string,
  state: HomeIdPersistenceState
): {
  ok: boolean;
  warning?: string;
} {
  if (!homeId || typeof window === "undefined") return { ok: true };
  try {
    const payload = { ...state, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(storageKey(homeId), JSON.stringify(payload));
    return { ok: true };
  } catch {
    return {
      ok: false,
      warning: "HomeID changes could not be saved locally. You can keep working.",
    };
  }
}
