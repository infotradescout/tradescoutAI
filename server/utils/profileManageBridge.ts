import crypto from "node:crypto";

// Lets an authenticated manager on the canonical thetradescout.com session hop
// onto a business's custom domain (a different browser origin, so the
// thetradescout.com session cookie never reaches it) with manage tools still
// active. The token is short-lived and scoped to one profile; the receiving
// domain re-derives the user's current authority from the DB rather than
// trusting a role embedded in the token.

export const PROFILE_MANAGE_BRIDGE_COOKIE = "ts_manage_bridge";
export const PROFILE_MANAGE_BRIDGE_TTL_SECONDS = 60 * 60; // 1 hour

function getBridgeSecret(): string {
  const secret = String(process.env.SESSION_SECRET || "").trim();
  if (!secret) throw new Error("SESSION_SECRET is missing");
  return secret;
}

export function signManageBridgeToken(payload: { uid: string; profileId: string }): string {
  const exp = Math.floor(Date.now() / 1000) + PROFILE_MANAGE_BRIDGE_TTL_SECONDS;
  const encoded = Buffer.from(JSON.stringify({ ...payload, exp }), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", getBridgeSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

// No cookie-parser middleware is mounted app-wide, so read the raw header
// directly rather than relying on req.cookies (which would be undefined).
export function readRawCookie(req: { headers?: { cookie?: string } }, name: string): string | null {
  const header = req?.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export function verifyManageBridgeToken(token: unknown): { uid: string; profileId: string } | null {
  if (typeof token !== "string" || !token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getBridgeSecret())
    .update(encoded)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof parsed.uid !== "string" || !parsed.uid) return null;
    if (typeof parsed.profileId !== "string" || !parsed.profileId) return null;
    return { uid: parsed.uid, profileId: parsed.profileId };
  } catch {
    return null;
  }
}
