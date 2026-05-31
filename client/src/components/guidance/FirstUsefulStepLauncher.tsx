import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Compass } from "lucide-react";
import { FIRST_USE_STEP_OPTIONS } from "@/lib/firstUseGuidance";
import {
  trackFirstUseLauncherDismissed,
  trackFirstUseLauncherRestored,
  trackFirstUseLauncherViewed,
  trackFirstUseOptionClicked,
  type FirstUseSurface,
  type FirstUseUserState,
} from "@/lib/firstUseAnalytics";

const DISMISS_KEY = "ts:first-use-launcher:dismissed:v1";

export function FirstUsefulStepLauncher({
  surface,
  userState,
}: {
  surface: FirstUseSurface;
  userState: FirstUseUserState;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!storageLoaded || dismissed) return;
    trackFirstUseLauncherViewed(surface, userState);
  }, [dismissed, storageLoaded, surface, userState]);

  const dismiss = () => {
    setDismissed(true);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DISMISS_KEY, "1");
    trackFirstUseLauncherDismissed(surface, userState);
  };

  const showAgain = () => {
    setDismissed(false);
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(DISMISS_KEY);
    trackFirstUseLauncherRestored(surface, userState);
  };

  if (dismissed) {
    return (
      <Card className="border-white/10 bg-tsCard/95 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-white/75">
            Need a starting point? Reopen first-use choices.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-white hover:border-ts-orange/40 hover:bg-ts-orange/10"
            onClick={showAgain}
          >
            Show choices
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-ts-orange/30 bg-tsCard/95 shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-[11px] tracking-wide text-white/80">
              <Compass className="h-3.5 w-3.5 text-ts-orange" aria-hidden="true" />
              First-use guide
            </div>
            <CardTitle className="text-[1.02rem] leading-tight text-white md:text-lg">
              Where should I start?
            </CardTitle>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded px-1 text-xs text-white/65 underline-offset-2 transition hover:text-white/85 hover:underline"
          >
            Dismiss
          </button>
        </div>
        <p className="text-sm leading-relaxed text-white/74">
          Pick one path. You can switch anytime.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {FIRST_USE_STEP_OPTIONS.map((option) => (
          <Link key={option.id} href={option.href}>
            <a
              className="group block rounded-lg border border-white/10 bg-black/20 px-3.5 py-3 transition hover:border-ts-orange/40 hover:bg-black/30"
              onClick={() =>
                trackFirstUseOptionClicked({
                  surface,
                  optionId: option.id,
                  targetRoute: option.href,
                  userState,
                })
              }
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white">{option.label}</p>
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:text-ts-orange"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-white/72">{option.description}</p>
            </a>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
