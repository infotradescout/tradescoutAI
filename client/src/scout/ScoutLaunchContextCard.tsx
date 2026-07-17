import { ArrowUpRight, Layers3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScoutLaunchContext } from "@shared/scoutLaunchContext";

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function contextLabel(context: ScoutLaunchContext): string {
  if (context.source === "scout_resume") return "your recent Scout work";
  switch (context.contextType) {
    case "home_listing":
      return "HomeScout listing";
    case "community_post":
      return "Community post";
    case "trade_deal":
      return "TradeDeal";
    case "business_profile":
      return "Business profile";
    case "map_entity":
      return context.entityType ? `${titleCase(context.entityType)} map result` : "Map result";
    case "county":
      return context.county || "Local county view";
    case "trade":
      return context.trade ? `${titleCase(context.trade)} search` : "Trade search";
    case "access_review":
      return "Access review";
    default:
      return context.intent ? `${titleCase(context.intent)} next step` : "Previous view";
  }
}

function contextDetails(context: ScoutLaunchContext): string | null {
  const parts = [
    context.city,
    context.county,
    context.state,
    context.trade ? titleCase(context.trade) : undefined,
  ].filter(
    (part, index, values): part is string => Boolean(part) && values.indexOf(part) === index
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function ScoutLaunchContextCard({
  context,
  returnPath,
  onOpenOriginal,
  onClear,
}: {
  context: ScoutLaunchContext;
  returnPath?: string;
  onOpenOriginal: () => void;
  onClear: () => void;
}) {
  const details = contextDetails(context);

  return (
    <section
      aria-label="Shared context from your previous view"
      className="mb-3 rounded-2xl border border-ts-orange/25 bg-ts-orange/[0.06] px-4 py-3 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-ts-orange/15 p-2 text-ts-orange" aria-hidden="true">
          <Layers3 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ts-orange">
            Shared context
          </div>
          <div className="mt-0.5 text-sm font-semibold text-[color:var(--text-primary)]">
            Working from {contextLabel(context)}
          </div>
          {details ? (
            <div className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">{details}</div>
          ) : null}
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--text-muted)]">
            This stays attached while you compare options and choose your next step.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 rounded-full"
          onClick={onClear}
          aria-label="Clear shared context"
          title="Clear shared context"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {returnPath ? (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full px-3 text-xs"
            onClick={onOpenOriginal}
          >
            Open original view
            <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
