import React, { useEffect, useRef, useState } from "react";
import { Activity, Send, Home } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import "./index.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type ScoutResponse = {
  message: string;
  actions?: any[];
  actionResults?: any[];
  timestamp: string;
};

const INTRO_PROMPT = "What can TradeScout do for my community?";

export default function ScoutLanding() {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const autoRunTimeoutRef = useRef<number | null>(null);
  const hasAutoRunRef = useRef(false);
  const userInteractedRef = useRef(false);

  const addressParts = user?.address?.split(",").map((part: string) => part.trim()).filter(Boolean) || [];
  const addressDerivedCommunity = addressParts[1] || addressParts[0] || "";
  const rawCommunity = user?.city || user?.county || addressDerivedCommunity || user?.state || "";
  const communityLabel = rawCommunity.trim();
  const headlineCommunity = isAuthenticated && communityLabel ? communityLabel : "Local Community";
  const ownerName = user?.firstName || user?.lastName || "you";

  const pushMessage = (message: Message) => {
    setMessages((prev) => {
      const next = [...prev, message];
      messagesRef.current = next;
      return next;
    });
  };

  const markUserInteracted = () => {
    if (!userInteractedRef.current) {
      userInteractedRef.current = true;
    }
    if (autoRunTimeoutRef.current) {
      window.clearTimeout(autoRunTimeoutRef.current);
      autoRunTimeoutRef.current = null;
    }
  };

  const formatActionResults = (results: any[]): string => {
    let formatted = "\n\n**Results:**\n\n";

    results.forEach((result) => {
      if (result.success && result.data) {
        if (Array.isArray(result.data)) {
          formatted += `Found ${result.data.length} items:\n`;
          result.data.slice(0, 3).forEach((item: any, index: number) => {
            formatted += `${index + 1}. ${JSON.stringify(item, null, 2)}\n`;
          });
          if (result.data.length > 3) {
            formatted += `... and ${result.data.length - 3} more\n`;
          }
        } else {
          formatted += `${JSON.stringify(result.data, null, 2)}\n`;
        }
      } else if (result.error) {
        formatted += `Error: ${result.error}\n`;
      }
    });

    return formatted;
  };

  const handleSendMessage = async (prompt?: string) => {
    const messageToSend = (prompt ?? inputValue).trim();
    if (!messageToSend || isLoading) return;

    markUserInteracted();

    const userMessage: Message = {
      role: "user",
      content: messageToSend,
      timestamp: new Date(),
    };

    pushMessage(userMessage);
    if (!prompt) setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/scout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          message: messageToSend,
          history: messagesRef.current.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from Scout");
      }

      const data: ScoutResponse = await response.json();

      const scoutMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(data.timestamp),
      };

      pushMessage(scoutMessage);

      if (data.actionResults && data.actionResults.length > 0) {
        const resultsMessage: Message = {
          role: "assistant",
          content: formatActionResults(data.actionResults),
          timestamp: new Date(data.timestamp),
        };
        pushMessage(resultsMessage);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      pushMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const hasSeenIntro = localStorage.getItem("ts_seen_intro_prompt") === "true";

    if (messagesRef.current.length === 0) {
      const introMessage: Message = {
        role: "assistant",
        content:
          "Hi! I'm Scout, your TradeScout controller. I can run actions for you: find contractors, search marketplace, launch Community Builder, or trigger MealScout flows. Ask or tap a suggestion to get started.",
        timestamp: new Date(),
      };

      pushMessage(introMessage);

      if (!hasSeenIntro) {
        setInputValue(INTRO_PROMPT);
        autoRunTimeoutRef.current = window.setTimeout(() => {
          if (userInteractedRef.current || hasAutoRunRef.current) return;
          hasAutoRunRef.current = true;
          handleSendMessage(INTRO_PROMPT);
        }, 1200);
      }
    }

    return () => {
      if (autoRunTimeoutRef.current) {
        window.clearTimeout(autoRunTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // After user sends anything, mark intro as seen so default placeholder returns on next visit
  useEffect(() => {
    const userHasSent = messages.some((m) => m.role === "user");
    if (userHasSent) {
      localStorage.setItem("ts_seen_intro_prompt", "true");
    }
  }, [messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    markUserInteracted();
    setInputValue(prompt);
    handleSendMessage(prompt);
  };

  const smartFirstResponses: { title: string; body: string; next: string[] }[] = [
    {
      title: "Community Builder",
      body: "I can activate Community Builder to grow your local network, recruit pros, and post welcome messages. Want me to start a community growth plan for your county?",
      next: ["Start the Community Builder for my county", "Invite top contractors in my zip", "Draft a welcome post for neighbors"],
    },
    {
      title: "Find Contractors",
      body: "Tell me the project and location. I'll pull verified contractors, message them, or create a project request for you.",
      next: ["Find roofers available this week", "Create a project for kitchen remodel", "Message the top 3 electricians near me"],
    },
    {
      title: "Marketplace",
      body: "Browse or list items instantly. I can surface hot deals, compare similar items, or create a listing for you.",
      next: ["Show me today’s best tool deals", "List my pressure washer for $250", "Find used trailers within 50 miles"],
    },
    {
      title: "MealScout",
      body: "I can run MealScout actions to find food trucks, deals, or nearby restaurants. If none are in-range, I'll search the wider web automatically.",
      next: ["Find food trucks near me", "What pizza deals are nearby?", "Add my restaurant to MealScout"],
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-[#060b1c] text-white flex items-start justify-center px-3 sm:px-4 pb-16">
      <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-tsBorder bg-slate-950/85 shadow-2xl shadow-black/60 px-4 sm:px-8 py-8 sm:py-10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,#0b1834,#030814_60%,#020617)] opacity-85" />
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-56 h-56 bg-orange-500/14 blur-3xl" />
          <div className="absolute bottom-[-5%] right-1/4 w-96 h-96 bg-cyan-500/12 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          <div className="flex items-center gap-3 text-sm text-tsTextMuted">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-tsAccent to-orange-700 flex items-center justify-center shadow-2xl shadow-orange-500/40">
              <Home className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold tracking-[0.18em] uppercase text-tsAccentSoft shadow-lg shadow-orange-500/15">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            {isAuthenticated ? `${headlineCommunity} • Your Operating System` : "Community Operating System"}
          </div>

          <div className="space-y-3 max-w-3xl px-2">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight drop-shadow-[0_10px_38px_rgba(0,0,0,0.35)]">
              Empowering <span className="text-tsAccent">{headlineCommunity}</span>
            </h1>
            <p className="text-base sm:text-lg text-tsTextMuted">
              {isAuthenticated
                ? `Tailored for ${ownerName}—run ${headlineCommunity} with trusted local intel and actions.`
                : "Interact with neighbors, find verified local talent, and access real-time area intelligence."}
            </p>
          </div>

          <div className="w-full max-w-4xl space-y-5">
            <div className="bg-[#0c152c]/90 border border-tsBorder rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
              <div className="border-b border-tsBorder px-4 sm:px-5 py-4 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-tsTextMuted">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  Live AI thread
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <Activity className="w-4 h-4" />
                  Real-time intelligence
                </div>
              </div>

              <div className="px-4 sm:px-5 py-5 space-y-4">
                <div
                  className="rounded-xl border border-white/5 bg-[#0c1a33]/70 p-4 max-h-80 overflow-y-auto shadow-inner shadow-black/20 space-y-4"
                  ref={scrollRef}
                >
                  {messages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className="space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-tsTextMuted flex items-center gap-2">
                        <span className={`inline-flex h-1.5 w-1.5 rounded-full ${message.role === "user" ? "bg-tsAccent" : "bg-orange-400"}`} />
                        {message.role === "user" ? "You" : "Scout"}
                      </div>
                      <div className="text-sm whitespace-pre-wrap leading-relaxed text-white">
                        {message.content}
                      </div>
                      <div className="text-[10px] text-tsTextMuted">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  ))}
                  {isLoading && <div className="text-xs text-tsTextMuted">Thinking...</div>}
                </div>

                <form
                  className="flex flex-col sm:flex-row gap-3 items-stretch"
                  onSubmit={(e) => {
                    e.preventDefault();
                    markUserInteracted();
                    handleSendMessage();
                  }}
                >
                  <div className="flex-1">
                    <textarea
                      className="w-full rounded-xl bg-[#0c1a33] border border-white/10 px-4 py-3 text-base text-white placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-tsAccent/80 min-h-[90px]"
                      rows={3}
                      placeholder="Ask anything—local intel, permits, pros, or shortcuts across the site."
                      value={inputValue}
                      onChange={(e) => {
                        markUserInteracted();
                        setInputValue(e.target.value);
                      }}
                      onKeyPress={handleKeyPress}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="sm:w-32 flex sm:flex-col gap-3">
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || isLoading}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-tsAccent to-orange-600 text-white font-semibold shadow-lg shadow-orange-600/30 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                    >
                      {isLoading ? "Working..." : "Send"}
                      <Send className="w-4 h-4 ml-2" />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="flex flex-wrap justify-start sm:justify-center gap-2 text-sm text-tsTextMuted">
              {[
                "Launch Community Builder to grow my area",
                "What can TradeScout do for my community?",
                "Find licensed contractors for a roofing job",
                "Browse marketplace deals for tools",
                "Find food deals nearby with MealScout",
                "Compare permits and timelines for a deck",
                "Set up alerts for new contractor opportunities",
                "Show me top marketplace listings this week",
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleQuickPrompt(prompt)}
                  className="px-3 py-2 rounded-full bg-slate-900/80 border border-tsBorder text-xs text-tsTextMain hover:border-tsAccent hover:text-white transition shadow-sm shadow-black/20"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="w-full bg-slate-900/70 border border-tsBorder rounded-2xl p-4 sm:p-5 shadow-xl shadow-black/30 space-y-3 text-left">
              <div className="text-xs uppercase tracking-[0.16em] text-tsTextMuted">Jump into the full site</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {smartFirstResponses.map((card) => (
                  <div key={card.title} className="rounded-xl border border-white/5 bg-slate-950/70 p-4 shadow-inner shadow-black/20 space-y-3">
                    <div className="text-sm font-semibold text-white">{card.title}</div>
                    <div className="text-xs text-tsTextMuted leading-relaxed">{card.body}</div>
                    <div className="flex flex-wrap gap-2">
                      {card.next.map((next) => (
                        <button
                          key={next}
                          type="button"
                          onClick={() => handleQuickPrompt(next)}
                          className="text-[11px] px-2.5 py-1.5 rounded-full bg-slate-900/80 border border-tsBorder text-tsTextMain hover:border-tsAccent hover:text-white transition"
                        >
                          {next}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Marketplace", href: "/marketplace" },
                  { label: "Dashboard", href: "/dashboard" },
                  { label: "Contractor Board", href: "/contractor-board" },
                  { label: "Find Contractors", href: "/find-contractors" },
                  { label: "Groups", href: "/groups" },
                  { label: "County Hub", href: "/county-hub" },
                  { label: "Login", href: "/login" },
                  { label: "Register", href: "/signup" },
                  { label: "Profile", href: "/profile" },
                  { label: "Help", href: "/help" },
                  { label: "Notifications", href: "/notifications" },
                  { label: "Settings", href: "/settings" },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center justify-center rounded-xl border border-tsBorder bg-slate-950/60 px-3 py-2 text-sm font-semibold text-tsTextMain hover:border-tsAccent hover:text-white transition shadow-sm shadow-black/20"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <p className="text-xs text-tsTextMuted">Scout is the fast front door. Use these shortcuts to continue anywhere in the full TradeScout experience.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
