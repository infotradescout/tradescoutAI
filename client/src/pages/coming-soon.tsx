import React from "react";
import { Link } from "wouter";

const ComingSoon: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/30 p-10 shadow-2xl shadow-orange-500/20 backdrop-blur">
        <div className="inline-flex items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ts-orange">
          This feature is currently under construction
        </div>
        <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
          The full TradeScout experience is under construction
        </h1>
        <p className="mt-3 text-base text-white/60">
          Scout is live today to guide you. The broader site features are being wired in behind the scenes. In the meantime, use Scout to navigate, plan, and log what you need.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-ts-orange px-4 py-2 text-sm font-semibold text-black shadow-md shadow-orange-500/30 transition hover:-translate-y-px hover:shadow-orange-500/50"
          >
            Return to Scout
          </Link>
          <a
            href="/help"
            className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-tsCard"
          >
            Visit help center
          </a>
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;
