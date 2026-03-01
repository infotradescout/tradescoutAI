import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FEATURE_EDUCATION_REPLACEMENT } from "@shared/governanceFlags";

const STORAGE_KEY = "intro_hold_explainer_shown_at";

export function HoldIntroTutorial() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!FEATURE_EDUCATION_REPLACEMENT) return;
    const alreadyShown = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (alreadyShown) return;

    const onSuccess = () => {
      const shown = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (shown) return;
      setOpen(true);
    };

    window.addEventListener("ts:meaningful-success", onSuccess);
    return () => window.removeEventListener("ts:meaningful-success", onSuccess);
  }, []);

  const handleAcknowledge = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setOpen(false);
  };

  if (!FEATURE_EDUCATION_REPLACEMENT) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[480px] bg-tsCard border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">You don't need tutorials here.</DialogTitle>
          <DialogDescription className="text-white/70 text-base mt-2">
            If you're unsure about anything, press and hold to see what it does. That's how
            TradeScout explains itself.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            className="w-full bg-tsCard text-white hover:bg-tsCard"
            onClick={handleAcknowledge}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
