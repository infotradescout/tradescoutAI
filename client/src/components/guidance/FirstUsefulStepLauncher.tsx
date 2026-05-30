import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FIRST_USE_STEP_OPTIONS } from "@/lib/firstUseGuidance";

const DISMISS_KEY = "ts:first-use-launcher:dismissed:v1";

export function FirstUsefulStepLauncher() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const dismiss = () => {
    setDismissed(true);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DISMISS_KEY, "1");
  };

  const showAgain = () => {
    setDismissed(false);
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(DISMISS_KEY);
  };

  if (dismissed) {
    return (
      <Card className="border-white/10 bg-tsCard">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-white/75">Need a starting point? Reopen first-use choices.</p>
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 text-white"
            onClick={showAgain}
          >
            Show choices
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-tsCard">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-white">Where should I start?</CardTitle>
        <div className="pt-1">
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-white/65 underline-offset-2 hover:text-white/85 hover:underline"
          >
            Dismiss
          </button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {FIRST_USE_STEP_OPTIONS.map((option) => (
          <Link key={option.id} href={option.href}>
            <a className="block rounded-lg border border-white/10 bg-black/20 px-3 py-2 transition hover:border-ts-orange/40">
              <p className="text-sm font-semibold text-white">{option.label}</p>
              <p className="mt-1 text-xs text-white/70">{option.description}</p>
            </a>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
