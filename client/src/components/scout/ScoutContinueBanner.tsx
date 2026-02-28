import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const DISMISS_KEY = "scout:resume:dismissed_at:v1";

function safeParseJson(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function truncate(s: string, max = 110) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

export function ScoutContinueBanner({ className }: { className?: string }) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const resume = useMemo(() => {
    const prefs: any = (user as any)?.preferences || {};
    const scout: any = prefs.scout || {};
    return scout.resume || null;
  }, [user]);

  useEffect(() => {
    if (!resume?.updatedAt) return;
    const stored = safeParseJson(
      typeof window !== "undefined" ? window.localStorage.getItem(DISMISS_KEY) : null
    );
    setDismissed(Boolean(stored && stored.updatedAt && stored.updatedAt === resume.updatedAt));
  }, [resume?.updatedAt]);

  if (!isAuthenticated) return null;
  if (!resume || typeof resume.prompt !== "string" || !resume.prompt.trim()) return null;
  if (dismissed) return null;

  const updatedAt = typeof resume.updatedAt === "string" ? resume.updatedAt : "";
  const prompt = resume.prompt as string;
  const label =
    (typeof resume.suggestedLabel === "string" && resume.suggestedLabel.trim()) ||
    (typeof resume.intent === "string" && resume.intent.trim()) ||
    "Continue";

  const onContinue = () => {
    try {
      window.localStorage.setItem("scout:prefill:scout-main", prompt);
    } catch {
      // ignore
    }
    navigate("/scout");
  };

  const onDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify({ updatedAt }));
    } catch {
      // ignore
    }
  };

  return (
    <Card
      className={[
        "border border-white/10 bg-black/30 px-3 py-2",
        "flex items-start justify-between gap-3",
        className || "",
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-white">{label}</div>
        <div className="mt-0.5 text-[11px] text-white/60">{truncate(prompt)}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" className="h-8 px-3" onClick={onContinue}>
          Open Scout
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-white/70 hover:text-white"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
