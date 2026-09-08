import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  scope?: "section" | "page";
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  action,
  scope = "section",
}: EmptyStateProps) {
  if (scope === "page") {
    return (
      <div className="flex items-center justify-center bg-tsBg text-white px-4 py-24">
        <Card className="max-w-xl w-full bg-tsCard/80 border-white/10">
          <CardContent className="py-10 flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-tsCard flex items-center justify-center">
              {icon ?? <Inbox className="h-6 w-6 text-white/70" />}
            </div>
            <div>
              <p className="text-lg font-semibold">{title}</p>
              {description && <p className="text-white/60 mt-1">{description}</p>}
            </div>
            {action ? <div>{action}</div> : null}
            {!action && actionLabel && onAction ? (
              <Button onClick={onAction}>{actionLabel}</Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-12 text-center">
      {icon && <div className="mb-4 text-primary">{icon}</div>}

      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}

      {action ? <div className="mt-4">{action}</div> : null}
      {!action && actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorState({
  icon,
  title,
  description,
  actionLabel = "Go back",
  onAction,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-12 text-center">
      {icon && <div className="mb-4 text-destructive">{icon}</div>}

      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}

      {onAction && (
        <Button variant="outline" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return <div className={`animate-pulse rounded-md bg-muted/50 ${className ?? ""}`} />;
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 w-full animate-pulse rounded-md bg-muted/50" />
      ))}
    </div>
  );
}

interface LoadingGateProps {
  isLoading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}

export function LoadingGate({ isLoading, skeleton, children }: LoadingGateProps) {
  if (isLoading) return <>{skeleton}</>;
  return <>{children}</>;
}
