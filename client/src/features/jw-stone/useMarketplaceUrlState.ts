import { useCallback, useEffect, useState } from "react";
import type { MarketplaceUrlState } from "./types";
import { parseMarketplaceUrlState, toMarketplaceHref } from "./urlState";

const EMPTY_STATE: MarketplaceUrlState = {
  aesthetic: null,
  color: null,
  material: null,
  origin: null,
  stone: null,
};

function readBrowserState(): MarketplaceUrlState {
  if (typeof window === "undefined") return EMPTY_STATE;
  return parseMarketplaceUrlState(window.location.search, undefined, window.location.pathname);
}

export function useMarketplaceUrlState() {
  const [state, setState] = useState<MarketplaceUrlState>(readBrowserState);

  useEffect(() => {
    const canonicalHref = toMarketplaceHref(readBrowserState());
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (currentHref !== canonicalHref) window.history.replaceState(null, "", canonicalHref);
    setState(readBrowserState());

    const handlePopState = () => setState(readBrowserState());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const commit = useCallback((next: MarketplaceUrlState, options?: { replace?: boolean }) => {
    const href = toMarketplaceHref(next);
    if (options?.replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
    setState(readBrowserState());
  }, []);

  return { state, commit };
}
