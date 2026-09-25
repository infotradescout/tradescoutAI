import React from "react";
import { Card } from "@/components/ui/card";
import { Bot, Radar, Search, ShieldCheck } from "lucide-react";
import { ScoutWorkPanel } from "./ScoutWorkPanel";

export const ScoutHasDonePanel: React.FC = () => {
  return (
    <>
      <ScoutWorkPanel />
      <details>
        <summary className="min-h-11 cursor-pointer rounded-lg px-2 py-3 text-sm font-medium text-[color:var(--text-secondary)]">How Scout handles next steps</summary>
        <Card
          className="p-3 md:p-4 h-full flex flex-col gap-3"
          style={{ borderColor: "var(--border-subtle)", backgroundColor: "color-mix(in oklab, var(--surface-card) 90%, transparent)" }}
        >
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-subtle)", backgroundColor: "color-mix(in oklab, var(--surface-intermediate) 90%, transparent)" }}>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--theme-accent-primary)" }}>
              <Bot className="h-3.5 w-3.5" />What happens next
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>Scout shows public county results and lets you review a request before you send it.</p>
          </div>
          <div className="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <div className="rounded-md border px-2 py-2" style={{ borderColor: "var(--border-subtle)", backgroundColor: "color-mix(in oklab, var(--surface-card) 92%, transparent)" }}>
              <div className="inline-flex items-center gap-1.5 font-medium" style={{ color: "var(--text-primary)" }}>
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--theme-accent-primary)" }} />Review first
              </div>
              <p className="mt-0.5 text-[11px]">Scout can carry your search into the request form. It does not send the request.</p>
            </div>
            <div className="rounded-md border px-2 py-2" style={{ borderColor: "var(--border-subtle)", backgroundColor: "color-mix(in oklab, var(--surface-card) 92%, transparent)" }}>
              <div className="inline-flex items-center gap-1.5 font-medium" style={{ color: "var(--text-primary)" }}>
                <Radar className="h-3.5 w-3.5" style={{ color: "var(--theme-accent-primary)" }} />Local results
              </div>
              <p className="mt-0.5 text-[11px]">See the public county matches Scout checked and which sources are still unverified.</p>
            </div>
            <div className="rounded-md border px-2 py-2" style={{ borderColor: "var(--border-subtle)", backgroundColor: "color-mix(in oklab, var(--surface-card) 92%, transparent)" }}>
              <div className="inline-flex items-center gap-1.5 font-medium" style={{ color: "var(--text-primary)" }}>
                <Search className="h-3.5 w-3.5" style={{ color: "var(--theme-accent-primary)" }} />Share when ready
              </div>
              <p className="mt-0.5 text-[11px]">The request form lets you review the details and choose when to send.</p>
            </div>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>You can keep browsing before starting a request.</p>
        </Card>
      </details>
    </>
  );
};
