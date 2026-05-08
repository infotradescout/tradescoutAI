import type { ScoutAction, ScoutCluster, ScoutClusterKind } from "./state";

export type SortedScoutIntent = {
  id: string;
  label: string;
  kind: ScoutClusterKind;
  confidence: number;
  reason: string;
  cluster: ScoutCluster;
  actions: ScoutAction[];
};

type MatcherConfig = {
  id: string;
  label: string;
  kind: ScoutClusterKind;
  reason: string;
  keywords: string[];
  body: string;
  actions: ScoutAction[];
  minScore?: number;
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordScore(normalized: string, keywords: string[]): number {
  if (!normalized) return 0;
  let score = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) continue;
    if (normalized.includes(normalizedKeyword)) {
      score += normalizedKeyword.includes(" ") ? 2 : 1;
    }
  }

  return score;
}

function quotedNeed(rawMessage: string): string {
  const trimmed = rawMessage.replace(/\s+/g, " ").trim();
  if (!trimmed) return "what you need";
  return trimmed.length > 120 ? `${trimmed.slice(0, 117).trim()}...` : trimmed;
}

function requestAction(rawMessage: string): ScoutAction {
  const need = quotedNeed(rawMessage);
  return {
    type: "PREFILL_INPUT",
    label: "Create request",
    subtitle: "Review before sharing",
    payload: {
      target: "direct_connect_request",
      route: "/direct-connect",
      prefill: {
        scope: need,
        urgency: /\b(today|urgent|asap|emergency|now|leak|broken|no heat|no ac)\b/i.test(rawMessage)
          ? "high"
          : "normal",
      },
    },
    primary: true,
  };
}

function askScoutAction(label: string, prompt: string): ScoutAction {
  return {
    type: "ASK_SCOUT",
    label,
    prompt,
  };
}

function matcherConfigs(rawMessage: string): MatcherConfig[] {
  const need = quotedNeed(rawMessage);

  return [
    {
      id: "local-help",
      label: "Local help",
      kind: "pros",
      reason: "Looks like you need a person, service, contractor, or local recommendation.",
      keywords: [
        "need help",
        "find help",
        "contractor",
        "contractors",
        "roofer",
        "roof",
        "leak",
        "plumber",
        "electrician",
        "hvac",
        "repair",
        "replace",
        "install",
        "quote",
        "estimate",
        "service",
        "handyman",
        "cleaner",
        "lawn",
        "landscape",
        "paint",
        "fence",
        "deck",
      ],
      body: "Scout can turn this into local help options, a saved request, or more questions before contact opens.",
      actions: [
        requestAction(rawMessage),
        { type: "NAVIGATE", label: "Browse local help", to: "/direct-connect/pros" },
        askScoutAction(
          "Sort this need",
          `Sort this info dump into the best local-help next step: ${need}`
        ),
      ],
    },
    {
      id: "saved-request",
      label: "Saved request",
      kind: "projects",
      reason: "Looks like something worth saving as a request before sharing locally.",
      keywords: [
        "request",
        "post a request",
        "job",
        "project",
        "scope",
        "budget",
        "timeline",
        "hire",
        "someone to",
        "looking for",
        "need someone",
        "can anyone",
      ],
      body: "Save the basics first. You can review the request before it becomes visible to local help.",
      actions: [
        requestAction(rawMessage),
        { type: "NAVIGATE", label: "Open saved requests", to: "/direct-connect" },
        askScoutAction(
          "Clean up my request",
          `Rewrite this as a clear local request I can review: ${need}`
        ),
      ],
    },
    {
      id: "site-search",
      label: "TradeScout search",
      kind: "site",
      reason:
        "Looks like you may be trying to find a page, tool, setting, or saved area in TradeScout.",
      keywords: [
        "where is",
        "find page",
        "tool",
        "search",
        "invoice",
        "invoices",
        "payment",
        "payments",
        "bill",
        "messages",
        "inbox",
        "settings",
        "profile",
        "help center",
        "support",
        "notes",
      ],
      body: "Scout can act like site search and open the most likely TradeScout area.",
      actions: [
        { type: "NAVIGATE", label: "Invoices and payments", to: "/finances" },
        { type: "NAVIGATE", label: "Messages", to: "/messages" },
        { type: "NAVIGATE", label: "Settings", to: "/settings" },
        askScoutAction("Find the right page", `Find the best TradeScout page or tool for: ${need}`),
      ],
    },
    {
      id: "nearby-activity",
      label: "Nearby activity",
      kind: "community",
      reason: "Looks like a local feed, post, group, event, or neighbor/community question.",
      keywords: [
        "nearby",
        "around me",
        "community",
        "neighbors",
        "neighbours",
        "posts",
        "post",
        "feed",
        "group",
        "hoa",
        "event",
        "events",
        "recommendation",
        "recommendations",
        "what is happening",
        "what's happening",
      ],
      body: "Scout can check local activity, community posts, groups, and nearby updates.",
      actions: [
        { type: "NAVIGATE", label: "Open community", to: "/community", primary: true },
        askScoutAction("Search nearby activity", `Search nearby activity related to: ${need}`),
      ],
    },
    {
      id: "exchange",
      label: "Exchange",
      kind: "marketplace",
      reason: "Looks like buying, selling, renting, equipment, materials, or listings.",
      keywords: [
        "buy",
        "sell",
        "for sale",
        "listing",
        "listings",
        "market",
        "marketplace",
        "exchange",
        "equipment",
        "materials",
        "tools",
        "rental",
        "rent",
        "truck",
        "trailer",
        "appliance",
      ],
      body: "Scout can search local listings or help you create one.",
      actions: [
        { type: "NAVIGATE", label: "Open Exchange", to: "/exchange", primary: true },
        { type: "NAVIGATE", label: "Post a listing", to: "/exchange?tab=sell" },
        askScoutAction("Search listings", `Search Exchange and local listings for: ${need}`),
      ],
    },
    {
      id: "rules-permits",
      label: "Rules and permits",
      kind: "rules",
      reason: "Looks like a permit, inspection, code, rule, or local requirement question.",
      keywords: [
        "permit",
        "permits",
        "inspection",
        "inspector",
        "code",
        "codes",
        "rule",
        "rules",
        "allowed",
        "legal",
        "ordinance",
        "county requirement",
        "city requirement",
        "license",
      ],
      body: "Scout can explain the likely rule path and keep local requirements separate from general advice.",
      actions: [
        askScoutAction("Check rules", `Check local rules, permits, and requirements for: ${need}`),
        { type: "NAVIGATE", label: "Open help", to: "/help" },
      ],
    },
  ];
}

export function sortScoutInfoDump(rawMessage: string): SortedScoutIntent[] {
  const normalized = normalize(rawMessage);
  if (!normalized || normalized.length < 2) return [];

  const configs = matcherConfigs(rawMessage);
  const scored = configs
    .map((config) => {
      const score = keywordScore(normalized, config.keywords);
      const confidence = Math.min(0.95, 0.48 + score * 0.12);
      return { config, score, confidence };
    })
    .filter(({ config, score }) => score >= (config.minScore ?? 1))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .slice(0, 3);

  return scored.map(({ config, confidence }) => ({
    id: config.id,
    label: config.label,
    kind: config.kind,
    confidence,
    reason: config.reason,
    actions: config.actions,
    cluster: {
      id: `sorted-${config.id}`,
      title: config.label,
      kind: config.kind,
      body: config.body,
      items: [
        {
          id: `${config.id}-reason`,
          label: config.reason,
          description:
            confidence >= 0.8 ? "Strong match from your wording" : "Useful match from your wording",
        },
      ],
      actions: config.actions,
    },
  }));
}
