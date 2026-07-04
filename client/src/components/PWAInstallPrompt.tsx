import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Smartphone } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useIsStandalone } from "@/hooks/useIsStandalone";

const DISMISS_KEY = "pwa-prompt-dismissed";

export function PWAInstallPrompt({ enabled = true }: { enabled?: boolean }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const isMobile = useIsMobile();
  const isStandalone = useIsStandalone();
  const { canPromptInstall, promptInstall } = useInstallPrompt();

  useEffect(() => {
    if (!enabled || isStandalone || !isMobile || !canPromptInstall) {
      setShowPrompt(false);
      return;
    }

    if (sessionStorage.getItem(DISMISS_KEY)) {
      setShowPrompt(false);
      return;
    }

    const timer = window.setTimeout(() => setShowPrompt(true), 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [canPromptInstall, enabled, isMobile, isStandalone]);

  const handleInstall = async () => {
    const didPrompt = await promptInstall();
    if (didPrompt) setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem(DISMISS_KEY, "true");
  };

  if (
    !enabled ||
    isStandalone ||
    !isMobile ||
    !canPromptInstall ||
    !showPrompt ||
    sessionStorage.getItem(DISMISS_KEY)
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
      <Card className="bg-gradient-to-r from-orange-500 to-orange-600 border-none text-white shadow-2xl">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="bg-white/20 p-2 rounded-lg">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">Install TradeScout App</h3>
                <p className="text-xs text-ts-orange leading-relaxed">
                  Add TradeScout to your home screen so it opens like an app and gets you back to
                  Scout faster.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-white hover:bg-white/20 h-8 w-8 p-0 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              onClick={handleInstall}
              className="bg-white text-ts-orange hover:bg-ts-orange/10 flex-1 text-sm font-medium"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Install App
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              className="text-white hover:bg-white/20 text-sm"
              size="sm"
            >
              Maybe Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
