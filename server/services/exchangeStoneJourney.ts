import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { captureAcquisition, type Acquisition } from "./exchangeStoneFunnel";
import { resolveStoneRetailSigningSecret } from "../../shared/stoneRetailSigning.mjs";

const COOKIE = "ts_stone_journey";
const MAX_AGE = 24 * 60 * 60 * 1000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
type Journey = { id: string; acquisition: Acquisition };
function copyJourney(value: any): Journey | null {
  const a = value?.acquisition;
  if (!UUID.test(value?.id || "") || !a ||
      !["facebook_marketplace", "facebook_other", "tradescout", "search", "other_referral", "direct"].includes(a.channel) ||
      !["organic", "paid", "unspecified"].includes(a.medium) ||
      !["referrer", "tagged_link", "none"].includes(a.evidence) ||
      (a.campaign !== null && (typeof a.campaign !== "string" || !/^[a-zA-Z0-9_.:-]{1,80}$/.test(a.campaign))) ||
      (a.referrerHost !== null && (typeof a.referrerHost !== "string" || !/^[a-z0-9.-]{1,253}$/.test(a.referrerHost)))) return null;
  return { id: value.id, acquisition: { channel: a.channel, medium: a.medium, evidence: a.evidence,
    campaign: a.campaign, referrerHost: a.referrerHost } };
}
function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update("TradeScout.Stone.Journey.v1\n" + payload).digest("hex");
}
export function encodeStoneJourney(value: Journey, secret: string, now = Date.now()): string {
  const journey = copyJourney(value);
  if (!journey || secret.length < 24) throw new Error("Valid server-owned journey and signing secret required");
  const payload = Buffer.from(JSON.stringify({ version: 1, ...journey, expiresAt: now + MAX_AGE })).toString("base64url");
  return payload + "." + signature(payload, secret);
}
export function decodeStoneJourney(value: unknown, secret: string, now = Date.now()): Journey | null {
  if (typeof value !== "string" || value.length > 2048 || secret.length < 24) return null;
  const [payload, supplied, extra] = value.split(".");
  if (!payload || extra || !/^[a-f0-9]{64}$/.test(supplied || "")) return null;
  if (!timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(signature(payload, secret), "hex"))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.version === 1 && Number.isSafeInteger(data.expiresAt) && data.expiresAt > now && data.expiresAt <= now + MAX_AGE ? copyJourney(data) : null;
  } catch { return null; }
}

/** Acquisition only: this cookie contains no account identity, login state, contact
 * authority, location authorization or supplier data. Authentication can rotate
 * its session normally; only this bounded, signed first-touch record is restored. */
export function ensureStoneJourney(req: any, res: any, captureFromRequest = true): void {
  if (!req.session) return;
  const secret = resolveStoneRetailSigningSecret();
  const candidates = String(req.headers?.cookie || "").split(";").map(part => part.trim()).filter(part => part.startsWith(COOKIE + "="));
  const remembered = candidates.length === 1 ? decodeStoneJourney(candidates[0].slice(COOKIE.length + 1), secret) : null;
  const current = copyJourney(req.session.exchangeStoneJourney);
  const journey = current || remembered || { id: randomUUID(), acquisition: captureFromRequest
    ? captureAcquisition(req.originalUrl || req.url || "/", req.get?.("referer")) : captureAcquisition("/") };
  req.session.exchangeStoneJourney = journey;
  if (!remembered && secret.length >= 24 && typeof res.cookie === "function") {
    res.cookie(COOKIE, encodeStoneJourney(journey, secret), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE,
    });
  }
}
