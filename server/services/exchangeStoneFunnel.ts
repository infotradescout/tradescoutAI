import { createHash, createHmac } from "node:crypto";

export type AcquisitionChannel = "facebook_marketplace" | "facebook_other" | "tradescout" | "search" | "other_referral" | "direct";
export type Acquisition = { channel: AcquisitionChannel; medium: "organic" | "paid" | "unspecified"; evidence: "referrer" | "tagged_link" | "none"; referrerHost: string | null; campaign: string | null };
export type FunnelStage = "listing_view" | "inquiry_started" | "inquiry_submitted" | "callback_requested" | "call_connected" | "quote_sent" | "order_paid";
export type FunnelEvidence = "browser" | "saved_inquiry" | "provider_connected_call" | "operator_confirmed_call" | "saved_quote" | "settled_payment";
export type FunnelEvent = {
  eventKey: string; journeyKey: string; buyerKey: string | null; offerKey: string;
  stage: FunnelStage; occurredAt: string; acquisition: Acquisition;
  evidence: FunnelEvidence; evidenceId: string;
  environment: "production" | "test"; marketKey: string;
};
const token = (v: unknown, max = 160): string | null => typeof v === "string" && v.length <= max && /^[a-zA-Z0-9_.:-]+$/.test(v) ? v : null;
const domainIs = (host: string, root: string) => host === root || host.endsWith(`.${root}`);
const ownHost = (host: string) => ["thetradescout.com", "www.thetradescout.com", "tradescoutai.onrender.com"].includes(host);

/** Persist only a host and bounded campaign token; never a referrer URL, query or contact data. */
export function captureAcquisition(url: string, referrer?: string): Acquisition {
  const incoming = new URL(url, "https://www.thetradescout.com");
  let host: string | null = null;
  try { const source = new URL(referrer || ""); if (["https:", "http:"].includes(source.protocol)) host = source.hostname.toLowerCase(); } catch { /* absent or invalid */ }
  const taggedSource = (incoming.searchParams.get("utm_source") || "").toLowerCase();
  const taggedMedium = (incoming.searchParams.get("utm_medium") || "").toLowerCase();
  const campaign = token(incoming.searchParams.get("utm_campaign"), 80);
  const paid = ["paid", "paid_social", "cpc", "ppc", "paid_search"].includes(taggedMedium);
  const fbReferrer = !!host && domainIs(host, "facebook.com");
  const fbTag = ["facebook", "fb", "facebook_marketplace"].includes(taggedSource);
  // Real external Facebook evidence takes priority over an optimistic internal UTM tag.
  if (fbReferrer || fbTag) return {
    channel: fbTag && (taggedSource === "facebook_marketplace" || taggedMedium === "marketplace") ? "facebook_marketplace" : "facebook_other",
    medium: paid ? "paid" : taggedMedium === "marketplace" || taggedMedium === "organic_social" ? "organic" : "unspecified",
    evidence: fbReferrer ? "referrer" : "tagged_link", referrerHost: host, campaign,
  };
  if (host && ["google.com", "bing.com", "duckduckgo.com", "search.yahoo.com"].some((root) => domainIs(host!, root))) return { channel: "search", medium: paid ? "paid" : "organic", evidence: "referrer", referrerHost: host, campaign };
  if (host && !ownHost(host)) return { channel: "other_referral", medium: paid ? "paid" : "unspecified", evidence: "referrer", referrerHost: host, campaign };
  if (taggedSource === "tradescout" || (host && ownHost(host))) return { channel: "tradescout", medium: paid ? "paid" : "organic", evidence: host ? "referrer" : "tagged_link", referrerHost: host, campaign };
  return { channel: "direct", medium: paid ? "paid" : "unspecified", evidence: "none", referrerHost: null, campaign };
}

/** Called against a server-owned journey. Reloads and internal navigation do not rewrite acquisition. */
export function retainFirstAcquisition(existing: Acquisition | null, incoming: Acquisition): Acquisition {
  return existing || incoming;
}

export function privateBuyerKey(canonicalVerifiedIdentity: string, secret: string): string {
  if (!canonicalVerifiedIdentity.trim() || canonicalVerifiedIdentity.length > 500 || secret.length < 24) throw new Error("Verified identity and private metrics secret required");
  return createHmac("sha256", secret).update("TradeScout.Stone.Buyer.v1\n").update(canonicalVerifiedIdentity).digest("hex");
}

/** Use the same key on both platforms for the same material, price, unit and fulfillment terms. */
export function comparableOfferKey(offer: { materialKey: string; priceCents: number; unit: "sqft" | "slab"; fulfillmentTermsKey: string }): string {
  if (!token(offer.materialKey) || !token(offer.fulfillmentTermsKey) || !Number.isSafeInteger(offer.priceCents) || offer.priceCents <= 0 || !["sqft", "slab"].includes(offer.unit)) throw new Error("Explicit comparable offer required");
  return createHash("sha256").update(JSON.stringify([offer.materialKey, offer.priceCents, offer.unit, offer.fulfillmentTermsKey])).digest("hex");
}

const evidenceFor: Record<FunnelStage, readonly FunnelEvidence[]> = {
  listing_view: ["browser"], inquiry_started: ["browser"],
  inquiry_submitted: ["saved_inquiry"], callback_requested: ["saved_inquiry"],
  call_connected: ["provider_connected_call", "operator_confirmed_call"],
  quote_sent: ["saved_quote"], order_paid: ["settled_payment"],
};
export function validateFunnelEvent(event: FunnelEvent): void {
  for (const key of ["eventKey", "journeyKey", "offerKey", "evidenceId", "marketKey"] as const) if (!token(event[key])) throw new Error(`Invalid ${key}`);
  if (!evidenceFor[event.stage]?.includes(event.evidence)) throw new Error("Evidence does not establish the claimed outcome");
  if (!Number.isFinite(Date.parse(event.occurredAt))) throw new Error("Invalid event time");
  if (!["production", "test"].includes(event.environment)) throw new Error("Explicit environment required");
  if (!event.acquisition || !["facebook_marketplace", "facebook_other", "tradescout", "search", "other_referral", "direct"].includes(event.acquisition.channel) || !["organic", "paid", "unspecified"].includes(event.acquisition.medium) || !["referrer", "tagged_link", "none"].includes(event.acquisition.evidence)) throw new Error("Invalid acquisition evidence");
  if (event.acquisition.campaign !== null && !token(event.acquisition.campaign, 80)) throw new Error("Invalid campaign token");
  if (event.acquisition.referrerHost !== null && (typeof event.acquisition.referrerHost !== "string" || event.acquisition.referrerHost.length > 253 || !/^[a-z0-9.-]+$/.test(event.acquisition.referrerHost))) throw new Error("Only a referrer hostname is allowed");
  if (event.buyerKey !== null && !/^[a-f0-9]{64}$/.test(event.buyerKey)) throw new Error("Invalid private buyer identity");
  if (!["listing_view", "inquiry_started"].includes(event.stage) && !event.buyerKey) throw new Error("Confirmed outcomes require a resolved buyer identity");
}

function eventFingerprint(e: FunnelEvent): string {
  // Explicit field order makes property-order-only retries idempotent.
  return JSON.stringify([e.eventKey, e.journeyKey, e.buyerKey, e.offerKey, e.stage, new Date(e.occurredAt).toISOString(), e.acquisition.channel, e.acquisition.medium, e.acquisition.evidence, e.acquisition.referrerHost, e.acquisition.campaign, e.evidence, e.evidenceId, e.environment, e.marketKey]);
}
export function funnelEvidenceFamily(evidence: FunnelEvidence): string {
  return evidence === "provider_connected_call" || evidence === "operator_confirmed_call" ? "connected_call" : evidence;
}
export function deduplicateFunnelEvents(events: FunnelEvent[]): FunnelEvent[] {
  const keys = new Map<string, FunnelEvent>();
  const proofs = new Map<string, FunnelEvent>();
  for (const event of events) {
    validateFunnelEvent(event);
    const existing = keys.get(event.eventKey);
    if (existing && eventFingerprint(existing) !== eventFingerprint(event)) throw new Error(`Conflicting event retry: ${event.eventKey}`);
    if (existing) continue;
    const proofKey = `${event.environment}:${funnelEvidenceFamily(event.evidence)}:${event.evidenceId}:${event.stage}`;
    const proof = proofs.get(proofKey);
    if (proof && eventFingerprint({ ...proof, eventKey: event.eventKey, evidence: event.evidence }) !== eventFingerprint(event)) throw new Error(`Outcome evidence reused with different context: ${event.evidenceId}`);
    keys.set(event.eventKey, event);
    if (!proof) proofs.set(proofKey, event);
  }
  return [...proofs.values()];
}

export type ComparisonScope = { start: string; endExclusive: string; offerKeys: string[]; marketKeys: string[]; medium: "organic" | "paid" };
export type ChannelCoverage = { channel: "tradescout" | "facebook_marketplace"; start: string; throughExclusive: string; complete: boolean; offerKeys: string[]; marketKeys: string[]; medium: "organic" | "paid"; evidenceId: string };
export type FunnelCounts = { interestedBuyers: number; connectedCalls: number; callbackRequests: number; quotes: number; paidOrders: number; listingViews: number };
function counts(events: FunnelEvent[]): FunnelCounts {
  const distinct = (stage: FunnelStage, key: "buyerKey" | "evidenceId") => new Set(events.filter((e) => e.stage === stage).map((e) => e[key])).size;
  return {
    interestedBuyers: new Set(events.filter((e) => ["inquiry_submitted", "callback_requested", "call_connected"].includes(e.stage)).map((e) => e.buyerKey)).size,
    connectedCalls: distinct("call_connected", "evidenceId"), callbackRequests: distinct("callback_requested", "evidenceId"),
    quotes: distinct("quote_sent", "evidenceId"), paidOrders: distinct("order_paid", "evidenceId"), listingViews: distinct("listing_view", "evidenceId"),
  };
}
function equalSet(a: string[], b: string[]) { const aa = [...new Set(a)].sort(), bb = [...new Set(b)].sort(); return aa.length === bb.length && aa.every((v, i) => v === bb[i]); }

/** An unavailable or mismatched Facebook baseline is never represented as zero competition. */
export function compareStoneChannels(events: FunnelEvent[], scope: ComparisonScope, coverage: ChannelCoverage[]) {
  const start = Date.parse(scope.start), end = Date.parse(scope.endExclusive);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !scope.offerKeys.length || !scope.marketKeys.length || !["organic", "paid"].includes(scope.medium)) throw new Error("A fixed matched comparison window is required");
  const unique = deduplicateFunnelEvents(events);
  const inScope = unique.filter((e) => e.environment === "production" && Date.parse(e.occurredAt) >= start && Date.parse(e.occurredAt) < end && scope.offerKeys.includes(e.offerKey) && scope.marketKeys.includes(e.marketKey));
  const channelReady = (channel: ChannelCoverage["channel"]) => coverage.some((c) => c.channel === channel && c.complete === true && !!token(c.evidenceId) && Date.parse(c.start) <= start && Date.parse(c.throughExclusive) >= end && c.medium === scope.medium && equalSet(c.offerKeys, scope.offerKeys) && equalSet(c.marketKeys, scope.marketKeys));
  const sourceAmbiguity = inScope.some((e) => e.acquisition.medium === "unspecified" || ["facebook_other", "direct", "other_referral"].includes(e.acquisition.channel));
  const ready = channelReady("tradescout") && channelReady("facebook_marketplace") && !sourceAmbiguity;
  const ts = counts(inScope.filter((e) => ["tradescout", "search"].includes(e.acquisition.channel) && e.acquisition.medium === scope.medium));
  const fb = counts(inScope.filter((e) => e.acquisition.channel === "facebook_marketplace" && e.acquisition.medium === scope.medium));
  return {
    scope, status: ready ? "comparable" : !channelReady("tradescout") || !channelReady("facebook_marketplace") ? "baseline_incomplete_or_mismatched" : "attribution_incomplete",
    tradescout: channelReady("tradescout") ? ts : null,
    facebookMarketplace: channelReady("facebook_marketplace") ? fb : null,
    provisionalObserved: { tradescout: ts, facebookMarketplace: fb },
    outperformsOnBothPrimaryMetrics: ready ? ts.connectedCalls > fb.connectedCalls && ts.interestedBuyers > fb.interestedBuyers : null,
    unattributedOrOtherChannelEvents: inScope.filter((e) => !["tradescout", "search", "facebook_marketplace"].includes(e.acquisition.channel)).length,
    unspecifiedMediumEvents: inScope.filter((e) => e.acquisition.medium === "unspecified").length,
    allSourcesObserved: counts(inScope),
    deduplicatedEvents: inScope.length,
  };
}
