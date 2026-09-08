export type OAuthProvider = "facebook" | "google";

export class OAuthIdentityCollisionError extends Error {
  constructor() {
    super("Conflicting stored OAuth identities");
    this.name = "OAuthIdentityCollisionError";
  }
}

export function safeOAuthReturnPath(value: unknown): string {
  const path = typeof value === "string" ? value.trim() : "";
  if (!path || path.length > 2048 || !path.startsWith("/") || path.startsWith("//")) return "";
  let decoded = path;
  try {
    for (let i = 0; i < 3; i++) {
      if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith("//")) return "";
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    const url = new URL(path, "https://www.thetradescout.com");
    // URL normalization can turn /entry/..//host into //host. Never emit a
    // protocol-relative Location even when the original input was relative.
    return url.origin === "https://www.thetradescout.com" && !url.pathname.startsWith("//")
      ? `${url.pathname}${url.search}${url.hash}`
      : "";
  } catch {
    return "";
  }
}

export type OAuthIdentityDecision =
  | { kind: "existing"; userId: string }
  | { kind: "create" }
  | { kind: "link_required"; existingUserId: string }
  | {
      kind: "identity_collision";
      providerUserId: string;
      emailUserId: string;
    };

interface OAuthIdentityEvidence {
  providerUserId?: string | null;
  emailUserId?: string | null;
}

function normalizedId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Provider subject identity is the login proof. Email is discovery evidence
 * only and can never silently attach a provider to an existing account.
 */
export function decideOAuthIdentity(evidence: OAuthIdentityEvidence): OAuthIdentityDecision {
  const providerUserId = normalizedId(evidence.providerUserId);
  const emailUserId = normalizedId(evidence.emailUserId);

  if (providerUserId) {
    if (emailUserId && emailUserId !== providerUserId) {
      return {
        kind: "identity_collision",
        providerUserId,
        emailUserId,
      };
    }
    return { kind: "existing", userId: providerUserId };
  }

  if (emailUserId) {
    return { kind: "link_required", existingUserId: emailUserId };
  }

  return { kind: "create" };
}

export function oauthIdentityFailure(
  provider: OAuthProvider,
  decision: OAuthIdentityDecision
): { code: string; message: string } | null {
  const providerLabel = provider === "google" ? "Google" : "Facebook";

  if (decision.kind === "link_required") {
    return {
      code: "AUTH_ACCOUNT_LINK_REQUIRED",
      message: `An account with this email already exists. Sign in to that account before linking ${providerLabel}.`,
    };
  }

  if (decision.kind === "identity_collision") {
    return {
      code: "AUTH_IDENTITY_COLLISION",
      message: `This ${providerLabel} identity conflicts with another account. Use account recovery instead of creating or linking an account.`,
    };
  }

  return null;
}
