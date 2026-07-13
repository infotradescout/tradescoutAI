import type { ReactNode } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildDirectConnectRequestCardView,
  type DirectConnectRequestCardLike,
} from "./requestCardPresentation";

export type DirectConnectRequestCardProps = {
  request: DirectConnectRequestCardLike;
  statusLabel?: string;
  summary?: string;
  secondarySummary?: string;
  variant?: "default" | "compact";
  openLabel?: string;
  onOpen?: () => void;
  footer?: ReactNode;
};

export function DirectConnectRequestCard({
  request,
  statusLabel,
  summary,
  secondarySummary,
  variant = "default",
  openLabel = "Open request",
  onOpen,
  footer,
}: DirectConnectRequestCardProps) {
  const view = buildDirectConnectRequestCardView(request, statusLabel);
  const compact = variant === "compact";
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className={`${compact ? "text-xs" : "text-sm"} truncate font-semibold text-[color:var(--text-primary)]`}
          >
            {view.title}
          </h3>
          {(summary || view.description) && (
            <p
              className={`${compact ? "mt-0.5 text-[11px]" : "mt-1 text-xs"} line-clamp-2 text-[color:var(--text-secondary)]`}
            >
              {summary || view.description}
            </p>
          )}
          {secondarySummary && (
            <p className="mt-0.5 text-[11px] text-[color:var(--text-tertiary)]">
              {secondarySummary}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full border border-[color:var(--border-secondary)] bg-[color:var(--surface-intermediate)] px-2 py-1 text-[10px] font-semibold text-[color:var(--text-primary)]">
          {view.statusLabel}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[color:var(--text-tertiary)]">
        <div className="flex flex-wrap items-center gap-2">
          {view.countyLabel && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {view.countyLabel}
            </span>
          )}
          {view.budgetLabel && <span>Budget {view.budgetLabel}</span>}
          <span>Updated {view.updatedLabel}</span>
        </div>
        {onOpen && (
          <span className="inline-flex items-center gap-1 font-medium text-[color:var(--theme-accent-primary)]">
            {openLabel}
            <ArrowUpRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </>
  );

  return (
    <Card
      data-testid={`direct-connect-request-card-${view.id}`}
      className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] transition-colors hover:border-[color:var(--border-active)]"
    >
      <CardContent className={compact ? "p-3" : "p-4"}>
        {onOpen ? (
          <button
            type="button"
            className="w-full text-left"
            onClick={onOpen}
            aria-label={`${openLabel}: ${view.title}`}
          >
            {content}
          </button>
        ) : (
          content
        )}
        {footer && (
          <div className="mt-3 border-t border-[color:var(--border-subtle)] pt-3">{footer}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default DirectConnectRequestCard;
