import { parseHomeIdPersistenceGraph } from "@shared/homeIdPacketAuthority";

export type HomeIdDetailStatus = "known" | "needs_review";

export type HomeIdPropertyDetail = {
  id: string;
  category: string;
  note: string;
  status: HomeIdDetailStatus;
  createdAt: string;
  savedAt: string;
};

export type HomeIdRequestPacketStatus = "draft" | "needs_info" | "ready_for_handoff";

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

export type HomeIdPendingDirectConnectDraft = {
  requestId: string;
  homeId: string;
  homePacketId: string;
  selectedDetailIds: string[];
  requestType: string;
  description: string;
  readinessState: "ready_for_handoff";
  status: "draft";
  scope: "personal";
  visibility: "private";
  audience: "requester";
  createdAt?: string;
};

export type HomeIdPersistenceFetcher = (
  method: "GET" | "PUT",
  url: string,
  body?: unknown
) => Promise<any>;

export type HomeIdPersistenceSource = "server" | "local" | "none";

const STORAGE_KEY_PREFIX = "homeid:persistence:v1:";

function storageKey(homeId: string): string {
  return `${STORAGE_KEY_PREFIX}${homeId}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function resolveOwnedPendingHomeIdDraft(
  response: unknown,
  expectedHomeId: string
): HomeIdPendingDirectConnectDraft | null {
  if (!isObject(response) || !Array.isArray(response.pendingDrafts)) return null;
  for (const value of response.pendingDrafts) {
    if (!isObject(value)) continue;
    const selectedDetailIds = Array.isArray(value.selectedDetailIds)
      ? value.selectedDetailIds.map((id) => (typeof id === "string" ? id.trim() : ""))
      : [];
    const draft = {
      requestId: String(value.requestId || "").trim(),
      homeId: String(value.homeId || "").trim(),
      homePacketId: String(value.homePacketId || "").trim(),
      selectedDetailIds,
      requestType: String(value.requestType || "").trim(),
      description: String(value.description || "").trim(),
      readinessState: value.readinessState,
      status: value.status,
      scope: value.scope,
      visibility: value.visibility,
      audience: value.audience,
      createdAt: String(value.createdAt || "").trim() || undefined,
    };
    if (
      draft.requestId &&
      draft.homeId === expectedHomeId &&
      draft.homePacketId &&
      draft.requestType &&
      draft.description &&
      selectedDetailIds.length > 0 &&
      selectedDetailIds.every(Boolean) &&
      new Set(selectedDetailIds).size === selectedDetailIds.length &&
      draft.readinessState === "ready_for_handoff" &&
      draft.status === "draft" &&
      draft.scope === "personal" &&
      draft.visibility === "private" &&
      draft.audience === "requester"
    ) {
      return draft as HomeIdPendingDirectConnectDraft;
    }
  }
  return null;
}

function sanitizeState(raw: unknown): HomeIdPersistenceState | null {
  if (!isObject(raw)) return null;
  const graph = parseHomeIdPersistenceGraph(raw);
  if (!graph) return null;

  return {
    propertyDetails: graph.propertyDetails,
    requestPackets: graph.requestPackets,
    updatedAt: String(raw.updatedAt || "").trim() || new Date().toISOString(),
  };
}

function loadLocal(homeId: string): {
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

function saveLocal(
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

export async function loadHomeIdPersistence(
  homeId: string,
  fetcher?: HomeIdPersistenceFetcher
): Promise<{
  state: HomeIdPersistenceState | null;
  warning?: string;
  source: HomeIdPersistenceSource;
}> {
  const local = loadLocal(homeId);
  if (!fetcher || !homeId) return { ...local, source: local.state ? "local" : "none" };

  try {
    const response = await fetcher("GET", `/api/homeid/${encodeURIComponent(homeId)}/persistence`);
    const state = sanitizeState(response?.persistence);
    if (state) {
      saveLocal(homeId, state);
      return { state, source: "server" };
    }
    return { ...local, source: local.state ? "local" : "none" };
  } catch {
    if (local.state) return { ...local, source: "local" };
    return {
      state: null,
      warning: "Server persistence unavailable. Using local HomeID data when possible.",
      source: "none",
    };
  }
}

export async function saveHomeIdPersistence(
  homeId: string,
  state: HomeIdPersistenceState,
  fetcher?: HomeIdPersistenceFetcher
): Promise<{ ok: boolean; warning?: string; serverSaved: boolean }> {
  const canonical = sanitizeState(state);
  if (!canonical) {
    return {
      ok: false,
      warning: "HomeID changes were not saved because the detail and request graph is incomplete.",
      serverSaved: false,
    };
  }
  const local = saveLocal(homeId, canonical);
  if (!fetcher || !homeId) return { ...local, serverSaved: false };

  try {
    await fetcher("PUT", `/api/homeid/${encodeURIComponent(homeId)}/persistence`, {
      propertyDetails: canonical.propertyDetails,
      requestPackets: canonical.requestPackets,
    });
    return { ...local, serverSaved: true };
  } catch {
    return {
      ok: local.ok,
      warning: "Server save unavailable. HomeID changes are kept locally.",
      serverSaved: false,
    };
  }
}
