import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  PRODUCT_NAV_GROUPS, getActiveProductNavItem, searchProductNavigation,
} from "@/lib/productNavigation";
import { DIRECT_CONNECT_TASKBAR_RESUME_HREF } from "@/pages/direct-connect/directConnectWorkspaceState";

/** A destination finder, not a search of private customer data or a permissions gate. */
export default function ProductNavigator() {
  const [location] = useLocation();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const open = openedAt === location;
  const results = useMemo(() => searchProductNavigation(query), [query]);
  const active = getActiveProductNavItem(location);

  // Close immediately on a route change, then retire the old route so going back cannot reopen it.
  useEffect(() => setOpenedAt(null), [location]);

  const clearSearch = () => {
    setQuery("");
    searchRef.current?.focus();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpenedAt(value ? location : null);
      setQuery("");
    }}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="all-tradescout-nav"
          className="ts-product-nav-trigger flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2"
          aria-label="Open all TradeScout tools"
        >
          <LayoutGrid className="h-5 w-5" aria-hidden="true" />
          <span className="text-[11px] font-semibold">All tools</span>
        </button>
      </DialogTrigger>
      <DialogContent
        data-ts-core-ui="true"
        data-testid="product-navigator-dialog"
        className="ts-product-nav-dialog max-w-4xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <DialogHeader className="shrink-0 px-5 pt-5 pr-12 text-left sm:px-6 sm:pt-6">
          <DialogTitle className="text-2xl leading-tight text-[color:var(--text-primary)]">
            All TradeScout
          </DialogTitle>
          <DialogDescription className="text-[color:var(--text-secondary)]">
            Find a tool, page, or workspace. Your existing access permissions still apply.
          </DialogDescription>
        </DialogHeader>
        <div className="shrink-0 px-5 pt-4 pb-3 sm:px-6">
          <label htmlFor="tradescout-tool-search" className="sr-only">Search TradeScout tools</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-[color:var(--text-secondary)]" aria-hidden="true" />
            <input
              ref={searchRef}
              id="tradescout-tool-search"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try invoices, HomeID, suppliers, or saved items"
              className="ts-product-nav-search h-12 w-full rounded-lg pl-10 pr-3 text-base placeholder:text-[color:var(--text-secondary)]"
              aria-controls="tradescout-tool-results"
            />
          </div>
          <p role="status" aria-live="polite" aria-atomic="true" className="mt-2 text-xs text-[color:var(--text-secondary)]">
            {results.length} {results.length === 1 ? "destination" : "destinations"}
          </p>
        </div>
        <div id="tradescout-tool-results" className="ts-product-nav-results px-5 pb-5 sm:px-6 sm:pb-6">
          {results.length === 0 ? (
            <div className="rounded-xl bg-[color:var(--surface-intermediate)] p-6">
              <p className="font-semibold">No tools match that search.</p>
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Try a shorter name, or browse all tools.</p>
              <button type="button" onClick={clearSearch} className="ts-product-nav-clear mt-4 min-h-11 rounded-lg px-4 text-sm font-semibold">Clear search</button>
            </div>
          ) : (
            <div className="grid items-start gap-x-5 gap-y-6 sm:grid-cols-2">
              {PRODUCT_NAV_GROUPS.map((group) => {
                const items = results.filter((item) => item.group === group.id);
                if (!items.length) return null;
                return (
                  <section key={group.id} aria-labelledby={`product-group-${group.id}`}>
                    <h3 id={`product-group-${group.id}`} className="mb-2 text-sm font-semibold text-[color:var(--text-primary)]">{group.label}</h3>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.id}
                            href={item.id === "requests" ? DIRECT_CONNECT_TASKBAR_RESUME_HREF : item.href}
                            data-product-nav-id={item.id}
                            aria-current={active?.id === item.id ? "page" : undefined}
                            className="ts-product-nav-link flex min-h-14 items-start gap-3 rounded-lg px-3 py-3"
                            onClick={(event) => {
                              if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) setOpenedAt(null);
                            }}
                          >
                            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-[color:var(--text-primary)]">{item.label}</span>
                              <span className="mt-0.5 block text-xs leading-5 text-[color:var(--text-secondary)]">{item.description}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
