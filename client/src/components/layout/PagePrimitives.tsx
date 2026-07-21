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
