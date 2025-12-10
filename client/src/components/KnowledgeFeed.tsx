import React from "react";

export function KnowledgeFeed() {
  return (
    <div className="rounded-xl border border-slate-800 bg-navy-900/80 p-4">
      <h3 className="text-lg font-semibold mb-2 text-white">Live Data Feed</h3>
      <p className="text-sm text-slate-400">
        No live county intel yet. This will display cache summaries and knowledge
        base updates once the crawler runs.
      </p>
    </div>
  );
}
