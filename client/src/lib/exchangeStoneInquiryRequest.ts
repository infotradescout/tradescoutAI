/** Retry identity belongs to the exact actor/listing/message/intent, not a click or render. */
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Api = (method: string, path: string, body: any) => Promise<any>;
export type StoneRequest = { actorId: string; listingId: string; title: string; message: string; inquiryIntent: "availability" | "callback" };
type Prepared = { fingerprint: string; requestKey: string; decisionId: string | null; expires: number };
const prefix = "ts:stone:submission:v1:";
const memory = new Map<string, Prepared>();

async function fingerprint(request: StoneRequest): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([request.actorId, request.listingId, request.message, request.inquiryIntent]));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), value => value.toString(16).padStart(2, "0")).join("");
}

/** The caller supplies the existing protected API client; this adds no contact bypass.
 * A request is retained until the caller has a saved receipt. Merely creating a card is not success.
 */
export async function sendStoneInquiryRequest(
  api: Api, store: Store | null, request: StoneRequest, actorIsCurrent: () => boolean
): Promise<any> {
  if (!request.actorId || !/^tradescout-stone-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.listingId) ||
      !request.message.trim() || request.message.length > 4000 || !["availability", "callback"].includes(request.inquiryIntent))
    throw new Error("Review the selected stone and message before sending.");
  const key = `${prefix}${request.actorId}:${request.listingId}`;
  const hash = await fingerprint(request);
  let saved = memory.get(key);
  let persistent = false;
  try {
    const text = store?.getItem(key);
    if (text && text.length < 1500) {
      const candidate = JSON.parse(text);
      if (candidate.fingerprint === hash && candidate.expires > Date.now() && candidate.expires <= Date.now() + 86400000 &&
          /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(candidate.requestKey) &&
          (candidate.decisionId === null || /^[a-zA-Z0-9_:.-]{1,160}$/.test(candidate.decisionId))) saved = candidate;
    }
  } catch { /* Denied storage uses server-side legacy replay protection, not a fresh durable UUID. */ }
  if (!saved || saved.fingerprint !== hash || saved.expires <= Date.now())
    saved = { fingerprint: hash, requestKey: crypto.randomUUID(), decisionId: null, expires: Date.now() + 86400000 };
  const pending = saved;
  memory.set(key, pending);
  const persist = () => {
    try { if (store) { store.setItem(key, JSON.stringify(pending)); persistent = store.getItem(key) === JSON.stringify(pending); } }
    catch { persistent = false; }
  };
  persist();
  const scope = `marketplace_listing:${request.listingId}`;
  if (!actorIsCurrent()) throw new Error("Your account changed. Review the request again.");
  if (!pending.decisionId) {
    const card = await api("POST", "/api/decision-cards", { intent: "collaborate", decisionScope: scope,
      title: `Exchange inquiry: ${request.title}`, description: `Review a protected in-platform inquiry about ${request.title}.` });
    const id = typeof card?.id === "string" ? card.id.trim() : "";
    if (!/^[a-zA-Z0-9_:.-]{1,160}$/.test(id)) throw new Error("Decision Card creation could not be confirmed.");
    pending.decisionId = id;
    persist();
  }
  if (!actorIsCurrent()) throw new Error("Your account changed. Review the request again.");
  const receipt = await api("POST", "/api/marketplace/inquiries", {
    listingId: request.listingId, message: request.message, inquiryIntent: request.inquiryIntent,
    authorityGate: "decision_card", sourceDecisionCardId: pending.decisionId, decisionScope: scope,
    ...(persistent ? { requestKey: pending.requestKey } : {}),
  });
  if (!receipt || typeof receipt.id !== "string" || receipt.listingId !== request.listingId || typeof receipt.conversationId !== "string")
    throw new Error("Delivery could not be confirmed. Your request identity was retained for retry.");
  // A delayed successful response cannot clear a newer message/account's pending request.
  if (memory.get(key)?.requestKey === pending.requestKey) memory.delete(key);
  try {
    const current = JSON.parse(store?.getItem(key) || "null");
    if (current?.requestKey === pending.requestKey) store?.removeItem(key);
  } catch { /* The saved server receipt remains replayable even if local cleanup is denied. */ }
  return receipt;
}
