import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("ts-page w-full max-w-full space-y-4", className)}>{children}</div>;
}

export function Section({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("ts-page-section space-y-3", className)}>
      {(title || subtitle || actions) && (
        <div className="ts-page-section-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{subtitle}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "ts-page-card card-interactive rounded-lg border border-[color:var(--surface-card-border)] bg-[color:var(--surface-card)] shadow-[var(--surface-card-shadow)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 pt-4 pb-3 sm:px-5 sm:pt-5", className)}>{children}</div>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 pb-4 sm:px-5 sm:pb-5", className)}>{children}</div>;
}
