import React from "react";
import { Card } from "@/components/ui/card";
import { Bot, Radar, Search, ShieldCheck } from "lucide-react";

export const ScoutHasDonePanel: React.FC = () => {
  return (
    <Card
      className="p-3 md:p-4 h-full flex flex-col gap-3"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "color-mix(in oklab, var(--surface-card) 90%, transparent)",
      }}
    >
      <div
        className="rounded-lg border px-3 py-2"
        style={{
          borderColor: "var(--border-subtle)",
          backgroundColor: "color-mix(in oklab, var(--surface-intermediate) 90%, transparent)",
        }}
      >
        <div
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--theme-accent-primary)" }}
        >
          <Bot className="h-3.5 w-3.5" />
          What happens next
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Scout keeps search, saved requests, and safe contact steps connected.
        </p>
      </div>

      <div className="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <div
          className="rounded-md border px-2 py-2"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "color-mix(in oklab, var(--surface-card) 92%, transparent)",
          }}
        >
          <div
            className="inline-flex items-center gap-1.5 font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--theme-accent-primary)" }} />
            Request saved
          </div>
          <p className="mt-0.5 text-[11px]">
            If you create a request, Scout keeps it saved so you can review it later.
          </p>
        </div>

        <div
          className="rounded-md border px-2 py-2"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "color-mix(in oklab, var(--surface-card) 92%, transparent)",
          }}
        >
          <div
            className="inline-flex items-center gap-1.5 font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            <Radar className="h-3.5 w-3.5" style={{ color: "var(--theme-accent-primary)" }} />
            Local match check
          </div>
          <p className="mt-0.5 text-[11px]">
            Scout can compare your request against nearby people, posts, services, and updates.
          </p>
        </div>

        <div
          className="rounded-md border px-2 py-2"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "color-mix(in oklab, var(--surface-card) 92%, transparent)",
          }}
        >
          <div
            className="inline-flex items-center gap-1.5 font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            <Search className="h-3.5 w-3.5" style={{ color: "var(--theme-accent-primary)" }} />
            Share when ready
          </div>
          <p className="mt-0.5 text-[11px]">Contact when you are ready to start a real request.</p>
        </div>
      </div>

      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        Scout shows what to review first, then you can save, continue, or contact.
      </p>
    </Card>
  );
};
