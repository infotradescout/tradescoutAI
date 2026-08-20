import type { ProfileAccountPolicy } from "@shared/profileAccount";

export type ViewerBusinessProfile = Readonly<{
  id: string;
  name: string;
  verificationStatus: "pending" | "approved" | "rejected";
}>;

export type ProfileAccountRecord = Readonly<{
  id: string;
  profileSlug: string;
  profileName: string;
  identityKind: "user" | "business";
  businessProfileId: string | null;
  businessName: string | null;
  priorityKey: string;
  status: "active" | "suspended" | "closed";
  verificationStatus: "not_required" | "pending" | "approved" | "rejected";
  resumePath: string;
  lastSeenAt: string | null;
  bidRockIncluded: boolean;
}>;

export type ProfileAccountEntitlement = Readonly<{
  productKey: string;
  status: "pending_verification" | "active" | "suspended" | "revoked";
}>;

export type ProfileAccountResponse = Readonly<{
  policy: ProfileAccountPolicy;
  viewerBusiness: ViewerBusinessProfile | null;
  requiresBusinessSetup: boolean;
  account: ProfileAccountRecord | null;
  entitlements: readonly ProfileAccountEntitlement[];
  message?: string;
}>;

export type ProfileAccountMode = "create" | "signin";

export const PROFILE_ACCOUNT_RETURN_STORAGE_KEY = "ts.profile-account.return.v1";
const PROFILE_ACCOUNT_RETURN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function safeInternalPath(value: unknown): string {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return "";
  }
  try {
    const parsed = new URL(candidate, "https://profile-account.local");
    if (parsed.origin !== "https://profile-account.local") return "";
    if (decodeURIComponent(parsed.pathname).split("/").includes("..")) return "";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`.slice(0, 500);
  } catch {
    return "";
  }
}

export function buildProfileAccountResumePath(
  profileSlug: string,
  mode: ProfileAccountMode = "create"
): string {
  const normalizedSlug = String(profileSlug || "").trim().toLowerCase();
  const params = new URLSearchParams({ profileAccount: "1" });
  if (mode === "signin") params.set("profileAccountMode", "signin");
  return `/u/${encodeURIComponent(normalizedSlug)}?${params.toString()}`;
}

export function rememberProfileAccountReturnPath(
  profileSlug: string,
  mode: ProfileAccountMode = "signin"
): string {
  const path = buildProfileAccountResumePath(profileSlug, mode);
  if (typeof window === "undefined") return path;
  try {
    window.localStorage.setItem(
      PROFILE_ACCOUNT_RETURN_STORAGE_KEY,
      JSON.stringify({ path, savedAt: Date.now() })
    );
  } catch {
    // Browser storage is an optional return-path aid. Account creation must still work without it.
  }
  return path;
}

export function readRememberedProfileAccountReturnPath(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(PROFILE_ACCOUNT_RETURN_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { path?: unknown; savedAt?: unknown };
    const savedAt = Number(parsed.savedAt || 0);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > PROFILE_ACCOUNT_RETURN_MAX_AGE_MS) {
      window.localStorage.removeItem(PROFILE_ACCOUNT_RETURN_STORAGE_KEY);
      return "";
    }
    const path = safeInternalPath(parsed.path);
    if (!path) window.localStorage.removeItem(PROFILE_ACCOUNT_RETURN_STORAGE_KEY);
    return path;
  } catch {
    try {
      window.localStorage.removeItem(PROFILE_ACCOUNT_RETURN_STORAGE_KEY);
    } catch {
      // ignore
    }
    return "";
  }
}

export function clearRememberedProfileAccountReturnPath(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROFILE_ACCOUNT_RETURN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isProfileAccountResumePath(value: unknown): boolean {
  const path = safeInternalPath(value);
  if (!path) return false;
  try {
    return new URL(path, "https://profile-account.local").searchParams.get("profileAccount") === "1";
  } catch {
    return false;
  }
}

export async function readResponseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

export async function loadProfileAccountState(
  profileSlug: string
): Promise<ProfileAccountResponse> {
  const response = await fetch(`/api/u/${encodeURIComponent(profileSlug)}/account`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await readResponseJson(response);
  if (!response.ok) {
    throw new Error(String(payload.message || "Account is temporarily unavailable."));
  }
  return payload as ProfileAccountResponse;
}

export async function createProfileAccount(args: {
  profileSlug: string;
  businessName?: string | null;
  sourcePath?: string | null;
}): Promise<ProfileAccountResponse> {
  const response = await fetch(`/api/u/${encodeURIComponent(args.profileSlug)}/account`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(args.businessName ? { businessName: args.businessName } : {}),
      ...(args.sourcePath ? { sourcePath: args.sourcePath } : {}),
    }),
  });
  const payload = await readResponseJson(response);
  if (!response.ok) {
    const error = new Error(String(payload.message || "Account could not be created.")) as Error & {
      status?: number;
      code?: string;
      requiresBusinessSetup?: boolean;
    };
    error.status = response.status;
    error.code = typeof payload.code === "string" ? payload.code : undefined;
    error.requiresBusinessSetup = payload.requiresBusinessSetup === true;
    throw error;
  }
  return payload as ProfileAccountResponse;
}

export function currentProfileAccountSourcePath(profileSlug: string): string {
  if (typeof window === "undefined") return `/u/${profileSlug}`;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("profileAccount");
    url.searchParams.delete("profileAccountMode");
    const current = `${url.pathname}${url.search}${url.hash}`;
    const safe = safeInternalPath(current);
    if (safe) return safe;
  } catch {
    // Fall through to the canonical public profile path.
  }
  return `/u/${profileSlug}`;
}
