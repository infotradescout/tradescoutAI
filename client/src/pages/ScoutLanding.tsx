import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

function useTypewriter(lines: string[], speedMs = 22, linePauseMs = 450) {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);

  const done = lineIdx >= lines.length;

  useEffect(() => {
    if (done) return;

    const current = lines[lineIdx] ?? "";
    const atLineEnd = charIdx >= current.length;

    const t = window.setTimeout(() => {
      if (!atLineEnd) {
        setCharIdx((c) => c + 1);
        return;
      }
      // pause then next line
      window.setTimeout(() => {
        setLineIdx((i) => i + 1);
        setCharIdx(0);
      }, linePauseMs);
    }, atLineEnd ? linePauseMs : speedMs);

    return () => window.clearTimeout(t);
  }, [lines, speedMs, linePauseMs, lineIdx, charIdx, done]);

  const rendered = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < Math.min(lineIdx, lines.length); i++) out.push(lines[i]);
    if (!done && lineIdx < lines.length) {
      const current = lines[lineIdx] ?? "";
      out.push(current.slice(0, Math.min(charIdx, current.length)));
    }
    return out;
  }, [lines, lineIdx, charIdx, done]);

  return { rendered, done };
}

export default function ScoutLanding() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  // If they're logged in, keep Scout as controller.
  useEffect(() => {
    if (!isLoading && user) setLocation("/scout");
  }, [isLoading, user, setLocation]);

  const introLines = useMemo(
    () => [
      "TradeScout is your local operating system.",
      "Ask for pros, projects, community intel, or Exchange deals.",
      "You can keep using Scout as a guest — until you try a locked feature.",
    ],
    []
  );

  const { rendered, done } = useTypewriter(introLines, 18, 500);

  // For guests: after the intro finishes, hand off fully to ScoutOS
  // by navigating to /scout instead of stacking ScoutOS under the hero.
  useEffect(() => {
    if (!isLoading && !user && done) {
      setLocation("/scout");
    }
  }, [done, isLoading, user, setLocation]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Guest intro animation */}
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-6">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <div className="text-xs tracking-widest text-orange-400">TRADE SCOUT</div>
          <div className="mt-1 text-2xl font-semibold">Connection Without Compromise</div>

          <div className="mt-4 space-y-2 text-slate-300">
            {rendered.map((l, i) => (
              <div key={i} className="leading-relaxed">
                {l}
                {i === rendered.length - 1 && !done ? (
                  <span className="ml-1 inline-block w-[8px] animate-pulse">▍</span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400"
              onClick={() => setLocation("/register")}
            >
              Create your free account
            </button>
            <button
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              onClick={() => setLocation("/login")}
            >
              Sign in
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
