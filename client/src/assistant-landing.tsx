import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, MessageCircle, Sparkles, Activity, Send, Home } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import "./index.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type AssistantResponse = {
  message: string;
  actions?: any[];
  actionResults?: any[];
  timestamp: string;
};

export default function AssistantLanding() {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm Scout, your TradeScout controller. I can help you find contractors, search the marketplace, get your profile info, and route you anywhere in the site. What do you want to do?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addressParts = user?.address?.split(",").map((part: string) => part.trim()).filter(Boolean) || [];
  const addressDerivedCommunity = addressParts[1] || addressParts[0] || "";
  const rawCommunity = user?.city || user?.county || addressDerivedCommunity || user?.state || "";
  const communityLabel = rawCommunity.trim();
  const headlineCommunity = isAuthenticated && communityLabel ? communityLabel : "Local Community";
  const ownerName = user?.firstName || user?.lastName || "you";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

    const userMessage: Message = {
      role: "user",
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!prompt) setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          message: messageToSend,
          history: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from Scout");
      }

      const data: AssistantResponse = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(data.timestamp),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.actionResults && data.actionResults.length > 0) {
        const resultsMessage: Message = {
          role: "assistant",
          content: formatActionResults(data.actionResults),
          timestamp: new Date(data.timestamp),
        };
        setMessages((prev) => [...prev, resultsMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
    handleSendMessage(prompt);
  };

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

          <div className="w-full max-w-4xl space-y-4">
            <form
              className="bg-[#0c152c]/90 border border-tsBorder rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-0">
                <div className="flex-1 px-4 py-4 sm:py-3">
                  <div className="text-left text-xs uppercase tracking-[0.12em] text-tsTextMuted mb-2">
                    Ask a question, find a pro, check local codes, or get advice...
                  </div>
                  <textarea
                    className="w-full rounded-xl bg-[#0c1a33] border border-white/10 px-4 py-3 text-base text-white placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-tsAccent/80 min-h-[92px]"
                    rows={3}
                    placeholder="Ask a question, find a pro, check local codes, or get advice..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-tsTextMuted">
                    <div className="flex items-center gap-1 text-cyan-300">
                      <Activity className="w-4 h-4" />
                      Scout Active
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      Real-time intelligence
                    </div>
                  </div>
                </div>
                <div className="sm:border-l border-tsBorder bg-[#0e1a32] flex sm:flex-col p-4 sm:p-5 justify-center items-stretch sm:items-center gap-3">
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="w-full sm:w-32 h-12 rounded-xl bg-gradient-to-r from-tsAccent to-orange-600 text-white font-semibold shadow-lg shadow-orange-600/30 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                  >
                    {isLoading ? "Searching..." : "Start Search"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
                </div>
              </div>
            </form>

            <div className="flex flex-wrap justify-start sm:justify-center gap-2 text-sm text-tsTextMuted">
              {[
                "Find a reliable plumber for a kitchen leak",
                "How much does it cost to paint a 12x12 room?",
                "Roof repair specialists near me",
                "Permits needed for a deck in Texas",
                "Best work van for HVAC technician",
                "Landscaping ideas for small backyards",
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

          {(messages.length > 1 || isLoading) && (
            <div className="w-full max-w-4xl rounded-2xl border border-tsBorder bg-slate-900/80 p-4 text-left shadow-inner shadow-black/30 max-h-72 overflow-y-auto" ref={scrollRef}>
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className="space-y-1">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-tsTextMuted flex items-center gap-2">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-tsAccent" />
                      {message.role === "user" ? "You" : "Assistant"}
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                    <div className="text-[10px] text-tsTextMuted">
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
                {isLoading && <div className="text-xs text-tsTextMuted">Thinking...</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
