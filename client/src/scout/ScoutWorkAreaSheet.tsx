import React, { useEffect, useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { titleFromScoutWorkAreaUrl } from "./scoutWorkAreas";

export function ScoutWorkAreaSheet({
  open,
  onOpenChange,
  url,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  title?: string | null;
}) {
  const resolvedTitle = useMemo(
    () => title?.trim() || titleFromScoutWorkAreaUrl(String(url || "")),
    [title, url]
  );

  // Avoid background scroll while the work area is open (mobile ergonomics).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={[
          "w-[96vw] sm:w-[92vw] md:w-[78vw] lg:w-[64vw] xl:w-[56vw]",
          "p-0 overflow-hidden",
        ].join(" ")}
      >
        <div className="flex h-full flex-col bg-[var(--surface-card)]">
          <SheetHeader
            className="border-b px-4 py-3"
            style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-card)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-sm font-semibold text-[var(--text-primary)]">
                {resolvedTitle}
              </SheetTitle>
              <div className="flex items-center gap-2">
                {url ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                    onClick={() => {
                      window.location.href = url;
                    }}
                    title="Open full page"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 bg-[var(--surface-intermediate)]">
            {url ? (
              <iframe
                key={url}
                src={url}
                className="h-full w-full"
                style={{ border: "none" }}
                // Same-origin embed; keep permissive so existing pages work.
                allow="clipboard-read; clipboard-write; geolocation"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm text-slate-300">
                Nothing open.
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
