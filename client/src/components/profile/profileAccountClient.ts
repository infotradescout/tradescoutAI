import type { ProfileAccountPolicy } from "@shared/profileAccount";
import { buildApiUrl } from "@/lib/apiBaseUrl";

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
  if (slug === "jw-stone") return "/jw-stone";
  return `/u/${encodeURIComponent(slug)}`;
}

export function buildProfileAccountResumePath(
  profileSlug: string,
  mode: ProfileAccountMode = "create"
): string {
  const params = new URLSearchParams({ profileAccount: "1" });
  if (mode === "signin") params.set("profileAccountMode", "signin");
  return `${canonicalProfilePath(profileSlug)}?${params.toString()}`;
}

export function currentProfileAccountSourcePath(profileSlug: string): string {
  if (typeof window === "undefined") return canonicalProfilePath(profileSlug);
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("profileAccount");
    url.searchParams.delete("profileAccountMode");
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")) {
      return path.slice(0, 500);
    }
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
  const error = new Error(String(payload.message || fallback)) as ProfileAccountError;
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
  const payload = await readProfileAccountJson(response);
  if (!response.ok) throw toError(response, payload, "Account is temporarily unavailable.");
  return payload as ProfileAccountResponse;
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
  const payload = await readProfileAccountJson(response);
  if (!response.ok) throw toError(response, payload, "Account could not be created.");
  return payload as ProfileAccountRegistrationResponse;
}
