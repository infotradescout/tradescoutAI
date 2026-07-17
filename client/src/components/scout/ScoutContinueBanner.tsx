import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Sparkles } from "lucide-react";

export function ScoutContinueBanner({ className }: { className?: string }) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const resume = useMemo(() => {
    const prefs: any = (user as any)?.preferences || {};
    const scout: any = prefs.scout || {};
    return scout.resume || null;
  }, [user]);

  if (!isAuthenticated) return null;
  if (!resume || typeof resume.prompt !== "string" || !resume.prompt.trim()) return null;

  const prompt = resume.prompt as string;
  const onContinue = () => {
    try {
      window.localStorage.setItem("scout:prefill:scout-main", prompt);
    } catch {
      // Scout still opens even when local draft storage is unavailable.
    }
    const params = new URLSearchParams({ source: "scout_resume" });
    if (typeof resume.intent === "string" && resume.intent.trim()) {
      params.set("intent", resume.intent.trim());
    }
    navigate(`/scout?${params.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={onContinue}
      aria-label="Continue with Scout"
      title="Continue with Scout"
      className={[
        "fixed z-40 inline-flex h-11 items-center gap-2 rounded-full px-4",
        "right-3 md:right-6",
        "bottom-[calc(var(--bottom-nav-h,64px)+10px)] md:bottom-6",
        "border border-orange-300/40 bg-orange-500 text-sm font-semibold text-black",
        "shadow-[0_10px_32px_rgba(249,115,22,0.28)]",
        "transition-transform duration-150 hover:-translate-y-0.5",
        className || "",
      ].join(" ")}
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span>Continue with Scout</span>
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
