import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PreferredSourcePromptProps {
  userId: string;
  onClose: () => void;
}

export function PreferredSourcePrompt({ userId, onClose }: PreferredSourcePromptProps) {
  const [showInstructions, setShowInstructions] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    checkEligibility();
  }, [userId]);

  const checkEligibility = async () => {
    try {
      const result = await apiRequest("GET", "/api/preferred-source/eligibility");
      if (result?.isEligible) {
        setIsEligible(true);
        setIsVisible(true);
      }
    } catch (err) {
      console.error("Failed to check preferred source eligibility", err);
    }
  };

  const handleDismiss = async () => {
    try {
      await apiRequest("POST", "/api/preferred-source/shown");
      setIsVisible(false);
      onClose();
    } catch (err) {
      console.error("Failed to mark prompt as shown", err);
    }
  };

  const handleAccept = async () => {
    try {
      await apiRequest("POST", "/api/preferred-source/accepted");
      setShowInstructions(true);
    } catch (err) {
      console.error("Failed to mark prompt as accepted", err);
    }
  };

  const handleInstructionsClose = () => {
    setShowInstructions(false);
    setIsVisible(false);
    onClose();
  };

  if (!isEligible || !isVisible) return null;

  return (
    <>
      {/* Main Prompt */}
      <Dialog open={isVisible && !showInstructions} onOpenChange={handleDismiss}>
        <DialogContent className="sm:max-w-[500px] bg-navy-800 border-navy-600">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 text-xl">
              <CheckCircle className="h-6 w-6 text-green-500" />
              You seem to trust TradeScout
            </DialogTitle>
            <DialogDescription className="text-navy-200 text-base leading-relaxed mt-3">
              You’ve successfully completed several real actions here. If TradeScout works for you, you can
              make it your preferred source on Google — so you find us faster next time.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-3">
            <Button
              onClick={handleAccept}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
            >
              Set as preferred source
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              className="w-full text-navy-300 hover:text-white hover:bg-navy-700"
            >
              Not now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instructions Modal */}
      <Dialog open={showInstructions} onOpenChange={handleInstructionsClose}>
        <DialogContent className="sm:max-w-[600px] bg-navy-800 border-navy-600 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">
              Set TradeScout as your preferred source
            </DialogTitle>
            <DialogDescription className="text-navy-200 text-base mt-2">
              Follow these steps to see TradeScout first in Google Search results:
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 text-navy-100">
            <div className="bg-navy-700 p-4 rounded-lg border border-navy-600">
              <h3 className="font-semibold text-white mb-2">Desktop (Chrome / Edge / Firefox)</h3>
              <ol className="list-decimal list-inside space-y-2 ml-2 text-sm">
                <li>Search for a contractor on Google</li>
                <li>Find TradeScout in the results</li>
                <li>Click the three dots (⋮) next to TradeScout</li>
                <li>Select “Set as preferred source for this topic”</li>
              </ol>
            </div>

            <div className="bg-navy-700 p-4 rounded-lg border border-navy-600">
              <h3 className="font-semibold text-white mb-2">Mobile (iOS / Android)</h3>
              <ol className="list-decimal list-inside space-y-2 ml-2 text-sm">
                <li>Search for a contractor on Google</li>
                <li>Find TradeScout in the results</li>
                <li>Tap the three dots (⋮) or “More” next to TradeScout</li>
                <li>Choose “Set as preferred source”</li>
              </ol>
            </div>

            <div className="bg-navy-900 border border-navy-600 p-4 rounded-lg text-sm text-navy-300 leading-relaxed">
              <strong className="text-navy-100">What this does:</strong> Google remembers TradeScout as your trusted source, so it surfaces us higher when you search for local work.
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleInstructionsClose}
              className="w-full bg-navy-700 hover:bg-navy-600 text-white"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
