type RequestEffectiveUserLike = {
  user?: any;
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
  const principalUserId =
    normalizeIdentityString(req?.user?.id) ?? normalizeIdentityString(req?.user?.claims?.sub);

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
