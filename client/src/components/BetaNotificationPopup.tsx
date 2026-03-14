import React, { useState, useEffect } from "react";
import { safeStorage } from "../utils/safeStorage";
// Force cache refresh
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, Rocket, Users, Zap } from "lucide-react";
import { PRIMARY_SUPPORT_EMAIL } from "@shared/supportInbox";

export function BetaNotificationPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      // Check if user has seen the beta notification
      const hasSeenBetaNotification = safeStorage.get("hasSeenBetaNotification");
      if (!hasSeenBetaNotification) {
        // Show after a short delay
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 2000);

        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error("BetaNotificationPopup localStorage error:", error);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    try {
      // Mark as seen for this session
      safeStorage.set("hasSeenBetaNotification", "true");
    } catch (error) {
      console.error("Failed to save beta notification state:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ts-orange">
            <Bell className="h-5 w-5" />
            Beta Version Notice
          </DialogTitle>
          <DialogDescription>
            Welcome to TradeScout Beta! You're using an early version of our platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Critical Security Warning */}
          <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-2">
              <Bell className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                  ⚠️ Important Security Notice
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  This is a beta version. Do not enter real personal information, credit card
                  details, or attempt to make actual payments. Use test data only.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-ts-orange/10 dark:bg-ts-orange/10 p-4 rounded-lg border border-ts-orange/30 dark:border-ts-orange/30">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Rocket className="h-4 w-4 text-ts-orange mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white/70 dark:text-white/70">
                    Early Access
                  </p>
                  <p className="text-xs text-white/60 dark:text-white/60">
                    Be among the first to experience new features and provide feedback.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-ts-orange mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white/70 dark:text-white/70">
                    Community Feedback
                  </p>
                  <p className="text-xs text-white/60 dark:text-white/60">
                    Your input is valuable! If you hit an error, please take a screenshot and email
                    it with a brief note to{" "}
                    <a
                      href={`mailto:${PRIMARY_SUPPORT_EMAIL}`}
                      className="underline underline-offset-2"
                    >
                      {PRIMARY_SUPPORT_EMAIL}
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/60 dark:text-white/60 text-center">
            This notice will only appear once per session.
          </p>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleClose} className="bg-ts-orange-dark hover:bg-ts-orange-dark">
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
