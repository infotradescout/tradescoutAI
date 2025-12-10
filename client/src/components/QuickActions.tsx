import React from "react";
import { Button } from "@/components/ui/button";

const presets = [
  "Find roofers available this week",
  "Start the Community Builder for my county",
  "Show me today’s best tool deals",
  "Message the top 3 electricians near me",
  "Create a project for kitchen remodel",
  "List my pressure washer for $250",
  "Find food trucks near me tonight",
];

export function QuickActions() {
  return (
    <div className="rounded-xl border border-slate-800 bg-navy-900/80 p-4">
      <h3 className="text-lg font-semibold mb-3 text-white">Popular requests</h3>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button
            key={p}
            variant="secondary"
            size="sm"
            className="text-xs"
            type="button"
          >
            {p}
          </Button>
        ))}
      </div>
    </div>
  );
}
