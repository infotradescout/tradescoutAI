import { useEffect, useRef, useState } from "react";
import {
  readStoneInquiryIntent,
  stoneInquiryMessage,
  stoneInquiryReturnPath,
  type StoneInquiryIntent,
} from "@shared/exchangeStoneBuyerFlow";
import {
  forgetStoneInquiryDraft,
  isStoneRetailListing,
  restoreStoneInquiryDraft,
  saveStoneInquiryDraft,
} from "@shared/exchangeStoneInquiryDraft";

type Listing = {
  id: string;
  title: string;
  price: unknown;
  sourceType?: string;
  specifications?: Record<string, unknown>;
};
type Options = {
  listing?: Listing;
  actorId: string | null;
  isAuthenticated: boolean;
  message: string;
  setMessage: (value: string) => void;
  setOpen: (value: boolean) => void;
  navigate: (path: string) => void;
};

export function useExchangeStoneInquiry(options: Options) {
  const { listing, actorId, isAuthenticated, message, setMessage, setOpen, navigate } = options;
  const [intent, setIntent] = useState<StoneInquiryIntent>("availability");
  const [warning, setWarning] = useState<string | null>(null);
  const [search, setSearch] = useState(() => typeof window === "undefined" ? "" : window.location.search);
  const current = useRef(options);
  current.current = options;
  const prepared = useRef<string | null>(null);
  const previousListingId = useRef<string | null>(null);
  const previousActorId = useRef<string | null>(actorId);
  const priorGeneratedMessage = useRef<string | null>(null);
  const isRetail = isStoneRetailListing(listing);

  useEffect(() => {
    const refresh = () => setSearch(window.location.search);
    window.addEventListener("popstate", refresh);
    return () => window.removeEventListener("popstate", refresh);
  }, []);

  useEffect(() => {
    // Reset before a different listing can reuse this component's previous inquiry.
    const id = listing?.id || null;
    if (previousListingId.current !== id || previousActorId.current !== actorId) {
      previousListingId.current = id;
      previousActorId.current = actorId;
      prepared.current = null;
      priorGeneratedMessage.current = null;
      setMessage("");
      setOpen(false);
      setWarning(null);
      setIntent("availability");
    }
    if (!listing || !isRetail) return;
    const requested = readStoneInquiryIntent(new URLSearchParams(window.location.search).get("inquiry"));
    const preparationKey = `${listing.id}:${requested || ""}:${actorId || "anonymous"}`;
    if (!requested || prepared.current === preparationKey) return;
    prepared.current = preparationKey;
    let restored = null;
    try { restored = restoreStoneInquiryDraft(window.sessionStorage, listing.id, actorId); } catch { /* storage is optional for opening a draft */ }
    const generated = stoneInquiryMessage(listing, requested);
    setIntent(requested);
    setMessage(restored?.intent === requested ? restored.message : generated);
    priorGeneratedMessage.current = generated;
    setOpen(true);
    // Consume a transferred draft once it is safely present in the signed-in form.
    if (restored && isAuthenticated) {
      try { forgetStoneInquiryDraft(window.sessionStorage, listing.id); } catch { /* unavailable storage */ }
    }
  }, [listing?.id, isRetail, actorId, isAuthenticated, search, setMessage, setOpen]);

  function clearQuery() {
    const url = new URL(window.location.href);
    if (readStoneInquiryIntent(url.searchParams.get("inquiry"))) {
      url.searchParams.delete("inquiry");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      setSearch(url.search);
    }
  }

  function prepare(nextIntent: StoneInquiryIntent) {
    if (!listing || !isRetail) return;
    const generated = stoneInquiryMessage(listing, nextIntent);
    if (!message || message === priorGeneratedMessage.current) setMessage(generated);
    priorGeneratedMessage.current = generated;
    setIntent(nextIntent);
    setWarning(null);
    setOpen(true);
  }

  /** Explicit click only: no Decision Card or inquiry is sent while signing in. */
  function continueToSignIn() {
    if (!listing || !isRetail) return;
    let saved = false;
    try { saved = saveStoneInquiryDraft(window.sessionStorage, { listingId: listing.id, intent, message, actorId }); } catch { /* storage may be denied */ }
    if (!saved) {
      setWarning("Your browser could not preserve this message for sign-in. Keep this tab open and sign in in another tab, then return to send it.");
      return;
    }
    const path = stoneInquiryReturnPath(listing.id, intent);
    if (path) navigate(path);
  }

  function finish(submittedListingId?: string) {
    const id = submittedListingId || listing?.id;
    if (!id) return;
    try { forgetStoneInquiryDraft(window.sessionStorage, id); } catch { /* unavailable storage */ }
    if (current.current.listing?.id !== id) return;
    setMessage("");
    setOpen(false);
    setWarning(null);
    prepared.current = null;
    priorGeneratedMessage.current = null;
    clearQuery();
  }

  return { isRetail, intent, warning, prepare, continueToSignIn, finish };
}
