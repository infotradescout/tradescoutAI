/** A failed session probe is not evidence that the visitor signed out. */
export type AuthSessionReadCode =
  | "AUTH_SESSION_HTTP_ERROR"
  | "AUTH_SESSION_INVALID_RESPONSE"
  | "AUTH_SESSION_TIMEOUT"
  | "AUTH_SESSION_NETWORK_ERROR";

export class AuthSessionReadError extends Error {
  readonly code: AuthSessionReadCode;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(code: AuthSessionReadCode, retryable = false, status?: number) {
    super("Your session could not be checked. Please try again.");
    this.name = "AuthSessionReadError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

export type AuthSessionUser = { id: string; [key: string]: unknown };

function isUser(value: unknown): value is AuthSessionUser {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).id === "string" &&
    String((value as Record<string, unknown>).id).trim()
  );
}

/** Supports the current envelope and legacy user/null responses, not HTML/errors. */
export function parseAuthSessionUser(value: unknown): AuthSessionUser | null {
  if (value === null) return null;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const payload = value as Record<string, unknown>;
    if ("authenticated" in payload) {
      if (payload.authenticated === false && (payload.user === undefined || payload.user === null)) {
        return null;
      }
      if (payload.authenticated === true && isUser(payload.user)) return payload.user;
    } else if (isUser(payload)) {
      return payload;
    }
  }
  throw new AuthSessionReadError("AUTH_SESSION_INVALID_RESPONSE");
}

/** Only explicit guest evidence resolves null; operational failures reject. */
export async function readAuthSessionUser(
  authUrl: string,
  options: { timeoutMs?: number } = {}
): Promise<AuthSessionUser | null> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError("Invalid session timeout");
  const controller = new AbortController();
  // Keep the deadline active until the body is read, not just the headers.
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(authUrl, {
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (response.status === 401) return null;
    if (!response.ok) {
      throw new AuthSessionReadError(
        "AUTH_SESSION_HTTP_ERROR",
        response.status === 429 || response.status >= 500,
        response.status
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new AuthSessionReadError("AUTH_SESSION_INVALID_RESPONSE");
    }
    return parseAuthSessionUser(payload);
  } catch (error) {
    if (error instanceof AuthSessionReadError) throw error;
    if (controller.signal.aborted) throw new AuthSessionReadError("AUTH_SESSION_TIMEOUT", true);
    throw new AuthSessionReadError("AUTH_SESSION_NETWORK_ERROR", true);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function shouldRetryAuthSessionRead(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && error instanceof AuthSessionReadError && error.retryable;
}
