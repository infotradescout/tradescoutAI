import type { ComponentProps } from "react";
import { useLocation, useSearch } from "wouter";
import { EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME } from "@shared/exchangeListingRules";
import { SEOHelmet as BaseSEOHelmet } from "./SEOHelmetBase";
export * from "./SEOHelmetBase";

/** The public Exchange directory policy is shared across legacy category components. */
export function publicExchangeDirectoryCanonical(pathname: string, search: string, hostname: string): string | null {
  if (!["www.thetradescout.com", "thetradescout.com", "tradescoutai.onrender.com", "localhost", "127.0.0.1"].includes(hostname)) return null;
  const match = /^\/exchange(?:\/([a-z-]+))?\/?$/.exec(pathname);
  if (!match || match[1] && !Object.hasOwn(EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME, match[1])) return null;
  const params = new URLSearchParams(search);
  if (["item", "promo", "companyPromo", "tab"].some(key => params.has(key))) return null;
  const pages = params.getAll("page");
  if (pages.length > 1 || pages.length === 1 && !/^[1-9]\d{0,5}$/.test(pages[0])) return null;
  const page = pages[0] || "1";
  const base = match[1] ? `/exchange/${match[1]}` : "/exchange";
  return `https://www.thetradescout.com${base}${page === "1" ? "" : `?page=${page}`}`;
}

export function SEOHelmet(props: ComponentProps<typeof BaseSEOHelmet>) {
  const [pathname] = useLocation();
  const search = useSearch();
  const canonical = publicExchangeDirectoryCanonical(pathname, search, typeof window === "undefined" ? "" : window.location.hostname);
  // Only actual public directory paths override stale legacy noIndex flags.
  // Private seller workspaces, modal/query action states and unavailable detail pages retain their own directives.
  return <BaseSEOHelmet {...props} {...(canonical ? { canonical, noIndex: false, robots: "index, follow" as const, omitCanonical: false, preserveCanonicalQuery: true } : {})} />;
}
