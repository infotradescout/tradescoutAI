type RequestEffectiveUserLike = {
  user?: any;
  principalUser?: any;
  session?: unknown;
};

export type RequestEffectiveUserResolution =
  | {
      ok: true;
      principalUserId: string;
      effectiveUserId: string;
      isImpersonating: boolean;
    }
  | {
      ok: false;
      reason: "missing_principal" | "incomplete_impersonation" | "principal_mismatch";
    };

type RequestEffectiveUserFailureReason = Extract<
  RequestEffectiveUserResolution,
  { ok: false }
>["reason"];

const IMPERSONATION_MARKERS = [
  "isImpersonating",
  "impersonatedUserId",
  "impersonatingRole",
  "originalUser",
] as const;

function hasOwn(record: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function normalizeIdentityString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveRequestEffectiveUser(
  req: RequestEffectiveUserLike
): RequestEffectiveUserResolution {
  const principalUser = req?.principalUser ?? req?.user;
  const principalUserId =
    normalizeIdentityString(principalUser?.id) ??
    normalizeIdentityString(principalUser?.claims?.sub);

  if (!principalUserId) {
    return { ok: false, reason: "missing_principal" };
  }

  const session =
    req?.session !== null && typeof req?.session === "object"
      ? (req.session as Record<string, unknown>)
      : null;
  const hasImpersonationMarker =
    !!session && IMPERSONATION_MARKERS.some((field) => hasOwn(session, field));

  if (!hasImpersonationMarker) {
    return {
      ok: true,
      principalUserId,
      effectiveUserId: principalUserId,
      isImpersonating: false,
    };
  }

  const originalUser =
    session?.originalUser !== null && typeof session?.originalUser === "object"
      ? (session.originalUser as Record<string, unknown>)
      : null;
  const originalUserId = normalizeIdentityString(originalUser?.id);
  const impersonatedUserId = normalizeIdentityString(session?.impersonatedUserId);
  const impersonatingRole = normalizeIdentityString(session?.impersonatingRole);

  if (
    session?.isImpersonating !== true ||
    !originalUserId ||
    !impersonatedUserId ||
    !impersonatingRole
  ) {
    return { ok: false, reason: "incomplete_impersonation" };
  }

  if (originalUserId !== principalUserId) {
    return { ok: false, reason: "principal_mismatch" };
  }

  return {
    ok: true,
    principalUserId,
    effectiveUserId: impersonatedUserId,
    isImpersonating: true,
  };
}

export type RequestAuthorityContext =
  | {
      ok: true;
      principalUser: any;
      effectiveUser: any;
      principalUserId: string;
      effectiveUserId: string;
      isImpersonating: boolean;
    }
  | {
      ok: false;
      reason:
        | RequestEffectiveUserFailureReason
        | "principal_user_inactive"
        | "effective_user_missing"
        | "effective_user_inactive"
        | "effective_user_mismatch";
    };

/**
 * Resolves the current server-owned identity record. During impersonation the
 * authenticated administrator remains the principal/audit actor, while route
 * authority and customer data bind only to a freshly loaded target user.
 */
export async function resolveRequestAuthorityContext(
  req: RequestEffectiveUserLike,
  loadUser: (userId: string) => Promise<any | null | undefined>
): Promise<RequestAuthorityContext> {
  const identity = resolveRequestEffectiveUser(req);
  if (!identity.ok) return identity;

  const principalUser = req?.principalUser ?? req?.user;
  if (principalUser?.isActive === false) {
    return { ok: false, reason: "principal_user_inactive" };
  }
  if (!identity.isImpersonating) {
    return {
      ok: true,
      principalUser,
      effectiveUser: principalUser,
      principalUserId: identity.principalUserId,
      effectiveUserId: identity.effectiveUserId,
      isImpersonating: false,
    };
  }

  const effectiveUser = await loadUser(identity.effectiveUserId);
  if (!effectiveUser) return { ok: false, reason: "effective_user_missing" };
  if (effectiveUser.isActive === false) {
    return { ok: false, reason: "effective_user_inactive" };
  }
  const loadedUserId =
    normalizeIdentityString(effectiveUser.id) ?? normalizeIdentityString(effectiveUser.claims?.sub);
  if (loadedUserId !== identity.effectiveUserId) {
    return { ok: false, reason: "effective_user_mismatch" };
  }

  return {
    ok: true,
    principalUser,
    effectiveUser,
    principalUserId: identity.principalUserId,
    effectiveUserId: identity.effectiveUserId,
    isImpersonating: true,
  };
}
