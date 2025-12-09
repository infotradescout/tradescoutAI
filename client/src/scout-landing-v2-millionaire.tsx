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
const apiBase =
  apiBaseEnv ||
  ((typeof window !== "undefined" && !isLocalHost()
    ? "https://www.thetradescout.com/api"
    : "/api"));

const scoutEndpoint = `${apiBase.replace(/\/$/, "")}/scout`;
const BANNED_TERMS = ["fuck", "shit", "bitch", "asshole", "cunt", "slut", "whore"];

const containsProfanity = (text: string) => {
  const lower = text.toLowerCase();
  return BANNED_TERMS.some((term) => lower.includes(term));
};

const censorProfanity = (text: string) => {
  let cleaned = text;
  BANNED_TERMS.forEach((term) => {
    const re = new RegExp(term, "gi");
    cleaned = cleaned.replace(re, `${term[0]}***`);
  });
  return cleaned;
};

const suggestFollowUps = (prompt: string): string[] => {
  const lower = prompt.toLowerCase();
  const ideas: string[] = [];

  const locationCue = lower.includes("county") || lower.includes("zip") || lower.includes("state");
  const timelineCue =
    lower.includes("when") ||
    lower.includes("today") ||
    lower.includes("week") ||
    lower.includes("schedule");
  const pricingCue =
    lower.includes("price") ||
    lower.includes("cost") ||
    lower.includes("quote") ||
    lower.includes("budget");
  const contractorCue =
    lower.includes("contractor") ||
    lower.includes("electrician") ||
    lower.includes("plumber") ||
    lower.includes("roofer") ||
    lower.includes("pro");

  if (!pricingCue) ideas.push("Give me hyperlocal pricing with citations for this");
  if (!timelineCue) ideas.push("Find pros who can start this week and share availability");
  if (!locationCue) ideas.push("Use my county and nearby counties for matches");
  if (!contractorCue) ideas.push("Message the top 3 vetted contractors and share their replies here");

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

// Premium OS label resolver with perfect hierarchy (from Millionaire layout)
const resolveOsLabel = (user: any): string => {
  if (!user) return "TradeScout OS";

  if (user.city && user.state) {
    return `${user.city} ${user.state} OS`;
  }

  if (user.county) {
    return `${user.county} OS`;
  }

  if (user.zipcode) {
    return `${user.zipcode} OS`;
  }

  if (user.locationName) {
    return `${user.locationName} OS`;
  }

  return "Your Community OS";
};

type QuickStartCard = {
  title: string;
  blurb: string;
  action: string;
};

const pickSeason = (month: number) => {
  if ([11, 0, 1].includes(month)) return "winter";
  if ([2, 3, 4].includes(month)) return "spring";
  if ([5, 6, 7].includes(month)) return "summer";
  return "fall";
};

const buildCountyIntel = (
  county: string,
  trending: TrendingItem[],
  layer: number
): string => {
  const fallback = [
    `⚡ Active contractors online in ${county}`,
    `📈 Marketplace searches rising in ${county}`,
    `🍕 MealScout requests heating up tonight`,
    `🛠️ Projects trending in ${county}`,
  ];

  if (trending && trending.length) {
    const top = trending[0];
    return `${top.title}${top.stat ? ` • ${top.stat}` : ""}`;
  }

  if (layer >= 3) {
    return `Local intel loading… meanwhile, ask Scout for what's hot in ${county}`;
  }

  return fallback[Math.floor(Math.random() * fallback.length)];
};

const generateQuickStarts = (
  county: string,
  roles: string[],
  isWeekend: boolean,
  hour: number,
  season: string
): QuickStartCard[] => {
  const cards: QuickStartCard[] = [];

  const pushCard = (title: string, blurb: string, action: string) => {
    if (cards.some((c) => c.action === action)) return;
    cards.push({ title, blurb, action });
  };

  if (hour < 12) {
    pushCard("Find morning contractors", `Availability checks for ${county}`, `Find contractors in ${county}`);
    pushCard("Price my project", "Get county-cited pricing", `Price my project in ${county}`);
  } else if (hour >= 17) {
    pushCard("Tonight's MealScout", "Food trucks + offers near you", "Find tonight's MealScout food truck");
    pushCard("Evening deals", "Marketplace picks trending now", `Explore marketplace deals in ${county}`);
  }

  if (isWeekend) {
    pushCard("Weekend projects", "Plan jobs and order materials", "Plan my weekend projects");
    pushCard("Sunday reset", "Create my weekly project list", "Create my weekly project list");
  }

  if (season === "winter") {
    pushCard("Winterize my home", "Check HVAC/roof prep", "Winterize my home checklist");
  } else if (season === "summer") {
    pushCard("Deck & outdoor", "Permits + top builders", "Check deck permits in my county");
  }

  if (roles.includes("contractor")) {
    pushCard("Find homeowners", "See who needs bids now", "Find homeowners needing bids");
    pushCard("Update my profile", "Boost ranking in ${county}", "Update my contractor profile");
  }

  if (roles.includes("homeowner")) {
    pushCard("Get vetted bids", "Top pros filtered by county", `Get bids from vetted pros in ${county}`);
  }

  pushCard("County intel", "What changed this week", `Show county intel for ${county}`);

  return cards.slice(0, 6);
};

export default function ScoutLanding() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sendPulse, setSendPulse] = useState(false);
  const [pendingCopy, setPendingCopy] = useState<string | null>(null);
  const [autoPromptPreview, setAutoPromptPreview] = useState<string | null>(null);
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([]);
  const [trendingStatus, setTrendingStatus] = useState<TrendingStatus>("idle");
  const [navOpen, setNavOpen] = useState(false);
  const [countyIntel, setCountyIntel] = useState<string>("");
  const [appDrawerOpen, setAppDrawerOpen] = useState(false);
  const [quickStartCards, setQuickStartCards] = useState<QuickStartCard[]>([]);
  const [isAutoPrompting, setIsAutoPrompting] = useState(false);

  // Hybrid-mode switches
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });
  const [showReasoningSheet, setShowReasoningSheet] = useState(false);
  const [reasoningLog, setReasoningLog] = useState<string[]>([]);

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

  // Handle viewport changes for hybrid layout
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 768);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, []);

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

  const addressParts =
    user?.address?.split(",").map((part: string) => part.trim()).filter(Boolean) || [];
  const addressDerivedCommunity = addressParts[1] || addressParts[0] || "";
  const rawCommunity =
    user?.city || user?.county || addressDerivedCommunity || user?.state || "";
  const communityLabel = rawCommunity.trim();
  const headlineCommunity =
    isAuthenticated && communityLabel ? communityLabel : "Local Community";
  const ownerName = user?.firstName || user?.lastName || "you";
  const osLabel = isAuthenticated ? resolveOsLabel(user) : "TradeScout OS";

  const pushMessage = (message: Message) => {
    const id =
      message.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
        userInteractedRef.current = true;
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

    const userMessage: Message = {
      role: "user",
      content: messageToSend,
      timestamp: new Date(),
    };

    pushMessage(userMessage);
    setInputValue("");
    setIsLoading(true);
    setPendingCopy(thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)]);

    // Reasoning rail: basic, but wired to real events
    setReasoningLog(["Analyzing your request…"]);
    if (isMobile) {
      setShowReasoningSheet(true);
    }

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

      setReasoningLog((prev) => [
        ...prev,
        "Retrieving local intelligence…",
        "Formulating response…",
      ]);

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
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Scout] Error sending message:", errorMsg, error);
      setReasoningLog((prev) => [...prev, `Error: ${errorMsg}`]);
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
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
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

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      setIsAutoPrompting(false);
    }
  }, [messages.length]);

  // Guest-only boot + autorun
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

  // County intel banner (24h cache)
  useEffect(() => {
    const county = headlineCommunity || user?.county || "your county";
    const cacheKey = `ts_county_intel_${county.toLowerCase().replace(/\s+/g, "_")}`;
    const cachedRaw = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000 && cached.value) {
          setCountyIntel(cached.value as string);
          return;
        }
      } catch (_) {}
    }

    const intel = buildCountyIntel(county, trendingItems, 1);
    setCountyIntel(intel);
    if (typeof window !== "undefined") {
      localStorage.setItem(cacheKey, JSON.stringify({ value: intel, timestamp: Date.now() }));
    }
  }, [headlineCommunity, trendingItems, user]);

  // AI-like quick start layout (client generated)
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    const season = pickSeason(now.getMonth());
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const county = headlineCommunity || user?.county || "your county";
    const roles: string[] = (user as any)?.roles || (user as any)?.userTypes || [];
    setQuickStartCards(generateQuickStarts(county, roles, isWeekend, hour, season));
  }, [headlineCommunity, user, messages.length]);

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

  const getTrendingFallback = (_countyKey: string): TrendingItem[] => {
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
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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
        const resp = await fetch(
          `${apiBase}/trending?county=${encodeURIComponent(countyKey)}`
        );
        if (!resp.ok) throw new Error("Failed trending fetch");
        const data = await resp.json();
        const items: TrendingItem[] = Array.isArray(data?.items)
          ? (data.items
              .map((item: any) => normalizeTrendingItem(item, countyKey))
              .filter(Boolean)
              .slice(0, 8) as TrendingItem[])
          : [];

        if (items.length === 0) {
          setTrendingItems([]);
          setTrendingStatus("empty");
          if (typeof window !== "undefined") {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({ items: [], timestamp: Date.now() })
            );
          }
          return;
        }

        setTrendingItems(items);
        setTrendingStatus("ready");

        if (typeof window !== "undefined") {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ items, timestamp: Date.now() })
          );
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
      next: [
        "Start the Community Builder for my county",
        "Invite top contractors in my zip",
        "Draft a welcome post for neighbors",
      ],
    },
    {
      title: "Find Contractors",
      body: "Tell me the project and location. I'll pull verified contractors, message them, or create a project request for you.",
      next: [
        "Find roofers available this week",
        "Create a project for kitchen remodel",
        "Message the top 3 electricians near me",
      ],
    },
    {
      title: "Marketplace",
      body: "Browse or list items instantly. I can surface hot deals, compare similar items, or create a listing for you.",
      next: [
        "Show me today’s best tool deals",
        "List my pressure washer for $250",
        "Find used trailers within 50 miles",
      ],
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
        { label: "Contractors", href: "/find-contractors", desc: "Post a job or pull vetted pros fast" },
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

  const separateThought = (text: string) => {
    const marker = /how i['’]m thinking:/i;
    if (!marker.test(text)) return { thought: "", response: text };

    const parts = text.split(/\n\n+/);
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
    const lines = response
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const blocks: React.ReactNode[] = [];
    let list: string[] = [];

    const flushList = () => {
      if (!list.length) return;
      blocks.push(
        <ul
          key={`list-${blocks.length}`}
          className="list-disc list-outside pl-5 space-y-1 text-white/90"
        >
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

  const navLinks = [
    { label: "SCOUT", href: "/" },
    { label: "Contractors", href: "/find-contractors" },
    { label: "Marketplace", href: "/marketplace" },
    { label: "Community", href: "/community" },
  ];

  const appDrawerItems = [
    "Contractors",
    "Contractor Board",
    "Marketplace",
    "MealScout",
    "Community Builder",
    "County Hub",
    "Dashboard",
    "Safety & Compliance",
    "Groups",
    "Notifications",
    "Settings",
  ];

  // ========= MOBILE: Millionaire-style layout =========
  if (isMobile) {
    return (
      <>
        {/* Mobile side menu */}
        {navOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/60"
              onClick={() => setNavOpen(false)}
            />
            <div className="fixed left-0 top-[56px] bottom-0 w-[72vw] max-w-xs z-40 bg-slate-950 border-r border-white/10 flex flex-col overflow-y-auto">
              <nav className="p-4 space-y-2 flex-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setNavOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm text-tsTextMain hover:bg-white/10 transition"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              {!isAuthenticated && (
                <div className="p-4 border-t border-white/10 space-y-2">
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

        <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-[#060b1c] via-[#0a0f28] to-[#060b1c] text-white overflow-hidden">
          {/* Mobile header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 backdrop-blur-md bg-black/30">
            <button
              onClick={() => setNavOpen(!navOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              aria-label="Menu"
            >
              {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <Home className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-sm">TradeScout</span>
            </div>
            {isAuthenticated ? (
              <a
                href="/dashboard"
                className="text-[11px] px-3 py-1 rounded-lg bg-tsAccent text-black font-semibold"
              >
                App
              </a>
            ) : (
              <a
                href="/register"
                className="text-[11px] px-3 py-1 rounded-lg bg-orange-600 text-white font-semibold"
              >
                Sign Up
              </a>
            )}
          </div>

          {/* OS label pill */}
          <div className="px-4 pt-4 pb-2 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold tracking-[0.18em] uppercase text-tsAccentSoft">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              {osLabel}
            </div>
          </div>

          {countyIntel && (
            <div className="px-4 pb-2">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/90 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-tsAccent" />
                <span>{countyIntel}</span>
              </div>
            </div>
          )}

          {/* Status + reasoning toggle */}
          <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/70 bg-black/30">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  isLoading ? "bg-orange-400 animate-ping" : "bg-cyan-400"
                }`}
              />
              <span>{isLoading ? "Scout Thinking" : "Scout Ready"}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowReasoningSheet(true)}
              className="text-[10px] underline underline-offset-2 text-tsAccentSoft"
            >
              View Thinking
            </button>
          </div>

          {quickStartCards.length > 0 && (
            <div className="px-4 pt-3 pb-2 grid grid-cols-1 gap-2">
              {quickStartCards.map((card) => (
                <button
                  key={card.action}
                  className="text-left rounded-xl border border-white/10 bg-white/5 px-3 py-2 shadow-sm hover:border-tsAccent/60 transition"
                  onClick={() => handleQuickPrompt(card.action)}
                  disabled={isLoading || isAutoPrompting}
                >
                  <div className="text-xs text-tsAccent font-semibold">{card.title}</div>
                  <div className="text-[12px] text-white/85">{card.blurb}</div>
                </button>
              ))}
            </div>
          )}

          {/* Mobile app drawer */}
          <div className="fixed left-3 bottom-3 z-40 flex flex-col gap-2">
            <button
              onClick={() => setAppDrawerOpen(!appDrawerOpen)}
              className="h-11 w-11 rounded-full bg-gradient-to-br from-tsAccent to-orange-700 shadow-lg shadow-orange-600/40 border border-white/15 flex items-center justify-center"
              aria-label="Open app drawer"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            {appDrawerOpen && (
              <div className="w-60 rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/40 p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-tsAccentSoft pb-1 border-b border-white/10">
                  TradeScout Apps
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  {appDrawerItems.map((item) => (
                    <a
                      key={item}
                      href={`/${item.toLowerCase().replace(/\s+/g, "-")}`}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-white/90 hover:border-tsAccent/60 transition"
                      onClick={() => setAppDrawerOpen(false)}
                    >
                      {item}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat viewport */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gradient-to-b from-slate-950/40 to-black/30"
          >
            {messages.map((message) => (
              <div key={message.id || `${message.role}-${message.timestamp.getTime()}`}>
                <div
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed border ${
                      message.role === "user"
                        ? "bg-orange-600/30 border-orange-500/40 text-white"
                        : "bg-white/5 border-white/15 text-white/90"
                    }`}
                  >
                    {message.role === "assistant"
                      ? renderAssistantContent(message.content)
                      : message.content}
                  </div>
                </div>
                {message.role === "assistant" &&
                  message.suggestedActions &&
                  message.suggestedActions.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2 max-w-[80%]">
                      {message.suggestedActions.map((action, i) => (
                        <button
                          key={i}
                          className="scout-suggestion text-left px-3 py-2 rounded-lg text-[12px] font-medium border border-tsAccent/40 bg-slate-950/80 hover:bg-slate-900 transition disabled:opacity-50"
                          onClick={() => handleQuickPrompt(action)}
                          disabled={isLoading}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {(isLoading || pendingCopy) && (
              <div className="flex justify-start mt-2">
                <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs text-tsTextMuted flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                  <span>{pendingCopy || "Scout is thinking…"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <form
            className="px-4 py-3 border-t border-white/10 bg-black/50 backdrop-blur-xl flex gap-2 items-center relative"
            onSubmit={(e) => {
              e.preventDefault();
              markUserInteracted();
              handleSendMessage();
            }}
          >
            {isAutoPrompting && (
              <div className="absolute left-4 right-4 -top-6 text-[11px] text-tsTextMuted flex items-center gap-2">
                <span className="loading-dot" />
                <span>Scout is auto-starting with a guided prompt…</span>
              </div>
            )}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                markUserInteracted();
                setInputValue(e.target.value);
              }}
              onFocus={markUserInteracted}
              placeholder="Ask Scout about projects, pros, deals, or permits..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:border-orange-500/60 transition"
              disabled={isLoading || isAutoPrompting}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading || isAutoPrompting}
              className="p-2 rounded-lg bg-tsAccent text-black hover:opacity-90 disabled:opacity-50 transition inline-flex items-center justify-center"
              aria-label="Send"
            >
              {isLoading ? (
                <Activity className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>

        {/* Reasoning bottom sheet */}
        {showReasoningSheet && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setShowReasoningSheet(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-white/10 rounded-t-2xl shadow-2xl shadow-black/50 max-h-[60vh] flex flex-col">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-tsTextMuted">
                  Reasoning Log
                </span>
                <button
                  onClick={() => setShowReasoningSheet(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-4 h-4 text-white/80" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-xs text-white/75">
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
      </>
    );
  }

  // ========= DESKTOP (and larger) CLASSIC OS LAYOUT =========
  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-[#060b1c] text-white flex items-start justify-center px-3 sm:px-4 pb-16">
      <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-tsBorder bg-slate-950/85 shadow-2xl shadow-black/60 px-4 sm:px-8 py-6 sm:py-8">
        {/* Mobile side menu (for small desktop widths / tablets) */}
        {navOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={() => setNavOpen(false)}
          >
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
                    <div className="text-xs uppercase tracking-[0.22em] text-tsAccentSoft">
                      TradeScout
                    </div>
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

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,#0b1834,#030814_60%,#020617)] opacity-85" />
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-56 h-56 bg-orange-500/14 blur-3xl" />
          <div className="absolute bottom-[-5%] right-1/4 w-96 h-96 bg-cyan-500/12 blur-3xl" />
        </div>

        <div className="relative z-10 space-y-10">
          {/* Universal App Drawer */}
          <div className="fixed left-4 bottom-4 z-40 flex flex-col gap-2">
            <button
              onClick={() => setAppDrawerOpen(!appDrawerOpen)}
              className="h-12 w-12 rounded-full bg-gradient-to-br from-tsAccent to-orange-700 shadow-lg shadow-orange-600/40 border border-white/15 flex items-center justify-center hover:-translate-y-[1px] transition"
              aria-label="Open app drawer"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            {appDrawerOpen && (
              <div className="w-64 rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/40 p-3 space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-tsAccentSoft pb-1 border-b border-white/10">
                  TradeScout Apps
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {appDrawerItems.map((item) => (
                    <a
                      key={item}
                      href={`/${item.toLowerCase().replace(/\s+/g, "-")}`}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-white/90 hover:border-tsAccent/60 transition"
                      onClick={() => setAppDrawerOpen(false)}
                    >
                      {item}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Header */}
          <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-tsBorder text-tsTextMuted"
                onClick={() => setNavOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-tsAccent to-orange-700 flex items-center justify-center shadow-2xl shadow-orange-500/40">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-tsAccentSoft">
                    TradeScout
                  </div>
                  <div className="text-sm text-tsTextMuted">Community Operating System</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hidden md:inline-flex text-sm text-tsTextMuted hover:text-white transition"
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <a
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-white border border-white/10 hover:bg-white/10"
                >
                  Open Dashboard
                </a>
              ) : (
                <a
                  href="/register"
                  className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-600/30 hover:-translate-y-[1px] transition-transform duration-100"
                >
                  Create Free Account
                </a>
              )}
            </div>
          </div>

          {/* Hero + OS controller */}
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold tracking-[0.18em] uppercase text-tsAccentSoft shadow-lg shadow-orange-500/15">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              {isAuthenticated ? `${headlineCommunity} • Your Operating System` : osLabel}
            </div>

            {countyIntel && (
              <div className="w-full max-w-3xl">
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 flex items-center gap-2 justify-center">
                  <span className="w-2 h-2 rounded-full bg-tsAccent" />
                  <span>{countyIntel}</span>
                </div>
              </div>
            )}

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

            {quickStartCards.length > 0 && (
              <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-3 px-2">
                {quickStartCards.map((card) => (
                  <button
                    key={card.action}
                    className="text-left rounded-xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm hover:border-tsAccent/70 transition"
                    onClick={() => handleQuickPrompt(card.action)}
                    disabled={isLoading || isAutoPrompting}
                  >
                    <div className="text-xs text-tsAccent font-semibold">{card.title}</div>
                    <div className="text-sm text-white/85">{card.blurb}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Main Scout card */}
            <div className="w-full max-w-4xl space-y-5">
              <div className="bg-[#0c152c]/90 border border-tsBorder rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
                <div className="border-b border-tsBorder px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs uppercase tracking-[0.14em] text-tsTextMuted">
                  <div className="flex items-start sm:items-center gap-3 flex-wrap">
                    <span
                      className={`inline-flex h-2.5 w-2.5 rounded-full ${
                        isLoading ? "bg-orange-400 animate-ping" : "bg-cyan-400 animate-pulse"
                      }`}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-left">
                      <span>Scout Active</span>
                      <span className="text-[11px] text-tsTextMuted/80 lowercase tracking-normal">
                        {isLoading ? "running actions" : "standing by"}
                      </span>
                      <span className="text-[11px] text-tsTextMuted/70 lowercase tracking-normal">
                        find pros, deals, growth, MealScout — tell me a project.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] sm:justify-end">
                    <Activity className="w-4 h-4" />
                    <span className="whitespace-nowrap">Live Scout thread</span>
                  </div>
                </div>

                <div className="px-4 sm:px-5 py-5 space-y-4">
                  <div
                    className="rounded-xl border border-white/5 bg-[#0c1a33]/70 p-4 max-h-80 overflow-y-auto shadow-inner shadow-black/20 space-y-4"
                    ref={scrollRef}
                  >
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div
                          key={message.id || `${message.role}-${message.timestamp.getTime()}`}
                          className={`space-y-1 ${
                            message.role === "user" ? "text-right" : "text-left"
                          }`}
                        >
                          <div className="text-[11px] uppercase tracking-[0.12em] text-tsTextMuted flex items-center gap-2">
                            <span
                              className={`inline-flex h-1.5 w-1.5 rounded-full ${
                                message.role === "user" ? "bg-tsAccent" : "bg-orange-400"
                              }`}
                            />
                            {message.role === "user" ? "You" : "Scout"}
                          </div>
                          <div
                            className={`inline-block max-w-full rounded-xl border px-4 py-3 text-sm leading-relaxed shadow-md text-left
                            ${
                              message.role === "user"
                                ? "bg-slate-900/80 border-tsAccent/40 text-white"
                                : "bg-slate-900/85 border-orange-300/50 text-white shadow-orange-500/15"
                            }
                          `}
                            style={
                              message.role === "assistant"
                                ? { borderLeftWidth: 3, borderLeftColor: "#f59e0b" }
                                : undefined
                            }
                          >
                            {message.role === "assistant"
                              ? renderAssistantContent(message.content)
                              : message.content}
                          </div>
                          {message.role === "assistant" &&
                            message.suggestedActions &&
                            message.suggestedActions.length > 0 && (
                              <div className="flex flex-col gap-2 mt-2 max-w-md">
                                {message.suggestedActions.map((action, i) => (
                                  <button
                                    key={i}
                                    className="scout-suggestion text-left px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                    onClick={() => handleQuickPrompt(action)}
                                    disabled={isLoading}
                                  >
                                    {action}
                                  </button>
                                ))}
                              </div>
                            )}
                          <div className="text-[10px] text-tsTextMuted">
                            {message.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ))}
                      {(isLoading || pendingCopy) && (
                        <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-tsTextMuted italic shadow-sm">
                          <span className="loading-dot" />
                          <span className="loading-dot" />
                          <span className="loading-dot" />
                          <span className="ml-1">
                            {pendingCopy || "Scout is thinking…"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <form
                    className="flex flex-col sm:flex-row gap-3 items-stretch"
                    onSubmit={(e) => {
                      e.preventDefault();
                      markUserInteracted();
                      handleSendMessage();
                    }}
                  >
                    {isAutoPrompting && (
                      <div className="text-xs text-tsTextMuted flex items-center gap-2 px-1 -mb-1">
                        <span className="loading-dot" />
                        <span>Scout is auto-starting with a guided prompt…</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="relative">
                        <textarea
                          className={`w-full rounded-xl bg-[#0c1a33] border border-white/10 px-4 py-3 text-base text-white placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-tsAccent/80 min-h-[90px] ${
                            autoPromptPreview
                              ? "placeholder:opacity-0 text-transparent caret-transparent"
                              : ""
                          }`}
                          rows={3}
                          placeholder="Ask anything—local intel, permits, pros, or shortcuts across the site."
                          value={inputValue}
                          onChange={(e) => {
                            markUserInteracted();
                            setInputValue(e.target.value);
                          }}
                          onKeyPress={handleKeyPress}
                          onFocus={markUserInteracted}
                          disabled={isLoading || isAutoPrompting}
                        />
                        {autoPromptPreview && (
                          <div className="pointer-events-none absolute inset-0 px-4 py-3 text-base text-white/90">
                            <span
                              className="scout-type"
                              style={{ ["--count" as any]: autoPromptPreview.length }}
                            >
                              {autoPromptPreview}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="sm:w-32 flex sm:flex-col gap-3">
                      <button
                        type="submit"
                        disabled={!inputValue.trim() || isLoading || isAutoPrompting}
                        className={`w-full h-12 rounded-xl bg-gradient-to-r from-tsAccent to-orange-600 text-white font-semibold shadow-lg shadow-orange-600/30 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center
                          ${
                            sendPulse && !isLoading
                              ? "ring-2 ring-amber-300 scale-[1.01]"
                              : ""
                          }
                        `}
                      >
                        {isLoading ? "Working..." : "Send"}
                        <Send className="w-4 h-4 ml-2" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Quick prompts */}
              <div className="flex flex-wrap justify-start sm:justify-center gap-2 text-sm text-tsTextMuted">
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

              {/* Trending */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="text-xs uppercase tracking-[0.16em] text-tsTextMuted">
                    Popular in {headlineCommunity || "your county"} this month
                  </div>
                  <div className="text-[11px] text-tsTextMuted">
                    {trendingStatus === "loading" ? "Updating..." : "Live data only"}
                  </div>
                </div>
                <div className="overflow-x-auto pb-2">
                  <div className="flex gap-3 min-w-full">
                    {trendingStatus === "loading" && trendingItems.length === 0 &&
                      Array.from({ length: 4 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="w-60 rounded-xl border border-white/5 bg-slate-900/60 p-4 animate-pulse"
                        >
                          <div className="h-3 w-32 bg-white/10 rounded mb-2" />
                          <div className="h-3 w-20 bg-white/10 rounded" />
                        </div>
                      ))}

                    {trendingItems.length > 0 &&
                      trendingItems.map((item, idx) => (
                        <div
                          key={`${item.title}-${idx}`}
                          className="w-60 rounded-xl border border-tsBorder bg-slate-900/70 p-4 shadow-lg shadow-black/20 hover:border-tsAccent transition hover:-translate-y-[1px] duration-100"
                        >
                          <div className="text-sm font-semibold text-white line-clamp-2">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-tsTextMuted mt-2 flex items-center gap-2">
                            {item.stat && (
                              <span className="text-orange-300">{item.stat}</span>
                            )}
                            {item.delta && (
                              <span className="text-cyan-300">{item.delta}</span>
                            )}
                            {item.category && (
                              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                                {item.category}
                              </span>
                            )}
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

              {/* Nav clusters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                {navClusters.map((cluster) => (
                  <div
                    key={cluster.label}
                    className="rounded-2xl border border-white/5 bg-slate-950/70 p-5 shadow-lg shadow-black/30 space-y-3"
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-tsTextMuted">
                      {cluster.label}
                    </div>
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
                            className={`block rounded-xl border bg-slate-900/60 px-4 py-3 transition duration-100 hover:-translate-y-[1px] hover:shadow-lg ${tone}`}
                          >
                            <div className="text-sm font-semibold">{item.label}</div>
                            <div className="text-xs text-tsTextMuted leading-relaxed">
                              {item.desc}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick starts */}
              <div className="w-full bg-slate-900/70 border border-tsBorder rounded-2xl p-4 sm:p-5 shadow-xl shadow-black/30 space-y-3 text-left">
                <div className="text-xs uppercase tracking-[0.16em] text-tsTextMuted">
                  Quick starts
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {smartFirstResponses.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-xl border border-white/5 bg-slate-950/70 p-4 shadow-inner shadow-black/20 space-y-3"
                    >
                      <div className="text-sm font-semibold text-white">{card.title}</div>
                      <div className="text-xs text-tsTextMuted leading-relaxed">
                        {card.body}
                      </div>
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
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
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
            <div className="text-tsTextMain">
              TradeScout: The #1 source for #1 sources.
            </div>
            <div className="text-xs text-tsTextMuted">
              Charcoal base, thin accents. Built for confidence at first glance.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
