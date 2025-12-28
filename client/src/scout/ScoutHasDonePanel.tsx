import React from "react";
import { Card } from "@/components/ui/card";

export const ScoutHasDonePanel: React.FC = () => {
  return (
    <Card className="bg-slate-900/80 border-slate-800 p-3 md:p-4 h-full flex flex-col">
      <div className="mb-2">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          What Scout Has Already Done
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          When you start coordination in Direct Connect, Scout quietly does a few things for you by default.
        </p>
      </div>

      <div className="mt-2 space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <div className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2">
          <div className="font-medium" style={{ color: "var(--text-primary)" }}>
            Added to Direct Connect
          </div>
          <p className="mt-0.5 text-[11px]">
            Each request you start lives on your Direct Connect board while coordination happens.
          </p>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2">
          <div className="font-medium" style={{ color: "var(--text-primary)" }}>
            Routed through your community
          </div>
          <p className="mt-0.5 text-[11px]">
            Scout can surface your requests to people in your community where that&apos;s enabled, so more of the right eyes see it.
          </p>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-2">
          <div className="font-medium" style={{ color: "var(--text-primary)" }}>
            Notified local providers (where available)
          </div>
          <p className="mt-0.5 text-[11px]">
            When available, Scout notifies local providers that your request needs attention so they can decide whether to respond.
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Scout explains what&apos;s happening, but Direct Connect stays in charge of the actual coordination.
      </p>
    </Card>
  );
};
