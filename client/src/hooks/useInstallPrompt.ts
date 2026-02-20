import { useCallback, useEffect, useState } from "react";

type BIPUserChoice = { outcome: "accepted" | "dismissed" };

// Chromium-only. iOS does not support beforeinstallprompt.
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BIPUserChoice>;
};

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBip = (e: Event) => {
      // Only call preventDefault if we are providing our own UX.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBip as EventListener);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    try {
      await deferred.prompt();
      await deferred.userChoice.catch(() => undefined);
    } finally {
      setDeferred(null);
    }
    return true;
  }, [deferred]);

  return {
    canPromptInstall: Boolean(deferred),
    promptInstall,
  };
}

