import type { ProfileAccountPolicy } from "@shared/profileAccount";
import { buildApiUrl } from "@/lib/apiBaseUrl";

export type ViewerBusinessProfile = Readonly<{
  id: string;
  name: string;
  verificationStatus: "pending" | "approved" | "rejected";
  verificationReviewRequested?: boolean;
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

export type ProfileAccountRegistrationResponse = ProfileAccountResponse &
  Readonly<{
    emailVerificationRequired?: boolean;
    emailVerificationSent?: boolean;
    verificationToken?: string;
  }>;

export type ProfileAccountMode = "create" | "signin";

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
  const normalizedSlug = String(profileSlug || "")
    .trim()
    .toLowerCase();
  const params = new URLSearchParams({ profileAccount: "1" });
  if (mode === "signin") params.set("profileAccountMode", "signin");
  const basePath =
    normalizedSlug === "jw-stone"
      ? "/jw-stone"
      : `/u/${encodeURIComponent(normalizedSlug)}`;
  return `${basePath}?${params.toString()}`;
}

export function isProfileAccountResumePath(value: unknown): boolean {
  const path = safeInternalPath(value);
  if (!path) return false;
  try {
    return (
      new URL(path, "https://profile-account.local").searchParams.get("profileAccount") === "1"
    );
  } catch {
    return false;
  }
}

export async function readResponseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

function responseError(
  response: Response,
  payload: Record<string, unknown>,
  fallback: string
): Error & { status?: number; code?: string; requiresBusinessSetup?: boolean } {
  const error = new Error(String(payload.message || fallback)) as Error & {
    status?: number;
    code?: string;
    requiresBusinessSetup?: boolean;
  };
  error.status = response.status;
  error.code = typeof payload.code === "string" ? payload.code : undefined;
  error.requiresBusinessSetup = payload.requiresBusinessSetup === true;
  return error;
}

export async function loadProfileAccountState(
  profileSlug: string
): Promise<ProfileAccountResponse> {
  const response = await fetch(buildApiUrl(`/api/u/${encodeURIComponent(profileSlug)}/account`), {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await readResponseJson(response);
  if (!response.ok) {
    throw responseError(response, payload, "Account is temporarily unavailable.");
  }
  return payload as ProfileAccountResponse;
}

export async function createProfileAccount(args: {
  profileSlug: string;
  businessName?: string | null;
  sourcePath?: string | null;
}): Promise<ProfileAccountResponse> {
  const response = await fetch(
    buildApiUrl(`/api/u/${encodeURIComponent(args.profileSlug)}/account`),
    {
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
    }
  );
  const payload = await readResponseJson(response);
  if (!response.ok) {
    throw responseError(response, payload, "Account could not be created.");
  }
  return payload as ProfileAccountResponse;
}

export async function registerProfileAccount(args: {
  profileSlug: string;
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  acceptTerms: true;
  sourcePath: string;
  next: string;
}): Promise<ProfileAccountRegistrationResponse> {
  const response = await fetch(buildApiUrl("/api/profile-accounts/register"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const payload = await readResponseJson(response);
  if (!response.ok) {
    throw responseError(response, payload, "Account could not be created.");
  }
  return payload as ProfileAccountRegistrationResponse;
}

export async function requestProfileAccountPasswordReset(args: {
  email: string;
  next: string;
}): Promise<{ message: string }> {
  const response = await fetch(buildApiUrl("/api/profile-accounts/request-password-reset"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const payload = await readResponseJson(response);
  if (!response.ok) {
    throw responseError(response, payload, "Password reset could not be requested.");
  }
  return { message: String(payload.message || "Check your email for a password reset link.") };
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
  return profileSlug === "jw-stone" ? "/jw-stone" : `/u/${profileSlug}`;
}
