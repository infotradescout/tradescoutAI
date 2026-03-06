type ErrorLike = {
  message?: unknown;
  status?: unknown;
  code?: unknown;
  errorId?: unknown;
  requestId?: unknown;
};

const TECHNICAL_MESSAGE_PATTERNS = [
  /\bhttp\s*\d{3}\b/i,
  /\bexception\b/i,
  /\bstack\b/i,
  /\bsql\b/i,
  /\bsyntaxerror\b/i,
  /\btypeerror\b/i,
  /\breferenceerror\b/i,
  /failed to fetch dynamically imported module/i,
  /chunkloaderror/i,
  /<html/i,
  /\bat\s+\S+\s+\(/i,
];

const USER_SAFE_PATTERNS = [
  /incorrect password/i,
  /no account/i,
  /already exists/i,
  /valid email/i,
  /valid phone/i,
  /accept the terms/i,
  /request timed out/i,
  /network error/i,
  /onboarding required/i,
];

export function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return typeof error.message === "string" ? error.message.trim() : "";
  }
  if (typeof error === "string") {
    return error.trim();
  }
  if (error && typeof error === "object" && "message" in (error as ErrorLike)) {
    const maybe = (error as ErrorLike).message;
    return typeof maybe === "string" ? maybe.trim() : "";
  }
  return "";
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("status" in (error as ErrorLike))) {
    return null;
  }
  const status = Number((error as ErrorLike).status);
  return Number.isFinite(status) ? status : null;
}

function getRequestId(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const maybeErrorId = (error as ErrorLike).errorId;
  if (typeof maybeErrorId === "string" && maybeErrorId.trim()) return maybeErrorId.trim();
  const maybeRequestId = (error as ErrorLike).requestId;
  if (typeof maybeRequestId === "string" && maybeRequestId.trim()) return maybeRequestId.trim();
  return null;
}

function isTechnicalMessage(message: string): boolean {
  return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

function isUserSafeMessage(message: string): boolean {
  return USER_SAFE_PATTERNS.some((pattern) => pattern.test(message));
}

export function formatUserFacingErrorMessage(error: unknown, fallback: string): string {
  const raw = getRawErrorMessage(error);
  const status = getErrorStatus(error);
  const requestId = getRequestId(error);

  if (import.meta.env.DEV) {
    return raw || fallback;
  }

  const canUseRaw =
    Boolean(raw) &&
    !isTechnicalMessage(raw) &&
    (isUserSafeMessage(raw) || (status !== null && status >= 400 && status < 500));

  const base = canUseRaw ? raw : fallback;
  if (requestId) {
    return `${base} (Ref: ${requestId})`;
  }
  return base;
}
