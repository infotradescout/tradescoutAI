import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminWorkspace({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1680px] space-y-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function AdminWorkspaceSubnav({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky top-[4.5rem] z-20 -mx-4 border-b border-white/10 bg-[#090a0b]/95 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-white/10 pt-5", className)}>
      {title || description || actions ? (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-white">{title}</h2> : null}
            {description ? (
              <div className="mt-1 max-w-3xl text-sm leading-6 text-white/55">{description}</div>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AdminSummaryStrip({
  items,
  className,
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    detail?: ReactNode;
    tone?: "neutral" | "good" | "warning" | "danger";
  }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid overflow-hidden border-y border-white/10 bg-white/[0.025] sm:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {items.map((item, index) => {
        const toneClass =
          item.tone === "good"
            ? "text-emerald-300"
            : item.tone === "warning"
              ? "text-amber-200"
              : item.tone === "danger"
                ? "text-red-300"
                : "text-white";
        return (
          <div
            key={`${item.label}-${index}`}
            className="border-b border-white/10 px-4 py-4 last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38">
              {item.label}
            </p>
            <div className={cn("mt-2 text-2xl font-semibold", toneClass)}>{item.value}</div>
            {item.detail ? (
              <div className="mt-1 text-xs leading-5 text-white/45">{item.detail}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function AdminToolbar({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-y border-white/10 bg-white/[0.018] px-3 py-3 md:flex-row md:items-center md:justify-between",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AdminList({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("divide-y divide-white/10 border-y border-white/10", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-y border-dashed border-white/15 px-4 py-12 text-center">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description ? (
        <div className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-white/50">{description}</div>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
