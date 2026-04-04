import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TutorialContent = {
  title: string;
  description: string;
  bullets: string[];
  primaryAction: string;
};

export const TUTORIAL_VERSION = "v1";
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
      setOpen(false);
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
        // Fail-soft: do not block navigation if storage is unavailable.
      }
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? handleClose() : setOpen(true))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tutorial.title}</DialogTitle>
          <DialogDescription>{tutorial.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {tutorial.bullets.map((item) => (
            <p key={item} className="text-sm text-white/80">
              • {item}
            </p>
          ))}
        </div>

        <label className="flex items-center gap-2 pt-1 text-sm text-white/80">
          <Checkbox
            checked={neverShowAgain}
            onCheckedChange={(checked) => setNeverShowAgain(checked === true)}
          />
          Never show this page guide again
        </label>

        <DialogFooter>
          <Button onClick={handleClose} className="bg-ts-orange text-white hover:bg-ts-orange-dark">
            {tutorial.primaryAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
