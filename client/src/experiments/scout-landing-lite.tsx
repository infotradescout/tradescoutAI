import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLocation, Link } from "wouter";
import AppDrawer from "../components/AppDrawer";
import { useIsMobile } from "../hooks/useIsMobile";
import { Home, Send } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const apiBaseEnv = (import.meta as any).env?.VITE_SCOUT_API_BASE;

const isLocalHost = () => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
};

// Match the production/local behavior from the full scout landing
const apiBase =
  apiBaseEnv ||
  ((typeof window !== "undefined" && !isLocalHost()
    ? "https://www.thetradescout.com/api"
    : "/api"));

const scoutEndpoint = `${apiBase.replace(/\/$/, "")}/scout`;

export default function ScoutLandingLite() {
  const { user, isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [appDrawerOpen, setAppDrawerOpen] = useState(false);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(scoutEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          hyperlocalPricing: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.message || "Scout replied, but no message was returned.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const assistantMsg: Message = {
        id: `e-${Date.now()}`,
        role: "assistant",
        content:
          "Sorry, I hit an error talking to Scout. Please try again in a moment.",
      };
      console.error("[Scout-lite] error", err);
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <React.Fragment>
      <div className="min-h-screen bg-[#060b1c] text-white flex items-start justify-center px-3 sm:px-4 pb-10">
        <div className="relative w-full max-w-6xl pt-6 pb-10">
          {/* Simple top bar */}
          <div className="flex items-center justify-between mb-6">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              onClick={() => navigate("/")}
            >
              <Home className="w-4 h-4 text-orange-400" />
              <span className="font-semibold tracking-wide">TradeScout</span>
            </button>
            <button
              className="rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
              onClick={() => setAppDrawerOpen(true)}
            >
              Browse apps
            </button>
          </div>

          {/* Hero */}
          <div className="mb-6 space-y-3">
            <div className="inline-flex items-center rounded-full bg-slate-900/80 border border-slate-700 px-3 py-1 text-xs text-slate-300 mb-2">
              <span className="mr-1 text-orange-400">●</span>
              Scout is your community OS
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
              Ask Scout. Ship work. <span className="text-orange-400">Locally.</span>
            </h1>
            <p className="text-slate-300 max-w-2xl text-sm sm:text-base">
              Tell Scout what you want for your home, HOA, or business.
              Scout will search local context, call TradeScout tools, and hand
              you links into the right pages.
            </p>
          </div>

          {/* Chat panel */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl shadow-xl flex flex-col min-h-[340px]">
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-3">
                {messages.length === 0 && (
                  <div className="text-sm text-slate-400">
                    {isAuthenticated
                      ? "Welcome back. Describe a project, neighbor issue, or hiring need and I’ll scout options."
                      : "Start with something like: ‘Find a roofer in my area under $20k’ or ‘Draft a post to my HOA board about parking.’"}
                  </div>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "user"
                        ? "ml-auto max-w-[85%] rounded-2xl bg-orange-500 text-white px-3 py-2 text-sm shadow"
                        : "mr-auto max-w-[85%] rounded-2xl bg-slate-900 text-slate-100 px-3 py-2 text-sm border border-slate-800"
                    }
                  >
                    {m.content}
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-800 px-3 py-3 flex items-end gap-2 bg-slate-950/90 rounded-b-2xl">
                <textarea
                  className="flex-1 bg-transparent resize-none text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  rows={isMobile ? 2 : 3}
                  placeholder="Tell Scout what to handle for you…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 mr-1" />
                  {isLoading ? "Sending" : "Ask Scout"}
                </button>
              </div>
            </div>

            {/* Simple quick links */}
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Jump into the product
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Link
                  href="/community"
                  className="block rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-3 hover:border-orange-500/60"
                >
                  <div className="font-semibold text-white mb-1">Community feed</div>
                  <div className="text-slate-400 text-xs">See local posts and HOA chatter.</div>
                </Link>
                <Link
                  href="/marketplace"
                  className="block rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-3 hover:border-orange-500/60"
                >
                  <div className="font-semibold text-white mb-1">Marketplace</div>
                  <div className="text-slate-400 text-xs">List items or browse offers from neighbors.</div>
                </Link>
                <Link
                  href="/hoa-dashboard"
                  className="block rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-3 hover:border-orange-500/60"
                >
                  <div className="font-semibold text-white mb-1">HOA dashboard</div>
                  <div className="text-slate-400 text-xs">If you manage an HOA, open the console.</div>
                </Link>
                <Link
                  href="/contractors"
                  className="block rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-3 hover:border-orange-500/60"
                >
                  <div className="font-semibold text-white mb-1">Find contractors</div>
                  <div className="text-slate-400 text-xs">Search pros by trade and location.</div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AppDrawer
        isOpen={appDrawerOpen}
        onClose={() => setAppDrawerOpen(false)}
        isAdmin={user?.isAdmin === true}
      />
    </React.Fragment>
  );
}
