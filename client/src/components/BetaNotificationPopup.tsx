import React, { useState, useEffect } from "react";
import { X, AlertTriangle, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BetaNotificationPopup() {
  const [isOpen, setIsOpen] = useState(false);

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
    // Mark as seen for this session
    localStorage.setItem('hasSeenBetaNotification', 'true');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Beta Version Notice
          </DialogTitle>
          <DialogDescription>
            Welcome to TradeScout Beta! You're using an early version of our platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Bug className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Found an issue?
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Use the "Report Issue" buttons throughout the site to help us improve.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Beta Features
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Some features may be incomplete or change during development.
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