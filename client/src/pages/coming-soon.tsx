import React from "react";
import { Link } from "wouter";

const ComingSoon: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950/80 p-10 shadow-2xl shadow-orange-500/20 backdrop-blur">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-300">
          This feature is currently under construction
        </div>
        <h1 className="mt-4 text-3xl font-bold text-tsTextMain sm:text-4xl">
          The full TradeScout experience is under construction
        </h1>
        <p className="mt-3 text-base text-tsTextMuted">
          Scout is live today to guide you. The broader site features are being wired in behind the scenes. In the meantime, use Scout to navigate, plan, and log what you need.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-black shadow-md shadow-orange-500/30 transition hover:-translate-y-px hover:shadow-orange-500/50"
          >
            Return to Scout
          </Link>
          <a
            href="/help"
            className="inline-flex items-center justify-center rounded-full border border-tsBorder px-4 py-2 text-sm font-semibold text-tsTextMain hover:bg-slate-900"
          >
            Visit help center
          </a>
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;
