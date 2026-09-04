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
  const content = (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-12 text-center">
      {icon ? <div className="mb-4 text-primary">{icon}</div> : null}

      <h3 className="text-lg font-semibold text-foreground">{title}</h3>

      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}

      {action ? <div className="mt-4">{action}</div> : null}
      {!action && actionLabel && onAction ? (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );

  if (scope === "page") {
    return (
      <div className="flex items-center justify-center bg-tsBg px-4 py-24 text-white">
        <Card className="w-full max-w-xl border-white/10 bg-tsCard/80">
          <CardContent className="flex flex-col items-center space-y-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tsCard">
              {icon ?? <Inbox className="h-6 w-6 text-white/70" />}
            </div>
            <div>
              <p className="text-lg font-semibold">{title}</p>
              {description ? <p className="mt-1 text-white/60">{description}</p> : null}
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

  return content;
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
