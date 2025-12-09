// MILLION-DOLLAR MOBILE HERO FOR SCOUT
// Fullscreen 100dvh immersive experience
// Dynamic OS label with user location
// Bottom sheet for reasoning rail
// Premium animations and premium feel

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Send, Home, Menu, X } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useLocation, Link } from "wouter";
import "./index.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  id?: string;
};

type ScoutResponse = {
  message: string;
  actions?: any[];
  actionResults?: any[];
  timestamp: string;
};

const INTRO_PROMPT = "What can TradeScout do for my community?";
const apiBaseEnv = (import.meta as any).env?.VITE_SCOUT_API_BASE;
const isLocalHost = () => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
};

const apiBase = apiBaseEnv || (typeof window !== "undefined" && !isLocalHost()
  ? "https://www.thetradescout.com/api"
  : "/api");

const scoutEndpoint = `${apiBase.replace(/\/$/, "")}/scout`;

// Premium OS label resolver with perfect hierarchy
const resolveOsLabel = (user: any): string => {
  if (!user) return "TradeScout OS";

  // 1️⃣ Highest priority: City + State
  if (user.city && user.state) {
    return `${user.city} ${user.state} OS`;
  }

  // 2️⃣ Next: County
  if (user.county) {
    return `${user.county} OS`;
  }

  // 3️⃣ Next: Zipcode
  if (user.zipcode) {
    return `${user.zipcode} OS`;
  }

  // 4️⃣ Generic location name
  if (user.locationName) {
    return `${user.locationName} OS`;
  }

  // 5️⃣ Final fallback for authenticated users with no location data
  return "Your Community OS";
};

export default function ScoutLanding() {
  const { isAuthenticated, user } = useAuth();
  const [location, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [showReasoningSheet, setShowReasoningSheet] = useState(false);
  const [reasoningLog, setReasoningLog] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const introInitializedRef = useRef(false);

  // Get dynamic OS label using premium resolver
  const osLabel = isAuthenticated ? resolveOsLabel(user) : "TradeScout OS";
  const userName = (user as any)?.firstName || "there";
  const greetingName = userName !== "there" ? `${userName}'s ` : "";
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue,
      timestamp: new Date(),
      id: `user-${Date.now()}`,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setReasoningLog([]);

    try {
      // Simulate reasoning steps for premium feel
      setReasoningLog((prev) => [...prev, "Analyzing your request..."]);

      const response = await fetch(scoutEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt: inputValue }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = (await response.json()) as ScoutResponse;

      setReasoningLog((prev) => [
        ...prev,
        "Retrieved local intelligence...",
        "Formulating response...",
      ]);

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(data.timestamp),
        id: `assistant-${Date.now()}`,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I encountered an error: ${errorMsg}`,
          timestamp: new Date(),
          id: `error-${Date.now()}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length]);

  // Init welcome message
  useEffect(() => {
    if (introInitializedRef.current) return;
    introInitializedRef.current = true;

    const welcomeMsg: Message = {
      role: "assistant",
      content: isAuthenticated
        ? "Welcome back! I'm Scout, your local operating system. What can I help you with today?"
        : "I'm Scout. Ask me anything about your community—contractors, deals, local intel, and more.",
      timestamp: new Date(),
      id: `welcome-${Date.now()}`,
    };

    setMessages([welcomeMsg]);
  }, [isAuthenticated]);

  return (
    <>
      {/* FULLSCREEN MOBILE HERO - 100dvh immersive */}
      <div className="min-h-[100dvh] lg:min-h-screen flex flex-col bg-gradient-to-b from-[#060b1c] via-[#0a0f28] to-[#060b1c] text-white overflow-hidden">
        {/* ===== DESKTOP HEADER (hidden on mobile) ===== */}
        <div className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-white/5 backdrop-blur-md bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600" />
            <span className="font-bold">TradeScout</span>
          </div>

          <nav className="flex items-center gap-8 flex-1 ml-12 text-sm">
            <Link href="/home" className="hover:text-tsAccent transition">
              Dashboard
            </Link>
            <Link href="/contractors" className="hover:text-tsAccent transition">
              Find Contractors
            </Link>
            <Link href="/marketplace" className="hover:text-tsAccent transition">
              Marketplace
            </Link>
            <Link href="/pricing" className="hover:text-tsAccent transition">
              Pricing
            </Link>
          </nav>

          {isAuthenticated ? (
            <Link
              href="/home"
              className="px-4 py-2 rounded-lg bg-tsAccent text-black font-semibold hover:opacity-90 transition"
            >
              Open Dashboard
            </Link>
          ) : (
            <a
              href="/register"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:opacity-90 transition"
            >
              Create Free Account
            </a>
          )}
        </div>

        {/* ===== MOBILE HEADER (compact) ===== */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 backdrop-blur-md bg-black/20">
          <button
            onClick={() => setNavOpen(!navOpen)}
            className="p-2 hover:bg-white/10 rounded transition"
            aria-label="Menu"
          >
            {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500 to-orange-600" />
            <span className="font-bold text-sm">Scout</span>
          </div>

          {isAuthenticated ? (
            <Link
              href="/home"
              className="text-xs px-3 py-1 rounded-lg bg-tsAccent text-black font-semibold"
            >
              App
            </Link>
          ) : (
            <a
              href="/register"
              className="text-xs px-3 py-1 rounded-lg bg-orange-600 text-white font-semibold"
            >
              Sign Up
            </a>
          )}
        </div>

        {/* ===== MOBILE SIDE MENU (overlay) ===== */}
        {navOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/50 lg:hidden"
              onClick={() => setNavOpen(false)}
            />
            <div className="fixed left-0 top-[60px] bottom-0 w-[70vw] z-40 bg-slate-950 border-r border-white/5 flex flex-col overflow-y-auto">
              <nav className="p-4 space-y-2 flex-1">
                {[
                  { label: "Dashboard", href: "/home" },
                  { label: "Find Contractors", href: "/contractors" },
                  { label: "Marketplace", href: "/marketplace" },
                  { label: "Pricing", href: "/pricing" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setNavOpen(false)}
                    className="block px-3 py-2 rounded hover:bg-white/10 text-sm transition"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              {!isAuthenticated && (
                <div className="p-4 border-t border-white/5 space-y-2">
                  <a
                    href="/login"
                    className="block text-center px-4 py-2 rounded-lg border border-tsAccent text-tsAccent text-sm font-semibold hover:bg-tsAccent/10 transition"
                  >
                    Sign In
                  </a>
                  <a
                    href="/register"
                    className="block text-center px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:opacity-90 transition"
                  >
                    Create Account
                  </a>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== MAIN CONTENT AREA (flex-1 fills remaining) ===== */}
        <div className="flex-1 flex flex-col lg:flex-row lg:gap-8 lg:px-8 lg:py-8 overflow-hidden">
          {/* DESKTOP: Left hero section */}
          <div className="hidden lg:flex lg:flex-col lg:justify-center lg:gap-6 lg:flex-1 lg:max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 w-fit text-xs font-semibold tracking-wider uppercase text-tsAccentSoft">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              {osLabel}
            </div>

            <div className="space-y-4">
              <h1 className="text-6xl font-black leading-tight">
                Run Your <br />
                <span className="text-tsAccent">Community</span>
              </h1>
              <p className="text-lg text-white/70">
                {isAuthenticated
                  ? `Welcome, ${greetingName}founder. Scout connects you directly to vetted pros, market intel, and growth opportunities.`
                  : "Find contractors, track deals, launch projects, and build your community."}
              </p>
            </div>
          </div>

          {/* SCOUT CHAT HERO - Fullscreen on mobile, card on desktop */}
          <div className="flex-1 lg:flex-none lg:w-full lg:max-w-xl flex flex-col lg:rounded-2xl lg:border lg:border-white/10 lg:bg-slate-950/80 lg:shadow-2xl overflow-hidden">
            {/* Mobile: OS Label centered at top */}
            <div className="lg:hidden px-4 pt-6 pb-2 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold tracking-wider uppercase text-tsAccentSoft">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                {osLabel}
              </div>
            </div>

            {/* Status header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-xs uppercase tracking-wider text-white/70 bg-black/30">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${
                    isLoading ? "bg-orange-400 animate-ping" : "bg-cyan-400"
                  }`}
                />
                Scout {isLoading ? "Thinking" : "Ready"}
              </div>
              <span className="text-[11px]">Live</span>
            </div>

            {/* Chat viewport - scrollable */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gradient-to-b from-slate-950/50 to-black/30"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-orange-600/30 border border-orange-500/30 text-white"
                        : "bg-white/5 border border-white/10 text-white/90"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Floating input bar with blur */}
            <form
              className="px-4 py-3 border-t border-white/10 bg-black/40 backdrop-blur-xl flex gap-2 items-center"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Scout..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-orange-500/50 transition"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="p-2 rounded-lg bg-tsAccent text-black hover:opacity-90 disabled:opacity-50 transition"
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* ===== REASONING BOTTOM SHEET (mobile) ===== */}
        {showReasoningSheet && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={() => setShowReasoningSheet(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-white/10 rounded-t-2xl shadow-2xl shadow-black/50 max-h-[60vh] flex flex-col">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Reasoning Log
                </span>
                <button
                  onClick={() => setShowReasoningSheet(false)}
                  className="p-1 hover:bg-white/10 rounded transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-xs text-white/70">
                {reasoningLog.length > 0 ? (
                  reasoningLog.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-orange-400">→</span>
                      <span>{log}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-white/40">No reasoning yet...</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
