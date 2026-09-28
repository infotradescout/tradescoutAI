import type { ProfileAccountPolicy } from "@shared/profileAccount";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { isSafeNextPath } from "@/lib/postOnboardingRoute";

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

export type ProfileAccountRegistrationResponse = ProfileAccountResponse &
  Readonly<{
    emailVerificationRequired?: boolean;
    emailVerificationSent?: boolean;
  }>;

export type ProfileAccountMode = "create" | "signin";

type ProfileAccountError = Error & {
  status?: number;
  code?: string;
  requiresBusinessSetup?: boolean;
};

function canonicalProfilePath(profileSlug: string): string {
  const slug = String(profileSlug || "")
    .trim()
    .toLowerCase();
  return `/u/${encodeURIComponent(slug)}`;
}

function safeInternalPath(value: unknown): string {
  const candidate = String(value || "").trim();
  if (!isSafeNextPath(candidate)) return "";
  try {
    const parsed = new URL(candidate, "https://profile-account.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`.slice(0, 500);
  } catch {
    return "";
  }
}

export function buildProfileAccountResumePath(
  profileSlug: string,
  mode: ProfileAccountMode = "create"
): string {
  const params = new URLSearchParams({ profileAccount: "1" });
  if (mode === "signin") params.set("profileAccountMode", "signin");
  return `${canonicalProfilePath(profileSlug)}?${params.toString()}`;
}

export function isProfileAccountResumePath(value: unknown): boolean {
  const path = safeInternalPath(value);
  if (!path) return false;
  try {
    const parsed = new URL(path, "https://profile-account.local");
    if (parsed.searchParams.get("profileAccount") !== "1") return false;
    const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    return pathname === "/jw-stone" || /^\/u\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname);
  } catch {
    return false;
  }
}

export function normalizeProfileAccountResumePath(value: unknown): string {
  const path = safeInternalPath(value);
  if (!path || !isProfileAccountResumePath(path)) return "";
  return path.replace(/^\/jw-stone\/?(?=[?#]|$)/i, "/u/jw-stone");
}

export function currentProfileAccountSourcePath(profileSlug: string): string {
  if (typeof window === "undefined") return canonicalProfilePath(profileSlug);
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("profileAccount");
    url.searchParams.delete("profileAccountMode");
    const path = safeInternalPath(`${url.pathname}${url.search}${url.hash}`);
    if (path) return path;
  } catch {
    // Use the canonical public profile route below.
  }
  return canonicalProfilePath(profileSlug);
}

export async function readProfileAccountJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

function toError(
  response: Response,
  payload: Record<string, unknown>,
  fallback: string
): ProfileAccountError {
  const error = new Error(String(payload?.message || fallback)) as ProfileAccountError;
  error.status = response.status;
  error.code = typeof payload?.code === "string" ? payload.code : undefined;
  error.requiresBusinessSetup = payload?.requiresBusinessSetup === true;
  return error;
}

/** Validate the state consumed by the company form. An HTML/error page is not an account. */
export function parseProfileAccountResponse(value: unknown, profileSlug: string): ProfileAccountResponse {
  const object = (candidate: unknown): candidate is Record<string, unknown> =>
    Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate));
  const id = (candidate: unknown): boolean => typeof candidate === "string" && candidate.trim().length > 0;
  const invalid = () => {
    const error = new Error("Your company account could not be checked. Please try again.") as ProfileAccountError;
    error.code = "PROFILE_ACCOUNT_INVALID_RESPONSE";
    return error;
  };
  if (!object(value) || !object(value.policy) || value.policy.profileSlug !== profileSlug ||
      typeof value.policy.enabled !== "boolean" ||
      !["user", "business"].includes(String(value.policy.requiredIdentity)) ||
      typeof value.requiresBusinessSetup !== "boolean" || !Array.isArray(value.entitlements)) throw invalid();
  if (value.viewerBusiness !== null && (!object(value.viewerBusiness) || !id(value.viewerBusiness.id) ||
      typeof value.viewerBusiness.name !== "string" ||
      !["pending", "approved", "rejected"].includes(String(value.viewerBusiness.verificationStatus)))) throw invalid();
  if (value.account !== null && (!object(value.account) || !id(value.account.id) ||
      value.account.profileSlug !== profileSlug ||
      !["user", "business"].includes(String(value.account.identityKind)) ||
      !["active", "suspended", "closed"].includes(String(value.account.status)) ||
      !["not_required", "pending", "approved", "rejected"].includes(String(value.account.verificationStatus)))) throw invalid();
  if (value.entitlements.some(entitlement => !object(entitlement) || !id(entitlement.productKey) ||
      !["pending_verification", "active", "suspended", "revoked"].includes(String(entitlement.status)))) throw invalid();
  return value as unknown as ProfileAccountResponse;
}

export async function loadProfileAccountState(
  profileSlug: string
): Promise<ProfileAccountResponse> {
  const response = await fetch(buildApiUrl(`/api/u/${encodeURIComponent(profileSlug)}/account`), {
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    headers: { Accept: "application/json" },
  });
  const payload = await readProfileAccountJson(response);
  if (!response.ok) throw toError(response, payload, "Account is temporarily unavailable.");
  return parseProfileAccountResponse(payload, profileSlug);
}

export async function createProfileAccount(args: {
  profileSlug: string;
  businessName?: string | null;
  sourcePath: string;
}): Promise<ProfileAccountResponse> {
  const response = await fetch(
    buildApiUrl(`/api/u/${encodeURIComponent(args.profileSlug)}/account`),
    {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourcePath: args.sourcePath,
        ...(args.businessName ? { businessName: args.businessName } : {}),
      }),
    }
  );
  const payload = await readProfileAccountJson(response);
  if (!response.ok) throw toError(response, payload, "Account could not be created.");
  return parseProfileAccountResponse(payload, args.profileSlug);
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
    cache: "no-store",
    redirect: "error",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const payload = await readProfileAccountJson(response);
  if (!response.ok) throw toError(response, payload, "Account could not be created.");
  return parseProfileAccountResponse(payload, args.profileSlug) as ProfileAccountRegistrationResponse;
}

export async function requestProfileAccountPasswordReset(args: {
  email: string;
  next: string;
}): Promise<{ message: string }> {
  if (!isProfileAccountResumePath(args.next)) {
    throw new Error("The account return path is invalid.");
  }
  const response = await fetch(buildApiUrl("/api/profile-accounts/request-password-reset"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: args.email, next: args.next }),
  });
  const payload = await readProfileAccountJson(response);
  if (!response.ok) {
    throw toError(response, payload, "Password reset could not be requested.");
  }
  return {
    message: String(payload.message || "Check your email for a password reset link."),
  };
}
