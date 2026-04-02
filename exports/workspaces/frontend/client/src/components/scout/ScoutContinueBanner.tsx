import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

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
      // ignore
    }
    navigate("/scout");
  };

  return (
    <button
      type="button"
      onClick={onContinue}
      aria-label="Continue in Scout"
      title="Continue in Scout"
      className={[
        "fixed z-40 h-3.5 w-3.5 rounded-full",
        "right-3 md:right-6",
        "bottom-[calc(var(--bottom-nav-h,64px)+10px)] md:bottom-6",
        "bg-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.22)]",
        "animate-pulse hover:scale-110 transition-transform duration-150",
        className || "",
      ].join(" ")}
    >
      <span className="sr-only">Continue in Scout</span>
    </button>
  );
}
