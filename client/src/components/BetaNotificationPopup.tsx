import React, { useState, useEffect } from 'react';
// Force cache refresh
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, Rocket, Users, Zap } from "lucide-react";

export function BetaNotificationPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      // Check if user has seen the beta notification
      const hasSeenBetaNotification = localStorage.getItem('hasSeenBetaNotification');
      if (!hasSeenBetaNotification) {
        // Show after a short delay
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 2000);

        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error('BetaNotificationPopup localStorage error:', error);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    try {
      // Mark as seen for this session
      localStorage.setItem('hasSeenBetaNotification', 'true');
    } catch (error) {
      console.error('Failed to save beta notification state:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
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
                  This is a beta version. Do not enter real personal information, credit card details, or attempt to make actual payments. Use test data only.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Rocket className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Early Access
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Be among the first to experience new features and provide feedback.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Community Feedback
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Your input is valuable! If you hit an error, please take a screenshot and email it with a brief note to{" "}
                    <a
                      href="mailto:info.tradescout@gmail.com"
                      className="underline underline-offset-2"
                    >
                      info.tradescout@gmail.com
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            This notice will only appear once per session.
          </p>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleClose} className="bg-orange-600 hover:bg-orange-700">
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}