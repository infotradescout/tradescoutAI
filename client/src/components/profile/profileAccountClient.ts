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

export type ProfileAccountAccessState =
  | "none"
  | "relationship_active"
  | "pending_verification"
  | "active"
  | "suspended"
  | "revoked";

export function profileAccountAccessState(
  data: ProfileAccountResponse | null | undefined
): ProfileAccountAccessState {
  if (!data?.account) return "none";
  if (data.account.status === "suspended") return "suspended";
  if (data.account.status === "closed") return "revoked";
  if (!data.policy.includesBidRock) return "relationship_active";
  const entitlement = data.entitlements.find((item) => item.productKey === "bidrock");
  return entitlement?.status ?? "pending_verification";
}

export function profileAccountActionLabel(
  data: ProfileAccountResponse | null | undefined
): string {
  switch (profileAccountAccessState(data)) {
    case "active":
      return "BidRock active";
    case "relationship_active":
      return "Account active";
    case "pending_verification":
      return "Verification pending";
    case "suspended":
      return "Account suspended";
    case "revoked":
      return "Access revoked";
    default:
      return "Create account";
  }
}

export async function readResponseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

export async function loadProfileAccountState(
  profileSlug: string,
  reconcile = false
): Promise<ProfileAccountResponse> {
  const response = await fetch(`/api/u/${encodeURIComponent(profileSlug)}/account`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const payload = await readResponseJson(response);
  if (!response.ok) {
    throw new Error(String(payload.message || "Account is temporarily unavailable."));
  }
  const state = payload as ProfileAccountResponse;
  if (!reconcile || !state.account) return state;
  const reconcileResponse = await fetch(
    `/api/u/${encodeURIComponent(profileSlug)}/account/reconcile`,
    {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: "{}",
    }
  );
  const reconciled = await readResponseJson(reconcileResponse);
  if (!reconcileResponse.ok) {
    throw new Error(String(reconciled.message || "Account state could not be reconciled."));
  }
  return {
    ...state,
    account: reconciled.account as ProfileAccountRecord,
    entitlements: (reconciled.entitlements as readonly ProfileAccountEntitlement[]) ?? [],
  };
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
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current.startsWith("/") && !current.startsWith("//") && !current.includes("\\")) {
    return current.slice(0, 500);
  }
  return `/u/${profileSlug}`;
}
