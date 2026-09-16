import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import type { ScoutWorkKind, ScoutWorkOverview } from "@shared/scoutWork";
import { ScoutRequestContinueButton } from "./ScoutRequestContinueButton";

const workKinds: Array<{ value: "all" | ScoutWorkKind; label: string }> = [
  { value: "all", label: "All work" },
  { value: "requests", label: "Local requests" },
  { value: "supply_runs", label: "Supply runs" },
  { value: "home_projects", label: "Home projects" },
  { value: "scout_actions", label: "Scout actions" },
];
const fieldClass = "min-h-11 w-full rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-3 py-2 text-sm text-[color:var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ts-orange";
const linkClass = "inline-flex min-h-11 items-center rounded-lg px-2 py-2 text-sm font-semibold text-ts-orange underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function displayDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
}

export function ScoutWorkList({ overview, filter = "all", query = "", attentionOnly = false, onPromptSelect }: {
  overview: ScoutWorkOverview; filter?: "all" | ScoutWorkKind; query?: string; attentionOnly?: boolean;
  onPromptSelect?: (prompt: string) => void;
}) {
  const needle = query.trim().toLocaleLowerCase();
  return <div className="space-y-4" data-testid="scout-work-sections">
    {overview.sections.filter((section) => filter === "all" || section.kind === filter).map((section) => {
      const items = section.items.filter((item) =>
        (!attentionOnly || item.state === "attention" || item.state === "unknown") &&
        (!needle || `${item.title} ${item.statusLabel}`.toLocaleLowerCase().includes(needle))
      );
      return <section key={section.kind} aria-label={section.label} className="min-w-0 rounded-xl border border-[color:var(--border-subtle)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{section.label}</h3>
          <Link href={section.workspace} className={linkClass}>Open workspace</Link>
        </div>
        {section.availability === "unavailable" ? <p role="status" className="text-sm text-[color:var(--text-muted)]">This area could not be loaded. Refresh to check it again.</p> :
          items.length === 0 ? <p className="text-sm text-[color:var(--text-muted)]">{
            section.items.length === 0 ? "No recent items were found in this area." : "No recent items match these filters."
          }</p> : <ul className="space-y-3">
            {items.map((item) => <li key={`${item.kind}:${item.id}`} data-testid="scout-work-item" className="min-w-0 border-t border-[color:var(--border-subtle)] pt-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 break-words text-sm font-medium text-[color:var(--text-primary)]">{item.title}</p>
                <span className="rounded-md bg-[color:var(--surface-intermediate)] px-2 py-1 text-xs text-[color:var(--text-secondary)]">{item.statusLabel}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-muted)]">{item.detail}</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
                {displayDate(item.updatedAt) ? <time dateTime={item.updatedAt!} className="text-xs text-[color:var(--text-muted)]">Updated {displayDate(item.updatedAt)}</time> : <span className="text-xs text-[color:var(--text-muted)]">Update time unavailable</span>}
                <Link href={item.nextAction.to} className={linkClass}>{item.nextAction.label}</Link>
              </div>
              {item.kind === "requests" && onPromptSelect && <ScoutRequestContinueButton requestId={item.id} onPromptSelect={onPromptSelect} />}
            </li>)}
          </ul>}
        {section.hasMore && section.availability === "ready" && <p className="mt-2 text-xs text-[color:var(--text-muted)]">More items are available in this workspace.</p>}
      </section>;
    })}
  </div>;
}

export function ScoutWorkPanel({ onPromptSelect }: { onPromptSelect?: (prompt: string) => void } = {}) {
  const { user, isAuthenticated } = useAuth();
  const ownerId = isAuthenticated && typeof user?.id === "string" ? user.id : null;
  const [filter, setFilter] = useState<"all" | ScoutWorkKind>("all");
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const inputId = useId();
  const work = useQuery<ScoutWorkOverview>({
    queryKey: ["/api/scout/work", ownerId],
    enabled: Boolean(ownerId),
    staleTime: 15_000,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/scout/work", { credentials: "include", cache: "no-store", signal });
      if (!response.ok) throw new Error("Work status unavailable");
      const data = await response.json() as ScoutWorkOverview;
      if (data.contractVersion !== "scout_work.v1" || data.ownerId !== ownerId || !Array.isArray(data.sections)) {
        throw new Error("Work status unavailable");
      }
      return data;
    },
  });
  const overview = ownerId && !work.isError && work.data?.ownerId === ownerId ? work.data : null;
  return <section aria-label="Continue your work" data-testid="scout-work-panel" className="my-4 min-w-0 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-3 md:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-[color:var(--text-primary)]">Continue your work</h2>
      {ownerId && <button type="button" disabled={work.isFetching} onClick={() => void work.refetch()} className={linkClass} aria-label="Refresh work status">{work.isFetching ? "Checking…" : "Refresh status"}</button>}
    </div>
    <p className="mb-3 text-sm text-[color:var(--text-muted)]">Your requests, materials, home projects, and Scout action results. Opening an item does not send, approve, or pay for anything.</p>
    {!ownerId ? <Link href="/pre-scout-setup?mode=signin&next=%2Fscout" className={linkClass}>Sign in to see your saved work</Link> : <>
      <div className="mb-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <div><label htmlFor={`${inputId}-search`} className="mb-1 block text-xs text-[color:var(--text-muted)]">Search recent work</label><input id={`${inputId}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={fieldClass} /></div>
        <div><label htmlFor={`${inputId}-area`} className="mb-1 block text-xs text-[color:var(--text-muted)]">Work area</label><select id={`${inputId}-area`} value={filter} onChange={(event) => setFilter(event.target.value as "all" | ScoutWorkKind)} className={fieldClass}>{workKinds.map((kind) => <option value={kind.value} key={kind.value}>{kind.label}</option>)}</select></div>
      </div>
      <label className="mb-3 flex min-h-11 items-center gap-2 text-sm text-[color:var(--text-secondary)]"><input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} />Needs review only</label>
      {work.isPending && <p role="status" className="text-sm text-[color:var(--text-muted)]">Loading your saved work…</p>}
      {work.isError && <p role="alert" className="text-sm text-[color:var(--text-muted)]">Your work status could not be loaded. Refresh to check again; no action has been repeated.</p>}
      {overview && <>
        {overview.partial && <p role="status" className="mb-3 text-sm text-[color:var(--text-muted)]">Some work areas are unavailable. The other areas are shown below.</p>}
        <ScoutWorkList overview={overview} filter={filter} query={query} attentionOnly={attentionOnly} onPromptSelect={onPromptSelect} />
        <p className="mt-3 text-xs text-[color:var(--text-muted)]">Showing up to eight recent items per area, not your complete history. {displayDate(overview.checkedAt) ? `Checked ${displayDate(overview.checkedAt)}.` : ""}</p>
      </>}
      <nav aria-label="Start new work" className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--border-subtle)] pt-2">
        <Link href="/direct-connect?source=scout" className={linkClass}>Start a local request</Link>
        <Link href="/utilities/supply-run/new" className={linkClass}>Plan a supply run</Link>
        <Link href="/homes" className={linkClass}>Open Home Vault</Link>
      </nav>
    </>}
  </section>;
}
