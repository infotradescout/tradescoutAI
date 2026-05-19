import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type TutorialContent = {
  title: string;
  description: string;
  bullets: string[];
  primaryAction: string;
};

const sessionSeenFallback = new Map<string, string>();
const sessionNeverFallback = new Set<string>();

export const TUTORIAL_VERSION = "v5";
export const TUTORIAL_SEEN_PREFIX = "ts:page_tutorial_seen";
export const TUTORIAL_NEVER_PREFIX = "ts:page_tutorial_never";

export function readTutorialNever(neverKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(neverKey) === "1";
  } catch {
    return sessionNeverFallback.has(neverKey);
  }
}

export function readTutorialSeenVersion(seenKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(seenKey);
  } catch {
    return sessionSeenFallback.get(seenKey) ?? null;
  }
}

export function writeTutorialSeenVersion(seenKey: string, version: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(seenKey, version);
  } catch {
    sessionSeenFallback.set(seenKey, version);
  }
}

export function writeTutorialNever(neverKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(neverKey, "1");
  } catch {
    sessionNeverFallback.add(neverKey);
  }
}

export function __resetTutorialFallbackForTests(): void {
  sessionSeenFallback.clear();
  sessionNeverFallback.clear();
}

export function normalizePath(path: string): string {
  const clean = String(path || "")
    .split("?")[0]
    .split("#")[0];
  return clean.replace(/\/+$/, "") || "/";
}

export function shouldSkipPath(path: string): boolean {
  return (
    path.startsWith("/landing") ||
    path.startsWith("/lp") ||
    path.startsWith("/r/") ||
    path.startsWith("/u/") ||
    path.startsWith("/p/") ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/create-account") ||
    path.startsWith("/pre-scout-setup") ||
    path.startsWith("/onboarding/") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms") ||
    path.startsWith("/compliance")
  );
}

function humanizePathSegment(segment: string): string {
  return String(segment || "page")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildContextualFallbackTutorial(path: string): TutorialContent {
  const firstSegment = path.split("/").filter(Boolean)[0] || "page";
  const pageLabel = humanizePathSegment(firstSegment);

  return {
    title: `${pageLabel} quick guide`,
    description: `Use this ${pageLabel.toLowerCase()} page to gather context first, then choose one clear next action through Scout or Direct Connect.`,
    bullets: [
      "Start at the top summary section and identify the one outcome you need right now.",
      "Use filters, tabs, or cards to narrow to your local area and current decision.",
      "Finish one concrete action before switching pages to keep momentum.",
    ],
    primaryAction: "Continue",
  };
}

export function getPageTutorial(path: string): TutorialContent {
  if (path === "/" || path.startsWith("/home") || path.startsWith("/my-tradescout")) {
    return {
      title: "Home quick guide",
      description:
        "This is your operating home base for local priorities, pending actions, and fast routing.",
      bullets: [
        "Scan the top cards first to see what needs attention now.",
        "Use Scout when you need direction instead of searching menus.",
        "Open Direct Connect when you are ready to request real local action.",
      ],
      primaryAction: "Open my priorities",
    };
  }

  if (path.startsWith("/dashboard")) {
    return {
      title: "Dashboard quick guide",
      description:
        "Use this page to monitor current work, unblock stalled items, and keep decisions moving.",
      bullets: [
        "Review jobs and status cards before starting new tasks.",
        "Open the item with the oldest pending action first.",
        "Use Scout if a metric is unclear or you need the right next step.",
      ],
      primaryAction: "Review dashboard",
    };
  }

  if (path.startsWith("/direct-connect")) {
    return {
      title: "Direct Connect quick guide",
      description:
        "This page helps you request local help, review replies, and move work forward in one place.",
      bullets: [
        "Use New request to describe what you need in plain language.",
        "Pick businesses yourself, or let Scout decide.",
        "Check My requests and Replies to track what needs action.",
      ],
      primaryAction: "Got it",
    };
  }

  if (path.startsWith("/scout")) {
    return {
      title: "Scout quick guide",
      description:
        "Ask Scout what you need, and Scout helps you choose your next step without menu hunting.",
      bullets: [
        "Type what you need in everyday words.",
        "Use Scout links and actions to move directly to the right page.",
        "Come back here any time if you are unsure what to do next.",
      ],
      primaryAction: "Start with Scout",
    };
  }

  if (path.startsWith("/community") || path.startsWith("/groups")) {
    return {
      title: "Community quick guide",
      description:
        "Use this page to read local context first, then move from discovery into intentional action.",
      bullets: [
        "Prioritize posts tied to your local area and current decisions.",
        "Use comments to clarify context, not to replace action.",
        "When ready, move to Direct Connect or ask Scout to route the next step.",
      ],
      primaryAction: "Use community",
    };
  }

  if (path.startsWith("/community-feed")) {
    return {
      title: "Community feed quick guide",
      description: "This is where you see local activity and decide what to follow up on.",
      bullets: [
        "Read posts to understand context before taking action.",
        "Use Ask Scout or Direct Connect when you are ready to move forward.",
        "Keep actions local and relevant to your local context.",
      ],
      primaryAction: "Explore feed",
    };
  }

  if (path.startsWith("/exchange") || path.startsWith("/marketplace")) {
    return {
      title: "Exchange quick guide",
      description:
        "Use Exchange to evaluate local offers and make decisions based on fit, trust, and relevance.",
      bullets: [
        "Filter listings to your local scope before comparing options.",
        "Review trust signals and details before starting contact.",
        "Use Scout if you need help choosing between similar options.",
      ],
      primaryAction: "Review exchange",
    };
  }

  if (path.startsWith("/trade-deals")) {
    return {
      title: "Trade Deals quick guide",
      description:
        "Use this page to evaluate local deal opportunities and act only when the fit is clear.",
      bullets: [
        "Check local context and timing before committing.",
        "Compare requirements against your current readiness.",
        "Move to contact only after Scout confirms your strongest next step.",
      ],
      primaryAction: "Review deals",
    };
  }

  if (path.startsWith("/compare")) {
    return {
      title: "Comparison quick guide",
      description:
        "Use this page to compare options side by side so your next decision is evidence-based, not guesswork.",
      bullets: [
        "Start by matching options to your local area and immediate objective.",
        "Use trust and outcome signals before considering convenience or volume.",
        "Choose one path, then move directly into Scout or Direct Connect.",
      ],
      primaryAction: "Compare options",
    };
  }

  if (path.startsWith("/realtor") || path.startsWith("/car-sales")) {
    return {
      title: "Pipeline quick guide",
      description:
        "Use this page to manage leads, follow-up timing, and conversion actions without losing sequence.",
      bullets: [
        "Open the oldest unresolved follow-up first.",
        "Confirm contact context and the exact next commitment in writing.",
        "Escalate uncertain decisions to Scout before sending the next outreach.",
      ],
      primaryAction: "Review pipeline",
    };
  }

  if (path.startsWith("/hoa") || path.startsWith("/homescout")) {
    return {
      title: "Property ops quick guide",
      description:
        "Use this page to coordinate local property operations with clear visibility for residents and teams.",
      bullets: [
        "Prioritize items with resident impact or deadline risk.",
        "Keep status updates specific so handoffs stay reliable.",
        "Route ambiguous ownership issues through Scout before escalation.",
      ],
      primaryAction: "Run operations",
    };
  }

  if (
    path.startsWith("/about") ||
    path.startsWith("/how-it-works") ||
    path.startsWith("/trust-model") ||
    path.startsWith("/transparency")
  ) {
    return {
      title: "Platform clarity quick guide",
      description:
        "Use this page to understand TradeScout operating rules so your next action aligns with trust and authority.",
      bullets: [
        "Read the core operating principle first, then map it to your current decision.",
        "Use linked examples to validate how the rule applies in real workflows.",
        "Return to Scout with a specific question if a rule blocks progress.",
      ],
      primaryAction: "Review rules",
    };
  }

  if (path.startsWith("/contractors") || path.startsWith("/find-contractors")) {
    return {
      title: "Local Directory quick guide",
      description: "Use this page to compare local businesses before you send a request.",
      bullets: [
        "Filter by service and area to narrow results.",
        "Review trust details and fit, not just ads or popularity.",
        "When ready, move to Direct Connect to send your request.",
      ],
      primaryAction: "Browse businesses",
    };
  }

  if (path.startsWith("/messages") || path.startsWith("/conversations")) {
    return {
      title: "Messages quick guide",
      description:
        "Use this page to keep conversations action-focused and tied to clear next decisions.",
      bullets: [
        "Open the newest thread with unresolved action first.",
        "Confirm expectations, scope, and timing in writing.",
        "If a thread stalls, route it through Scout for decision support.",
      ],
      primaryAction: "Open messages",
    };
  }

  if (path.startsWith("/notifications")) {
    return {
      title: "Notifications quick guide",
      description: "Use notifications to triage what needs action now versus what can wait.",
      bullets: [
        "Start with alerts that block decisions or local requests.",
        "Open each item and complete one concrete action before moving on.",
        "Clear low-priority alerts only after critical items are handled.",
      ],
      primaryAction: "Review alerts",
    };
  }

  if (path.startsWith("/settings") || path.startsWith("/profile")) {
    return {
      title: "Account settings quick guide",
      description: "Use this page to keep your profile, local context, and trust details current.",
      bullets: [
        "Confirm local area and identity details before using action pages.",
        "Complete verification items that are blocking key flows.",
        "Save changes, then return to Scout or Direct Connect to continue.",
      ],
      primaryAction: "Update settings",
    };
  }

  if (path.startsWith("/foundation")) {
    return {
      title: "Foundation quick guide",
      description:
        "Use this page to review local vault projects and choose where local impact is most needed.",
      bullets: [
        "Read project purpose and local context before committing support.",
        "Prioritize projects with clear outcomes and accountability.",
        "Use Scout to align your contribution with local priorities.",
      ],
      primaryAction: "Review projects",
    };
  }

  if (path.startsWith("/help")) {
    return {
      title: "Help center quick guide",
      description: "Use this page to resolve blockers quickly and return to your active workflow.",
      bullets: [
        "Open the article that matches your current page or action.",
        "Apply one fix step at a time and confirm results.",
        "If still blocked, ask Scout and include what you already tried.",
      ],
      primaryAction: "Use help",
    };
  }

  if (path.startsWith("/maps")) {
    return {
      title: "Maps quick guide",
      description:
        "Use this page to view local geography and route decisions with local context in mind.",
      bullets: [
        "Start with your local view before expanding broader areas.",
        "Use map details to validate service relevance and proximity.",
        "Move to Direct Connect after confirming geographic fit.",
      ],
      primaryAction: "Use map view",
    };
  }

  if (path.startsWith("/finances")) {
    return {
      title: "Finances quick guide",
      description:
        "Use this page to track money movement, confirm records, and protect local operating clarity.",
      bullets: [
        "Review recent transactions and unresolved entries first.",
        "Keep invoices, records, and notes aligned before closing items.",
        "Use reports to confirm trend direction before making changes.",
      ],
      primaryAction: "Review finances",
    };
  }

  if (path.startsWith("/connections")) {
    return {
      title: "Connections quick guide",
      description:
        "Use this page to manage trusted local relationships and keep contact pathways intentional.",
      bullets: [
        "Review pending connection activity before sending new requests.",
        "Prioritize contacts with clear local relevance.",
        "Use Scout when deciding whether to deepen or pause a connection.",
      ],
      primaryAction: "Review connections",
    };
  }

  if (path.startsWith("/homescout-listings") || path.startsWith("/hoa-dashboard")) {
    return {
      title: "Local operations quick guide",
      description:
        "Use this page to manage property and neighborhood operations with clear local accountability.",
      bullets: [
        "Start with outstanding items that affect residents or timelines.",
        "Use status and notes to keep work transparent.",
        "Escalate uncertain decisions to Scout for a clear next action.",
      ],
      primaryAction: "Review operations",
    };
  }

  if (path.startsWith("/notes")) {
    return {
      title: "Notes quick guide",
      description: "Use notes to preserve context that supports future local decisions.",
      bullets: [
        "Capture facts, outcomes, and next actions, not just observations.",
        "Keep each note tied to a page, request, or project.",
        "Reference notes when asking Scout for continuity and guidance.",
      ],
      primaryAction: "Open notes",
    };
  }

  if (path.startsWith("/admin") || path.startsWith("/admin-")) {
    return {
      title: "Admin OS quick guide",
      description:
        "Use Admin OS to monitor platform signals, make governance decisions, and execute controlled interventions.",
      bullets: [
        "Start with current alerts and unresolved operational blockers.",
        "Use the left or bottom admin navigation to move between tools quickly.",
        "Confirm trust and authority impact before applying changes.",
      ],
      primaryAction: "Open admin tools",
    };
  }

  if (path.startsWith("/county") || path.startsWith("/city") || path.startsWith("/trade")) {
    return {
      title: "Local intelligence quick guide",
      description:
        "Use this page to read local and trade context before choosing contact or promotion actions.",
      bullets: [
        "Scan current metrics and recent activity first.",
        "Treat this page as decision context, not a direct contact shortcut.",
        "Move to Scout or Direct Connect when you are ready to act.",
      ],
      primaryAction: "Use local context",
    };
  }

  if (path.startsWith("/datasets") || path.startsWith("/leaderboard")) {
    return {
      title: "Data view quick guide",
      description:
        "Use this page to inspect structured facts and trends before making operational decisions.",
      bullets: [
        "Filter to the local or trade scope that matches your current goal.",
        "Use recent snapshots to validate trend direction.",
        "Convert findings into a concrete next step through Scout.",
      ],
      primaryAction: "Review data",
    };
  }

  if (path.startsWith("/tradepartners") || path.startsWith("/resource-center")) {
    return {
      title: "Partner resources quick guide",
      description:
        "Use this page to evaluate partner materials and decide what supports local outcomes.",
      bullets: [
        "Focus on resources tied to your local strategy.",
        "Prioritize assets that improve trust and conversion clarity.",
        "Save useful items and route implementation steps through Scout.",
      ],
      primaryAction: "Review resources",
    };
  }

  if (
    path.startsWith("/saved") ||
    path.startsWith("/saved-ads") ||
    path.startsWith("/saved-contractors")
  ) {
    return {
      title: "Saved items quick guide",
      description:
        "Use this page to revisit shortlisted options and turn saved context into action.",
      bullets: [
        "Re-check fit and trust before moving forward.",
        "Remove stale items so your list stays decision-ready.",
        "Open Direct Connect when you are ready to request action.",
      ],
      primaryAction: "Review saved items",
    };
  }

  if (path.startsWith("/checkout") || path.startsWith("/payment-") || path.startsWith("/wallet")) {
    return {
      title: "Payments quick guide",
      description:
        "Use this page to complete payment steps and confirm transaction status before continuing.",
      bullets: [
        "Review amount and purpose before final submission.",
        "Confirm success status and keep record details for follow-up.",
        "Return to your workflow page once payment is complete.",
      ],
      primaryAction: "Review payment",
    };
  }

  if (
    path.startsWith("/membership-portal") ||
    path.startsWith("/training-center") ||
    path.startsWith("/application-tracker")
  ) {
    return {
      title: "Program operations quick guide",
      description: "Use this page to manage progression steps and keep program decisions on track.",
      bullets: [
        "Check current status and pending requirements first.",
        "Complete one blocking requirement at a time.",
        "Use Scout when deciding the next best progression step.",
      ],
      primaryAction: "Review program status",
    };
  }

  if (path.startsWith("/commercial-directory")) {
    return {
      title: "Commercial Opportunities quick guide",
      description:
        "This page shows local-scoped commercial projects and your readiness to submit bids.",
      bullets: [
        "Review project details first, then decide what to pursue.",
        "Upload approved license and insurance documents to unlock submission.",
        "Track readiness here so you know exactly what is blocking action.",
      ],
      primaryAction: "Review opportunities",
    };
  }

  if (path.startsWith("/commercial-project")) {
    return {
      title: "Commercial project quick guide",
      description:
        "Use this page to review scope, requirements, and timelines before making a decision.",
      bullets: [
        "Check scope and documents before committing to a bid.",
        "Use your local context and verification status as your go/no-go gate.",
        "Move to bid submission only when requirements are satisfied.",
      ],
      primaryAction: "Review project",
    };
  }

  return buildContextualFallbackTutorial(path);
}

export function getTutorialStorageKeys(userScope: string, path: string) {
  const normalizedPath = normalizePath(path);
  return {
    seen: `${TUTORIAL_SEEN_PREFIX}:${userScope}:${normalizedPath}`,
    never: `${TUTORIAL_NEVER_PREFIX}:${userScope}:${normalizedPath}`,
  };
}

export default function PageFirstVisitTutorial() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [neverShowAgain, setNeverShowAgain] = useState(false);

  const path = useMemo(() => normalizePath(location || "/"), [location]);
  const userScope = useMemo(() => {
    if (isAuthenticated && user?.id) return `user:${user.id}`;
    return "guest";
  }, [isAuthenticated, user?.id]);

  const storageKeys = useMemo(() => getTutorialStorageKeys(userScope, path), [path, userScope]);

  const tutorial = useMemo(() => getPageTutorial(path), [path]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (shouldSkipPath(path)) {
      setOpen(false);
      return;
    }

    const query = typeof window.location?.search === "string" ? window.location.search : "";
    const params = new URLSearchParams(query);
    const guideRequested = params.get("guide") === "1" || params.get("help") === "1";
    const autoStartEnabled =
      String(import.meta.env.VITE_PAGE_GUIDES_AUTOSTART ?? "false") === "true";

    if (!autoStartEnabled && !guideRequested) {
      setOpen(false);
      return;
    }

    const never = readTutorialNever(storageKeys.never);
    const seenVersion = readTutorialSeenVersion(storageKeys.seen);
    if (!guideRequested && (never || seenVersion === TUTORIAL_VERSION)) {
      setOpen(false);
      return;
    }
    setNeverShowAgain(false);
    setOpen(true);
  }, [path, storageKeys.never, storageKeys.seen]);

  const handleClose = () => {
    writeTutorialSeenVersion(storageKeys.seen, TUTORIAL_VERSION);
    if (neverShowAgain) {
      writeTutorialNever(storageKeys.never);
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed right-3 top-[calc(var(--top-nav-h)+0.75rem)] z-[1000] w-[calc(100%-1.5rem)] max-w-md sm:right-4 sm:top-[calc(var(--top-nav-h)+1rem)]">
      <div className="ts-page-guide rounded-lg border p-3 backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
              {tutorial.title}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[color:var(--text-secondary)]">
              {tutorial.description}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close page guide"
            onClick={handleClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2 hidden gap-1.5 sm:grid">
          {tutorial.bullets.slice(0, 2).map((item) => (
            <p key={item} className="truncate text-[11px] text-[color:var(--text-tertiary)]">
              {item}
            </p>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="flex min-w-0 items-center gap-2 text-[11px] text-[color:var(--text-secondary)]">
            <Checkbox
              checked={neverShowAgain}
              onCheckedChange={(checked) => setNeverShowAgain(checked === true)}
            />
            <span className="truncate">Do not show again</span>
          </label>

          <Button
            onClick={handleClose}
            size="sm"
            className="bg-ts-orange text-white hover:bg-ts-orange-dark"
          >
            {tutorial.primaryAction}
          </Button>
        </div>
      </div>
    </div>
  );
}
