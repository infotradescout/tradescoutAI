import { useCallback, useEffect, useState } from "react";
import type { MarketplaceUrlState } from "./types";
import {
  parseMarketplaceUrlState,
  serializeMarketplaceUrlState,
  toMarketplaceHref,
} from "./urlState";

const EMPTY_STATE: MarketplaceUrlState = {
  aesthetic: null,
  color: null,
  material: null,
  origin: null,
  stone: null,
};

function readBrowserState(): MarketplaceUrlState {
  return typeof window === "undefined"
    ? EMPTY_STATE
    : parseMarketplaceUrlState(window.location.search);
}

export function useMarketplaceUrlState() {
  const [state, setState] = useState<MarketplaceUrlState>(readBrowserState);

  useEffect(() => {
    const canonicalHref = toMarketplaceHref(readBrowserState());
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (currentHref !== canonicalHref) window.history.replaceState(null, "", canonicalHref);

    const handlePopState = () => setState(readBrowserState());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const commit = useCallback((next: MarketplaceUrlState, options?: { replace?: boolean }) => {
    const safe = parseMarketplaceUrlState(serializeMarketplaceUrlState(next));
    const href = toMarketplaceHref(safe);
    if (options?.replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
    setState(safe);
  }, []);

  return { state, commit };
}
