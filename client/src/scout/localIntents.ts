import { ROUTES } from "@/lib/routes";

export type LocalNavIntent = {
  to: string;
  label: string;
  confidence: number;
};

export type LocalQuickAction =
  | { kind: "navigate"; to: string; label: string }
  | { kind: "open_note"; label: string }
  | { kind: "direct_connect_request"; label: string };

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isExplicitNavigationCommand(message: string): boolean {
  return (
    /^(go to|take me to|open|show me|navigate to)\b/.test(message) ||
    /\b(take me|send me|route me)\b/.test(message)
  );
}

export function resolveExplicitNavigationIntent(message: string): LocalNavIntent | null {
  const lower = normalize(message);
  if (!isExplicitNavigationCommand(lower)) return null;

  if (lower.includes("direct connect")) {
    return { to: "/direct-connect", label: "Direct Connect", confidence: 0.95 };
  }
  if (lower.includes("community")) {
    return { to: ROUTES.COMMUNITY ?? "/community", label: "Community", confidence: 0.95 };
  }
  if (lower.includes("exchange") || lower.includes("marketplace")) {
    return { to: ROUTES.EXCHANGE ?? "/exchange", label: "Exchange", confidence: 0.95 };
  }
  if (lower.includes("message") || lower.includes("inbox") || lower.includes("conversations")) {
    return { to: "/messages", label: "Messages", confidence: 0.95 };
  }
  if (lower.includes("support") || lower.includes("help center")) {
    return { to: ROUTES.HELP ?? "/help", label: "Help", confidence: 0.95 };
  }
  if (lower.includes("settings")) {
    return { to: ROUTES.SETTINGS ?? "/settings", label: "Settings", confidence: 0.95 };
  }
  if (
    lower.includes("profile settings") ||
    lower.includes("profile colors") ||
    lower.includes("palette")
  ) {
    return { to: "/profile-settings", label: "Profile Settings", confidence: 0.92 };
  }
  if (
    lower.includes("contractor") ||
    lower.includes("contractors") ||
    lower.includes("contractor board")
  ) {
    return {
      to: ROUTES.CONTRACTORS ?? "/contractors/board",
      label: "Contractors",
      confidence: 0.9,
    };
  }
  if (lower.includes("notes")) {
    return { to: ROUTES.NOTES ?? "/notes", label: "Notes", confidence: 0.9 };
  }
  if (lower.includes("leaderboard")) {
    return { to: "/leaderboard", label: "Leaderboard", confidence: 0.9 };
  }
  if (lower.includes("sign up") || lower.includes("create account") || lower.includes("register")) {
    return { to: ROUTES.REGISTER ?? "/create-account", label: "Create Account", confidence: 0.95 };
  }

  return null;
}

const QUICK_ACTION_NAV: Record<string, string> = {
  "open my community feed in tradescout": ROUTES.COMMUNITY ?? "/community",
  "show exchange listings that match this need near me": "/exchange",
  "post a listing": "/exchange?new=1",
  "manage my listings": "/exchange?tab=my-listings",
  "view offers": "/exchange?tab=offers",
  "find a contractor": ROUTES.CONTRACTORS ?? "/contractors/board",
  "open my notes": ROUTES.NOTES ?? "/notes",
  "open notes": ROUTES.NOTES ?? "/notes",
  "create account": ROUTES.REGISTER ?? "/create-account",
  "create account now": ROUTES.REGISTER ?? "/create-account",
  "learn more about tradescout": `${ROUTES.HELP ?? "/help"}/how-tradescout-works`,
  leaderboard: "/leaderboard",
  "show local groups hoas and boards i can join or follow": "/hoa-management",
  "open my admin panel and monitoring tools": "/admin/panel",
  "open support tickets": ROUTES.HELP ?? "/help",
  "open help center": ROUTES.HELP ?? "/help",
  "show recent finance invoicing ledger activity": "/admin/panel?tab=finance",
  "open my jobs workspace": "/finances/jobs",
  "view invoices and payments": "/finances",
  "post a new job": "/lead-management?new=1",
  "help me send a targeted broadcast announcement from notification ops":
    "/admin/panel?tab=notification-ops",
  "open hoa dashboard": "/hoa-dashboard",
  "post hoa notice": "/hoa-management?tab=notices",
  "review dues and payments": "/hoa-dashboard?tab=dues",
};

const QUICK_ACTION_OPEN_NOTE = new Set([
  "open a floating note",
  "open floating note",
  "open a quick note",
  "open quick note",
  "open a floating note to keep this visible",
]);

export function resolveQuickActionIntent(rawLabel: string): LocalQuickAction | null {
  const label = normalize(rawLabel);

  if (label === "start a direct connect request for this") {
    return { kind: "direct_connect_request", label: rawLabel };
  }

  if (QUICK_ACTION_OPEN_NOTE.has(label)) {
    return { kind: "open_note", label: rawLabel };
  }

  const to = QUICK_ACTION_NAV[label];
  if (to) {
    return { kind: "navigate", to, label: rawLabel };
  }

  return null;
}
