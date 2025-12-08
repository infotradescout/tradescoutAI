import React from 'react';
import { Link } from 'wouter';

const ComingSoon: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-tsBorder bg-slate-900/80 p-10 shadow-2xl shadow-orange-500/20 backdrop-blur">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-300">
          This feature is currently under construction
        </div>
        <h1 className="mt-4 text-3xl font-bold text-tsTextMain sm:text-4xl">
          The full TradeScout experience is under construction
        </h1>
        <p className="mt-3 text-base text-tsTextMuted">
          Scout is live today to guide you. The broader site features are actively being built. In the meantime, use Scout to navigate, plan, and log what you need.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/">
            <a className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/40 transition hover:translate-y-[-1px] hover:shadow-orange-500/50">
              Return to Scout
            </a>
          </Link>
          <a
            className="inline-flex items-center justify-center rounded-lg border border-tsBorder px-4 py-2 text-sm font-semibold text-tsTextMain transition hover:border-orange-400 hover:text-orange-200"
            href="mailto:support@tradescout.ai?subject=Notify%20me%20when%20features%20launch"
          >
            Notify me when ready
          </a>
        </div>
        <p className="mt-4 text-xs text-tsTextMuted">
          Have a request? Ask Scout and we will prioritize it.
        </p>
      </div>
    </div>
  );
};

export default ComingSoon;
