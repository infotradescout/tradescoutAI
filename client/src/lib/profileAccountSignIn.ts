import { readAuthSessionUser, type AuthSessionUser } from "./authSessionRead";

/** A company sign-in is complete only after its cookie session reads back as the same identity. */
export type ProfileSessionRefresh = (options: { throwOnError: true }) => Promise<{
  data?: unknown;
  error?: unknown;
  isError?: boolean;
}>;

export class ProfileAccountSignInError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "ProfileAccountSignInError";
    this.code = code;
    this.status = status;
  }
}

function identityId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = (value as Record<string, unknown>).id;
  return typeof id === "string" && id.trim() && id === id.trim() ? id : null;
}

/** TanStack refetch can resolve an error result; neither that nor a guest result confirms login. */
export async function confirmProfileAccountSession(
  refresh: ProfileSessionRefresh,
  expectedViewerId?: string
): Promise<string> {
  const result = await refresh({ throwOnError: true });
  const viewerId = identityId(result?.data);
  if (result?.error || result?.isError || !viewerId ||
      (expectedViewerId !== undefined && viewerId !== expectedViewerId)) {
    throw new ProfileAccountSignInError(
      "Your sign-in could not be confirmed. Check your connection and try again.",
      "AUTH_SESSION_NOT_CONFIRMED"
    );
  }
  return viewerId;
}

/** No automatic retry: an uncertain POST must not be replayed behind the customer's back. */
export async function signInToProfileAccount(args: {
  loginUrl: string;
  email: string;
  password: string;
  authUrl: string;
  timeoutMs?: number;
}): Promise<AuthSessionUser> {
  const timeoutMs = args.timeoutMs ?? 10_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError("Invalid sign-in timeout");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let expectedViewerId: string;
  try {
    const response = await fetch(args.loginUrl, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email: args.email.trim().toLowerCase(), password: args.password }),
    });
    let value: unknown;
    try {
      value = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new ProfileAccountSignInError("Sign-in returned an unreadable response. Please try again.", "AUTH_LOGIN_INVALID_RESPONSE", response.status);
    }
    const payload = value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
    if (!response.ok) {
      throw new ProfileAccountSignInError(
        typeof payload?.message === "string" ? payload.message : "Sign-in failed. Please try again.",
        typeof payload?.code === "string" ? payload.code : "AUTH_LOGIN_FAILED",
        response.status
      );
    }
    const id = identityId(payload?.user);
    if (!id || (payload && "authenticated" in payload && payload.authenticated !== true)) {
      throw new ProfileAccountSignInError("Sign-in returned an invalid response. Please try again.", "AUTH_LOGIN_INVALID_RESPONSE", response.status);
    }
    expectedViewerId = id;
  } catch (error) {
    if (error instanceof ProfileAccountSignInError) throw error;
    throw new ProfileAccountSignInError(
      controller.signal.aborted ? "Sign-in timed out. Please try again." : "Sign-in could not reach the server. Please try again.",
      controller.signal.aborted ? "AUTH_LOGIN_TIMEOUT" : "AUTH_LOGIN_NETWORK_ERROR"
    );
  } finally {
    clearTimeout(timer);
  }
  // The existing auth reader supplies its own deadline. Do not clear that query
  // or claim a signed-in user merely because the credential POST returned 200.
  const user = await readAuthSessionUser(args.authUrl, { timeoutMs });
  if (!user || user.id !== expectedViewerId) {
    throw new ProfileAccountSignInError(
      "Your sign-in could not be confirmed. Check your connection and try again.",
      "AUTH_SESSION_NOT_CONFIRMED"
    );
  }
  return user;
}
