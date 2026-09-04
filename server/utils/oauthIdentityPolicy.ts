export type OAuthProvider = "facebook" | "google";

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
