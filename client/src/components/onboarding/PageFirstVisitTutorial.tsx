import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TutorialContent = {
  title: string;
  description: string;
  bullets: string[];
  primaryAction: string;
};

const sessionSeenFallback = new Set<string>();
const sessionNeverFallback = new Set<string>();

export const TUTORIAL_VERSION = "v4";
export const TUTORIAL_SEEN_PREFIX = "ts:page_tutorial_seen";
export const TUTORIAL_NEVER_PREFIX = "ts:page_tutorial_never";

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
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/create-account") ||
    path.startsWith("/pre-scout-setup") ||
    path.startsWith("/onboarding/")
  );
}

export function getPageTutorial(path: string): TutorialContent {
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

  if (path.startsWith("/community-feed")) {
    return {
      title: "Community feed quick guide",
      description: "This is where you see local activity and decide what to follow up on.",
      bullets: [
        "Read posts to understand context before taking action.",
        "Use Ask Scout or Direct Connect when you are ready to move forward.",
        "Keep actions local and relevant to your county context.",
      ],
      primaryAction: "Explore feed",
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

  if (path.startsWith("/commercial-directory")) {
    return {
      title: "Commercial Opportunities quick guide",
      description:
        "This page shows county-scoped commercial projects and your readiness to submit bids.",
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
        "Use your county context and verification status as your go/no-go gate.",
        "Move to bid submission only when requirements are satisfied.",
      ],
      primaryAction: "Review project",
    };
  }

  return {
    title: "Quick page guide",
    description: "You are on a core TradeScout page. Here is the fastest way to use it.",
    bullets: [
      "Look at the page title and section labels first.",
      "Use the main button on this page to take the next step.",
      "If anything feels unclear, ask Scout for guidance.",
    ],
    primaryAction: "Continue",
  };
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

    try {
      const never = window.localStorage.getItem(storageKeys.never) === "1";
      const seenVersion = window.localStorage.getItem(storageKeys.seen);
      if (never || seenVersion === TUTORIAL_VERSION) {
        setOpen(false);
        return;
      }
      setNeverShowAgain(false);
      setOpen(true);
    } catch {
      const never = sessionNeverFallback.has(storageKeys.never);
      const seenVersion = sessionSeenFallback.has(storageKeys.seen);
      if (never || seenVersion) {
        setOpen(false);
        return;
      }
      setNeverShowAgain(false);
      setOpen(true);
    }
  }, [path, storageKeys.never, storageKeys.seen]);

  const handleClose = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(storageKeys.seen, TUTORIAL_VERSION);
        if (neverShowAgain) {
          window.localStorage.setItem(storageKeys.never, "1");
        }
      } catch {
        sessionSeenFallback.add(storageKeys.seen);
        if (neverShowAgain) {
          sessionNeverFallback.add(storageKeys.never);
        }
      }
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-3 z-[1000] px-3 sm:bottom-4 sm:px-4">
      <div className="mx-auto max-w-xl">
        <Card className="border border-white/10 bg-tsCard/95 shadow-[0_18px_52px_rgba(0,0,0,0.45)] backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">{tutorial.title}</CardTitle>
            <p className="text-sm text-white/70">{tutorial.description}</p>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              {tutorial.bullets.map((item) => (
                <p key={item} className="text-sm text-white/80">
                  • {item}
                </p>
              ))}
            </div>

            <label className="flex items-center gap-2 pt-0.5 text-sm text-white/80">
              <Checkbox
                checked={neverShowAgain}
                onCheckedChange={(checked) => setNeverShowAgain(checked === true)}
              />
              Never show this page guide again
            </label>

            <div className="flex justify-end">
              <Button
                onClick={handleClose}
                className="bg-ts-orange text-white hover:bg-ts-orange-dark"
              >
                {tutorial.primaryAction}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
