import React from "react";
import { Card } from "@/components/ui/card";
import { Bot, Radar, Send, ShieldCheck } from "lucide-react";

export const ScoutHasDonePanel: React.FC = () => {
  return (
    <Card className="bg-slate-900/80 border-slate-800 p-3 md:p-4 h-full flex flex-col gap-3">
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-300">
          <Bot className="h-3.5 w-3.5" />
          Automation Layer
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          What Scout handles in the background once you post a Direct Connect request.
        </p>
      </div>

      <div className="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <div className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2">
          <div
            className="inline-flex items-center gap-1.5 font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-orange-300" />
            Request staged
          </div>
          <p className="mt-0.5 text-[11px]">
            Every request is anchored to your Direct Connect board so status never gets lost.
          </p>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2">
          <div
            className="inline-flex items-center gap-1.5 font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            <Radar className="h-3.5 w-3.5 text-orange-300" />
            Local signal pass
          </div>
          <p className="mt-0.5 text-[11px]">
            Where enabled, Scout surfaces the request to relevant local signals.
          </p>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2">
          <div
            className="inline-flex items-center gap-1.5 font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            <Send className="h-3.5 w-3.5 text-orange-300" />
            Provider notifications
          </div>
          <p className="mt-0.5 text-[11px]">
            Eligible local providers are notified so they can choose whether to respond.
          </p>
        </div>
      </div>

      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Scout provides context and automation. Direct Connect remains the source of truth.
      </p>
    </Card>
  );
};
