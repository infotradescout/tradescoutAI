import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Send, Home, Menu, X } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useLocation, Link } from "wouter";
import AppDrawer from "./components/AppDrawer";
import { useIsMobile } from "./hooks/useIsMobile";
import "./index.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  id?: string;
  suggestedActions?: string[];
};

type ScoutResponse = {
  message: string;
  suggestedActions?: string[];
  actions?: any[];
  actionResults?: any[];
  timestamp: string;
};

type TrendingItem = {
  title: string;
  stat?: string;
  delta?: string;
  category?: string;
};

type TrendingStatus = "idle" | "loading" | "ready" | "error" | "empty";

const isTooSpecific = (text: string) => {
  const lower = text.toLowerCase();
  const hasUrl = lower.includes("http") || lower.includes("www.");
  const hasEmail = lower.includes("@");
  const hasLongNumber = /\d{5,}/.test(lower);
  const tooLong = text.length > 140;
  return hasUrl || hasEmail || hasLongNumber || tooLong;
};

const normalizeTrendingItem = (item: any, place: string): TrendingItem | null => {
  const rawTitle = item?.title || item?.name || "";
  if (!rawTitle) return null;
  if (isTooSpecific(rawTitle)) return null;

  const title = rawTitle.replace(/\s+/g, " ").trim();
  if (!title) return null;

  const category = item?.category || item?.type || item?.topic || "Community";
  const stat = item?.stat || item?.metric;
  const delta = item?.delta || item?.change;

  // Force subject-level phrasing if the title looks like a direct prompt
  const isDirectQuestion = /\?$/.test(title) && title.length < 80;
  const subjectTitle = isDirectQuestion ? `${title.replace(/\?$/, "")} (trend in ${place})` : title;

  return { title: subjectTitle, stat, delta, category };
};

const INTRO_PROMPT = "What can TradeScout do for my community?";
const apiBaseEnv = (import.meta as any).env?.VITE_SCOUT_API_BASE;
const isLocalHost = () => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0";
};

// Always use the production API when not on localhost, even if env var is missing
const apiBase = apiBaseEnv || (typeof window !== "undefined" && !isLocalHost()
  ? "https://www.thetradescout.com/api"
  : "/api");

const scoutEndpoint = `${apiBase.replace(/\/$/, "")}/scout`;
const BANNED_TERMS = ["fuck", "shit", "bitch", "asshole", "cunt", "slut", "whore"];

const containsProfanity = (text: string) => {
  const lower = text.toLowerCase();
  return BANNED_TERMS.some(term => lower.includes(term));
};

const censorProfanity = (text: string) => {
  let cleaned = text;
  BANNED_TERMS.forEach(term => {
    const re = new RegExp(term, "gi");
    cleaned = cleaned.replace(re, `${term[0]}***`);
  });
  return cleaned;
};

const suggestFollowUps = (prompt: string): string[] => {
  const lower = prompt.toLowerCase();
  const ideas: string[] = [];

  const locationCue = lower.includes("county") || lower.includes("zip") || lower.includes("state");
  const timelineCue = lower.includes("when") || lower.includes("today") || lower.includes("week") || lower.includes("schedule");
  const pricingCue = lower.includes("price") || lower.includes("cost") || lower.includes("quote") || lower.includes("budget");
  const contractorCue = lower.includes("contractor") || lower.includes("electrician") || lower.includes("plumber") || lower.includes("roofer") || lower.includes("pro");

  if (!pricingCue) ideas.push("Give me hyperlocal pricing with citations for this");
  if (!timelineCue) ideas.push("Find pros who can start this week and share availability");
  if (!locationCue) ideas.push("Use my county and nearby counties for matches");
  if (!contractorCue) ideas.push("Message the top 3 vetted contractors and share their replies here");

  // Fill up to 4 suggestions with helpful defaults
  const defaults = [
    "Draft the outreach message for me",
    "Create a simple project board with next steps",
    "Show any sponsored offers that fit this job",
    "Remind me to follow up tomorrow",
  ];

  for (const d of defaults) {
    if (ideas.length >= 4) break;
    if (!ideas.includes(d)) ideas.push(d);
  }

  return ideas.slice(0, 4);
};

export default function ScoutLanding() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.isAdmin === true;
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [, navigate] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoPrompting, setIsAutoPrompting] = useState(false);
  const [sendPulse, setSendPulse] = useState(false);
  const [pendingCopy, setPendingCopy] = useState<string | null>(null);
  const [autoPromptPreview, setAutoPromptPreview] = useState<string | null>(null);
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([]);
  const [trendingStatus, setTrendingStatus] = useState<TrendingStatus>("idle");
  const [navOpen, setNavOpen] = useState(false);
  const [appDrawerOpen, setAppDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const autoRunTimeoutRef = useRef<number | null>(null);
  const hasAutoRunRef = useRef(false);
  const userInteractedRef = useRef(false);
  const introInitializedRef = useRef(false);
  const bootShownRef = useRef(false);

  const thinkingPhrases = useMemo(
    () => [
      "Scout is lining up local intel…",
      "Pulling contractors and deals…",
      "Scanning your county playbook…",
      "Checking availability right now…",
    ],
    []
  );

  useEffect(() => {
    // Always reset autorun state on load so guests auto-run every visit
    hasAutoRunRef.current = false;
  }, []);

  useEffect(() => {
    if (!isAuthenticated && messagesRef.current.length === 0) {
      setIsAutoPrompting(true);
    } else {
      setIsAutoPrompting(false);
    }
  }, [isAuthenticated]);

  // Warm the backend so the first real prompt isn’t cold-start slow
  useEffect(() => {
    const warm = async () => {
      try {
        await fetch(`${apiBase}/scout/health`, { method: "HEAD", cache: "no-store" });
      } catch (err) {
        console.warn("Warmup ping failed", err);
      }
    };
    warm();
  }, []);

  const addressParts = user?.address?.split(",").map((part: string) => part.trim()).filter(Boolean) || [];
  const addressDerivedCommunity = addressParts[1] || addressParts[0] || "";
  const rawCommunity = user?.city || user?.county || addressDerivedCommunity || user?.state || "";
  const communityLabel = rawCommunity.trim();
  const headlineCommunity = isAuthenticated && communityLabel ? communityLabel : "Local Community";
  const ownerName = user?.firstName || user?.lastName || "you";

  const pushMessage = (message: Message) => {
    const id = message.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prepared: Message = { ...message, id };

    setMessages((prev) => {
      const next = [...prev, prepared];
      messagesRef.current = next;
      return next;
    });
  };

  // Auto-run prompt with CSS typing illusion then send
  const animateAndSendPrompt = async (promptText: string) => {
    if (userInteractedRef.current || hasAutoRunRef.current) return;
    hasAutoRunRef.current = true;
    setIsAutoPrompting(true);
    setAutoPromptPreview(promptText);
    const timer = window.setTimeout(async () => {
      try {
        setInputValue(promptText);
        setSendPulse(true);
        await handleSendMessage(promptText);
        userInteractedRef.current = true; // ensure autorun exits after first prompt
      } finally {
        setSendPulse(false);
        setAutoPromptPreview(null);
        setIsAutoPrompting(false);
        autoRunTimeoutRef.current = null;
      }
    }, 2600);
    autoRunTimeoutRef.current = timer as any;
  };

  const markUserInteracted = () => {
    if (!userInteractedRef.current) {
      userInteractedRef.current = true;
    }
    setIsAutoPrompting(false);
    setAutoPromptPreview(null);
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

    if (containsProfanity(messageToSend)) {
      const blocked: Message = {
        role: "assistant",
        content: "That prompt isn’t allowed. Please keep it respectful.",
        timestamp: new Date(),
      };
      pushMessage(blocked);
      setInputValue(censorProfanity(messageToSend));
      return;
    }

    markUserInteracted();

    const isFirstUserTurn = !messagesRef.current.some((m) => m.role === "user");

    const userMessage: Message = {
      role: "user",
      content: messageToSend,
      timestamp: new Date(),
    };

    pushMessage(userMessage);
    setInputValue(""); // Always clear input after sending
    setIsLoading(true);
    setPendingCopy(thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)]);

    try {
      const response = await fetch(scoutEndpoint, {
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
          hyperlocalPricing: true,
          pricingContext: {
            priority: "county-first",
            requireCitations: true,
            admitUnknowns: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Scout] HTTP Error:", response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: ScoutResponse = await response.json();
      
      if (!data.message) {
        console.error("[Scout] Empty response from API", data);
        throw new Error("Empty response from Scout API");
      }

      const introProfileAddendum = `

---
**TradeScout profiles can replace a traditional website**
- Public, shareable profile with your services, coverage areas, and reviews
- SEO-friendly page you can text, post, or link in ads without hosting costs
- Built-in messaging and lead capture so prospects contact you directly
`;

      const finalContent =
        messageToSend === INTRO_PROMPT ? `${data.message}${introProfileAddendum}` : data.message;

      const scoutMessage: Message = {
        role: "assistant",
        content: finalContent,
        timestamp: new Date(data.timestamp),
        suggestedActions: data.suggestedActions || [],
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

      // Suppress legacy highlight follow-up
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Scout] Error sending message:", errorMsg, error);
      const errorMessage: Message = {
        role: "assistant",
        content: `Sorry, I encountered an error processing your request: ${errorMsg}`,
        timestamp: new Date(),
      };
      pushMessage(errorMessage);
    } finally {
      setPendingCopy(null);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  useEffect(() => {
    if (introInitializedRef.current) return;
    introInitializedRef.current = true;

    if (messagesRef.current.length === 0 && isAuthenticated) {
      const introMessage: Message = {
        role: "assistant",
        content:
          "Welcome back! I'm Scout, your TradeScout operating system. I can:\n• Find and message verified contractors for your county\n• Provide hyperlocal pricing using county/state data (no guessing)\n• Spin up Community Builder and launch outreach posts\n• Search marketplace deals or list your gear fast\n• Run MealScout to surface food trucks and local offers\nAsk me anything specific (project, location, budget, timing) and I'll act immediately.",
        timestamp: new Date(),
      };
      pushMessage(introMessage);
    }

    return () => {
      if (autoRunTimeoutRef.current) {
        window.clearTimeout(autoRunTimeoutRef.current);
      }
    };
  }, [isAuthenticated]);

  // Guest-only boot + autorun separated to survive StrictMode double-mount
  useEffect(() => {
    if (isAuthenticated) return;
    if (userInteractedRef.current) return;

    if (!bootShownRef.current) {
      bootShownRef.current = true;
      window.setTimeout(() => {
        pushMessage({
          role: "assistant",
          content: "Booting Scout…",
          timestamp: new Date(),
        });
      }, 400);
    }

    if (!autoRunTimeoutRef.current && !hasAutoRunRef.current) {
      autoRunTimeoutRef.current = window.setTimeout(() => {
        if (userInteractedRef.current || hasAutoRunRef.current) return;
        hasAutoRunRef.current = true;
        animateAndSendPrompt(INTRO_PROMPT);
      }, 1500);
    }

    return () => {
      if (autoRunTimeoutRef.current) {
        window.clearTimeout(autoRunTimeoutRef.current);
        autoRunTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      setIsAutoPrompting(false);
    }
  }, [messages.length]);

  // After user sends anything, mark intro as seen so default placeholder returns on next visit
  useEffect(() => {
    // No-op: intro prompt now always runs for guests on load; no stored flag needed
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

  const getTrendingFallback = (countyKey: string): TrendingItem[] => {
    return [];
  };

  const trendingPromptSuggestions = [
    "Show county intel from the admin knowledge base",
    "Crawl TradeScout updates for my county",
    "Surface cached marketplace deals near me",
    "Pull recent contractor outreach scripts we used",
    "List MealScout food truck intel we already have",
  ];

  useEffect(() => {
    const countyKey = headlineCommunity || "national";
    const cacheKey = `ts_trending_${countyKey.toLowerCase().replace(/\s+/g, "_")}`;
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const ageMs = Date.now() - parsed.timestamp;
          if (ageMs < CACHE_TTL_MS && Array.isArray(parsed.items)) {
            setTrendingItems(parsed.items);
            setTrendingStatus("ready");
            return;
          }
        } catch (err) {
          console.warn("Failed to parse cached trending", err);
        }
      }
    }

    const loadTrending = async () => {
      setTrendingStatus("loading");
      try {
        const resp = await fetch(`${apiBase}/trending?county=${encodeURIComponent(countyKey)}`);
        if (!resp.ok) throw new Error("Failed trending fetch");
        const data = await resp.json();
        const items: TrendingItem[] = Array.isArray(data?.items)
          ? data.items
              .map((item: any) => normalizeTrendingItem(item, countyKey))
              .filter(Boolean)
              .slice(0, 8) as TrendingItem[]
          : [];

        if (items.length === 0) {
          setTrendingItems([]);
          setTrendingStatus("empty");
          if (typeof window !== "undefined") {
            localStorage.setItem(cacheKey, JSON.stringify({ items: [], timestamp: Date.now() }));
          }
          return;
        }

        setTrendingItems(items);
        setTrendingStatus("ready");

        if (typeof window !== "undefined") {
          localStorage.setItem(cacheKey, JSON.stringify({ items, timestamp: Date.now() }));
        }
      } catch (err) {
        console.warn("Trending fetch failed", err);
        setTrendingItems([]);
        setTrendingStatus("empty");
      }
    };

    loadTrending();
  }, [headlineCommunity]);

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

  const quickPrompts = [
    "Find roofers available this week",
    "Start the Community Builder for my county",
    "Show me today’s best tool deals",
    "Message the top 3 electricians near me",
    "Create a project for kitchen remodel",
    "Price a full bathroom remodel in my county with citations",
    "List my pressure washer for $250",
    "Find food trucks near me tonight",
  ];

  const navClusters = [
    {
      label: "Primary — Task Execution",
      tone: "primary" as const,
      items: [
        { label: "Contractors", href: "/contractors", desc: "Post a job or pull vetted pros fast" },
        { label: "Contractors Board", href: "/contractor-board", desc: "See active leads and bids" },
        { label: "Marketplace", href: "/marketplace", desc: "Shop or list gear with pricing help" },
      ],
    },
    {
      label: "Personal — Account / Productivity",
      tone: "secondary" as const,
      items: [
        { label: "Dashboard", href: "/dashboard", desc: "Your saved workstreams" },
        { label: "Notifications", href: "/notifications", desc: "Stay on top of actions" },
        { label: "Settings", href: "/settings", desc: "Preferences and alerts" },
      ],
    },
    {
      label: "Community — Local Engagement",
      tone: "muted" as const,
      items: [
        { label: "Groups", href: "/groups", desc: "Neighborhood threads" },
        { label: "County Hub", href: "/county-hub", desc: "County resources and timelines" },
        { label: "Help", href: "/help", desc: "Get unstuck fast" },
      ],
    },
  ];

  const footerColumns = [
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
        { label: "Community Promise", href: "/community" },
        { label: "Community Builder Fund", href: "https://buy.stripe.com/cNi28r74reaSg392IV8N200" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Terms", href: "/terms" },
        { label: "Privacy", href: "/privacy" },
        { label: "Compliance", href: "/compliance" },
      ],
    },
    {
      title: "Platform",
      links: [
        { label: "County Coverage", href: "/county-hub" },
        { label: "Safety", href: "/help" },
        { label: "Press Kit", href: "/about" },
      ],
    },
    {
      title: "Social",
      links: [
        { label: "Facebook", href: "https://facebook.com" },
        { label: "Instagram", href: "https://instagram.com" },
        { label: "LinkedIn", href: "https://linkedin.com" },
      ],
    },
  ];

  const isScoutActive = isLoading || messages.length > 0;

  const separateThought = (text: string) => {
    const marker = /how i['’]m thinking:/i;
    if (!marker.test(text)) return { thought: "", response: text };

    const parts = text.split(/\n\n+/); // split by blank lines
    let thought = "";
    const remainder: string[] = [];

    let skippingThought = false;
    parts.forEach((block) => {
      if (!skippingThought && marker.test(block)) {
        thought = block.trim();
        skippingThought = true;
        return;
      }
      if (skippingThought && !block.trim()) return;
      remainder.push(block.trim());
    });

    const response = remainder.filter(Boolean).join("\n\n");
    return { thought, response: response || text.replace(marker, "").trim() };
  };

  const renderAssistantContent = (text: string) => {
    const { response } = separateThought(text);
    const lines = response.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const blocks: React.ReactNode[] = [];
    let list: string[] = [];

    const flushList = () => {
      if (!list.length) return;
      blocks.push(
        <ul key={`list-${blocks.length}`} className="list-disc list-outside pl-5 space-y-1 text-white/90">
          {list.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
      list = [];
    };

    lines.forEach((line, idx) => {
      const bulletMatch = line.match(/^[*-]\s+(.*)$/);
      const dotMatch = line.match(/^•\s+(.*)$/);
      if (bulletMatch || dotMatch) {
        list.push((bulletMatch?.[1] || dotMatch?.[1] || "").trim());
        return;
      }

      // Line is not a bullet; flush any accumulated list
      flushList();

      const isHeading = /:$/g.test(line) || idx === 0;
      if (isHeading) {
        blocks.push(
          <div key={`head-${blocks.length}`} className="font-semibold text-tsAccent">
            {line.replace(/:$/, "")}
          </div>
        );
      } else {
        blocks.push(
          <p key={`p-${blocks.length}`} className="text-white/90 leading-relaxed">
            {line}
          </p>
        );
      }
    });

    flushList();

    return <div className="space-y-3 text-white/90 leading-relaxed">{blocks}</div>;
  };

  const Messages = useMemo(
    () =>
      React.memo(function MessagesList({ items }: { items: Message[] }) {
        return (
          <>
            {items.map((message) => (
              <div key={message.id || `${message.role}-${message.timestamp.getTime()}`} className="space-y-1">
                <div className="text-[11px] uppercase tracking-[0.12em] text-tsTextMuted flex items-center gap-2">
                  <span className={`inline-flex h-1.5 w-1.5 rounded-full ${message.role === "user" ? "bg-tsAccent" : "bg-orange-400"}`} />
                  {message.role === "user" ? "You" : "Scout"}
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed text-white">{message.content}</div>
                <div className="text-[10px] text-tsTextMuted">
                  {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </>
        );
      }),
    []
  );

  const navLinks = [
    { label: "SCOUT", href: "/" },
    { label: "Contractors", href: "/contractors" },
    { label: "Marketplace", href: "/marketplace" },
    { label: "Community", href: "/community" },
  ];

  const bootTimestamp = messages[0]?.timestamp ?? new Date();

  return (
    <React.Fragment>
	  <div className="min-h-[100vh] bg-[#060b1c] text-white flex items-start justify-center px-3 sm:px-4 pb-10 relative w-full max-w-6xl pt-4 pb-10">

        {/* Mobile side menu */}
        {navOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={() => setNavOpen(false)}>
            <div
              className="absolute left-0 top-0 h-full w-72 max-w-[80vw] bg-slate-950 border-r border-tsBorder shadow-2xl shadow-black/50 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">

                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-tsAccent to-orange-600 shadow-lg shadow-orange-500/30 flex items-center justify-center">
                    <Home className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-tsAccentSoft">TradeScout</div>
                    <div className="text-sm text-tsTextMuted">Community OS</div>
                  </div>
                </div>
                <button
                  onClick={() => setNavOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-tsBorder text-tsTextMuted hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setAppDrawerOpen(true);
                    setNavOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-orange-400 hover:bg-slate-900 hover:text-orange-300 transition block font-semibold"
                >
                  📱 Browse Apps
                </button>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setNavOpen(false)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-tsTextMain hover:bg-slate-900 hover:text-white transition block"
                  >
                    {link.label}
                  </Link>
                ))}
                {!isAuthenticated && (
                  <Link
                    href="/register"
                    onClick={() => setNavOpen(false)}
                    className="w-full mt-4 inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-orange-600/30 shadow"
                  >
                    Create Free Account
                  </Link>
                )}
              </div>
		    </div>
		  </div>
		)}
        
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,#0b1834,#030814_60%,#020617)] opacity-85" />
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-56 h-56 bg-orange-500/14 blur-3xl" />
          <div className="absolute bottom-[-5%] right-1/4 w-96 h-96 bg-cyan-500/12 blur-3xl" />
        </div>

        <div className="relative z-10">
          {/* Modern hero */}
          <div className="px-6 pt-10 pb-8 space-y-8 bg-navy-900/80 backdrop-blur-xl rounded-b-3xl shadow-lg">
          {/* Top Nav (safe-area minimal) */}
          <div className="flex items-center justify-between">
            <button
            className="p-2 rounded-lg bg-navy-800/50 shadow-inner"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            >
            <Menu className="w-5 h-5 text-slate-300" />
            </button>
            <button
            className="p-2 rounded-lg bg-navy-800/50 shadow-inner"
            onClick={() => navigate("/")}
            aria-label="Go home"
            >
            <Home className="w-5 h-5 text-orange-500" />
            </button>
          </div>

          {/* Brand */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-orange-400 uppercase">
            TRADESCOUT
            </p>
            <p className="text-sm text-slate-400">
            Local operating system for your county
            </p>
          </div>

          {/* CTA */}
          {isAuthenticated ? (
            <button
            className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-semibold shadow-[0_4px_20px_rgba(255,140,0,0.4)] hover:bg-orange-600 transition"
            onClick={() => navigate("/dashboard")}
            >
            Open Dashboard
            </button>
          ) : (
            <button
            className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-semibold shadow-[0_4px_20px_rgba(255,140,0,0.4)] hover:bg-orange-600 transition"
            onClick={() => navigate("/register")}
            >
            Create Free Account
            </button>
          )}

          {/* Status */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-navy-800/60 shadow-sm">
            <span className={`w-2 h-2 rounded-full ${isScoutActive ? "bg-orange-400" : "bg-slate-500"}`} />
            <span className="text-[11px] tracking-wide text-slate-300 uppercase">
            {isScoutActive ? "SCOUT ACTIVE" : "SCOUT IDLE"}
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white leading-tight">
            Empowering <span className="text-orange-400">{headlineCommunity}</span>
            </h1>
            <p className="text-slate-400 max-w-xs text-sm">
            {isAuthenticated
              ? `${ownerName}, Scout is standing by — run projects, find pros, and pull county intel in one place.`
              : "Standing by — find pros, deals, growth, or MealScout. Tell me a project."}
            </p>
          </div>
          </div>

          {/* Scout thread section */}
          <div className="px-6 mt-10 space-y-6">
          {/* Section Label */}
          <div className="space-y-2">
            <p className="text-xs tracking-wide text-slate-500 uppercase">LIVE SCOUT THREAD</p>
            <div className="w-full h-px bg-slate-800/60" />
          </div>

          {/* Booting / state pill */}
          <div className="rounded-2xl bg-navy-800/70 shadow-md p-4 space-y-1">
            <p className="text-orange-400 font-medium">
            {isLoading ? "Scout is working..." : messages.length > 0 ? "Scout is active in this thread" : "Booting Scout..."}
            </p>
            <p className="text-[11px] text-slate-500">
            {bootTimestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="rounded-2xl bg-navy-800/70 shadow-md p-4 max-h-96 overflow-y-auto space-y-4"
          >
            {messages.length === 0 && !isLoading && !pendingCopy ? (
            <p className="text-sm text-slate-400">
              Ask anything — local intel, permits, pros, marketplace, or shortcuts.
            </p>
            ) : (
            messages.map((message) => (
              <div
              key={message.id || `${message.role}-${message.timestamp.getTime()}`}
              className="space-y-1"
              >
              <div className="text-[11px] uppercase tracking-[0.12em] text-tsTextMuted flex items-center gap-2">
                <span className={`inline-flex h-1.5 w-1.5 rounded-full ${message.role === "user" ? "bg-tsAccent" : "bg-orange-400"}`} />
                {message.role === "user" ? "You" : "Scout"}
              </div>
              <div
                className={`inline-block max-w-full rounded-2xl px-4 py-3 text-sm leading-relaxed text-left ${
                message.role === "user"
                  ? "bg-orange-500/90 text-white"
                  : "bg-navy-900/90 text-slate-100"
                }`}
              >
                {message.role === "assistant" ? renderAssistantContent(message.content) : message.content}
              </div>
              {message.role === "assistant" && message.suggestedActions && message.suggestedActions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                {message.suggestedActions.map((action, i) => (
                  <button
                  key={i}
                  className="scout-suggestion text-left px-3.5 py-2.5 rounded-full text-xs font-medium bg-navy-900/80 text-slate-100 border border-white/10 hover:border-orange-400 hover:text-white transition"
                  onClick={() => handleQuickPrompt(action)}
                  disabled={isLoading}
                  >
                  {action}
                  </button>
                ))}
                </div>
              )}
              <div className="text-[10px] text-tsTextMuted">
                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              </div>
            ))
            )}

            {(isLoading || pendingCopy) && (
            <div className="inline-flex items-center gap-2 rounded-full bg-navy-900/80 px-3 py-2 text-xs text-tsTextMuted italic">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="ml-1">{pendingCopy || "Scout is thinking…"}</span>
            </div>
            )}
          </div>

          {/* Input */}
          <form
            className="space-y-3"
            onSubmit={(e) => {
            e.preventDefault();
            markUserInteracted();
            handleSendMessage();
            }}
          >
            {isAutoPrompting && (
            <p className="text-xs text-tsTextMuted flex items-center gap-2">
              <span className="loading-dot" />
              <span>Scout is auto-starting with a guided prompt…</span>
            </p>
            )}
            <div className="rounded-xl bg-navy-800/40 p-4 shadow-inner">
            <textarea
              className="w-full bg-transparent outline-none text-slate-300 placeholder-slate-600 resize-none text-sm"
              rows={3}
              placeholder="Ask anything—local intel, permits, pros, or shortcuts..."
              value={inputValue}
              onChange={(e) => {
              markUserInteracted();
              setInputValue(e.target.value);
              }}
              onKeyPress={handleKeyPress}
              onFocus={markUserInteracted}
              disabled={isLoading || isAutoPrompting}
            />
            </div>

            {/* Send */}
            <button
            className="w-full py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition shadow-[0_2px_15px_rgba(255,140,0,0.3)] inline-flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={!inputValue.trim() || isLoading || isAutoPrompting}
            >
            Send <Send className="inline-block ml-1 w-4 h-4" />
            </button>
          </form>

          {/* Quick prompts */}
          <div className="flex flex-wrap justify-start sm:justify-center gap-2 text-xs sm:text-sm text-tsTextMuted pt-2">
            {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleQuickPrompt(prompt)}
              disabled={isLoading || isAutoPrompting}
              className="px-3 py-2 rounded-full bg-slate-900/80 border border-tsBorder text-xs text-tsTextMain hover:border-tsAccent hover:text-white transition shadow-sm shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {prompt}
            </button>
            ))}
          </div>

          {/* Trending + quick starts (unchanged layout, aligned to grid) */}
          <div className="w-full pt-4 space-y-6">
            <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-xs uppercase tracking-[0.16em] text-tsTextMuted">Popular in {headlineCommunity || "your county"} this month</div>
              <div className="text-[11px] text-tsTextMuted">{trendingStatus === "loading" ? "Updating..." : "Live data only"}</div>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-3 min-w-full">
              {trendingStatus === "loading" && trendingItems.length === 0 &&
                Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-60 rounded-xl border border-white/5 bg-slate-900/60 p-4 animate-pulse"
                >
                  <div className="h-3 w-32 bg.white/10 rounded mb-2" />
                  <div className="h-3 w-20 bg-white/10 rounded" />
                </div>
                ))}

              {trendingItems.length > 0 && trendingItems.map((item, idx) => (
                <div
                key={`${item.title}-${idx}`}
                className="w-60 rounded-xl border border-tsBorder bg-slate-900/70 p-4 shadow-lg shadow-black/20 hover:border-tsAccent transition hover:-translate-y-[1px] duration-100"
                >
                <div className="text-sm font-semibold text-white line-clamp-2">{item.title}</div>
                <div className="text-[11px] text-tsTextMuted mt-2 flex items-center gap-2">
                  {item.stat && <span className="text-orange-300">{item.stat}</span>}
                  {item.delta && <span className="text-cyan-300">{item.delta}</span>}
                  {item.category && <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{item.category}</span>}
                </div>
                </div>
              ))}

              {trendingItems.length === 0 && trendingStatus !== "loading" && (
                <div className="flex flex-col gap-2 w-full">
                <div className="text-sm text-tsTextMuted px-1">No live county intel yet. Try one of these real-data queries:</div>
                <div className="flex gap-2 flex-wrap">
                  {trendingPromptSuggestions.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleQuickPrompt(prompt)}
                    disabled={isLoading || isAutoPrompting}
                    className="px-3 py-2 rounded-full bg-slate-900/80 border border-tsBorder text-xs text-tsTextMain hover:border-tsAccent hover:text-white transition shadow-sm shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {prompt}
                  </button>
                  ))}
                </div>
                </div>
              )}
              </div>
            </div>
            </div>

            {!isMobile && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              {navClusters.map((cluster) => (
                <div key={cluster.label} className="rounded-2xl border border-white/5 bg-slate-950/70 p-5 shadow-lg shadow-black/30 space-y-3">
                <div className="text-xs uppercase tracking-[0.18em] text-tsTextMuted">{cluster.label}</div>
                <div className="space-y-3">
                  {cluster.items.map((item) => {
                  const tone =
                    cluster.tone === "primary"
                    ? "border-orange-500/60 text-white hover:border-orange-400 hover:shadow-orange-500/30"
                    : cluster.tone === "secondary"
                      ? "border-white/10 text-tsTextMain hover:border-tsAccent"
                      : "border-white/5 text-tsTextMuted hover:border-white/15";
                  return (
                    <a
                    key={item.href}
                    href={item.href}
                    className={`block rounded-xl border bg-slate-900/60 px-4 py-3 transition.duration-100 hover:-translate-y-[1px] hover:shadow-lg ${tone}`}
                    >
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-xs text-tsTextMuted leading-relaxed">{item.desc}</div>
                    </a>
                  );
                  })}
                </div>
                </div>
              ))}
              </div>

              <div className="w-full bg-slate-900/70 border border-tsBorder rounded-2xl p-4 sm:p-5 shadow-xl shadow-black/30 space-y-3 text-left">
              <div className="text-xs uppercase tracking-[0.16em] text-tsTextMuted">Quick starts</div>
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
                     disabled={isLoading || isAutoPrompting}
                     className="text-[11px] px-2.5 py-1.5 rounded-full bg-slate-900/80 border border-tsBorder text-tsTextMain hover:border-tsAccent hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    {next}
                    </button>
                  ))}
                  </div>
                </div>
                ))}
              </div>
              </div>
            </>
            )}
          </div>
          </div>
      </div>
    </div>

    {!isMobile && (
    <footer className="w-full bg-slate-950 border-t border-tsBorder/60 mt-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {footerColumns.map((col) => (
            <div key={col.title} className="space-y-2">
              <div className="text-sm font-semibold text-white">{col.title}</div>
              <div className="space-y-1.5">
                {col.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="block text-sm text-tsTextMuted hover:text-white transition"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-tsTextMuted">
          <div className="text-tsTextMain">TradeScout: The #1 source for #1 sources.</div>
          <div className="text-xs text-tsTextMuted">Charcoal base, thin accents. Built for confidence at first glance.</div>
        </div>
      </div>
    </footer>
    )}
    <AppDrawer
      isOpen={appDrawerOpen}
      onClose={() => setAppDrawerOpen(false)}
      isAdmin={isAdmin}
    />
    </React.Fragment>
  );
}
