import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { trackShellEvent } from "@/lib/analytics";

interface OrientationCardProps {
  roleLabel: string;
  sendToScout: (prompt: string, options?: { source?: string }) => void;
  firstName?: string;
  contextSource?: "help" | "post-onboarding";
}

export function OrientationCard({
  roleLabel,
  sendToScout,
  firstName,
  contextSource = "help",
}: OrientationCardProps) {
  const { user } = useAuth();

  const handleTourClick = async () => {
    try {
      await trackShellEvent({
        type: "scout_query",
        payload: {
          event:
            contextSource === "post-onboarding"
              ? "orientation_scout_tour_clicked_post_onboarding"
              : "help_scout_tour_clicked",
          entry: contextSource === "post-onboarding" ? "dashboard_orientation" : "help_overview",
          ts: new Date().toISOString(),
        },
      });
    } catch {
      // ignore analytics failures
    }

    sendToScout(
      `I opened the orientation as a ${roleLabel}. Give me a simple tour of TradeScout and show me what I should do first based on how I'm here to participate.`,
      { source: contextSource === "post-onboarding" ? "dashboard-orientation" : "help-scout-tour" }
    );
  };

  const handleDummiesClick = () => {
    sendToScout(
      "Explain TradeScout to me in plain language, like I'm brand new here, and help me pick the right next step. Start with what Scout can do for me right now.",
      {
        source:
          contextSource === "post-onboarding" ? "dashboard-orientation-dummies" : "help-dummies",
      }
    );
  };

  const displayName = firstName || user?.firstName || (user as any)?.username || "";

  return (
    <>
      {/* Header for contexts that want a title above the card */}
      {contextSource === "help" && (
        <div className="text-center mb-5 md:mb-6">
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-3">Help Center</h1>
          <p className="text-base md:text-xl text-white/70 max-w-2xl mx-auto">
            {displayName
              ? `Hi ${displayName}, this is your hub for getting unstuck and making the most of TradeScout.`
              : "Get answers to your questions and learn how Scout and TradeScout work together for you."}
          </p>
        </div>
      )}

      <Card className="bg-tsCard/60 border-white/10 mb-5 md:mb-8">
        <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
            <div className="flex-1">
              <div className="flex items-center space-x-2 md:space-x-3 mb-2">
                <HelpCircle className="h-5 w-5 md:h-6 md:w-6 text-ts-orange" />
                <h2 className="text-lg md:text-2xl font-bold text-white">What is TradeScout?</h2>
              </div>
              <p className="text-sm md:text-base text-white/70 mb-2 md:mb-3">
                TradeScout is a local participation platform that connects people, services, and
                tools through verified community activity. Scout, the built-in community helper and
                site guide, helps you find people, organize projects, and move money and trust
                around your neighborhood without juggling ten different apps.
              </p>
              <div className="mt-1 md:mt-2 text-xs md:text-sm text-white/70 space-y-1.5">
                <p className="font-semibold text-white/70">Scout is especially useful if:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    If you're here to get projects done or keep up with maintenance, Scout helps you
                    plan, compare, and coordinate locally.
                  </li>
                  <li>
                    If you're here to offer services or grow a trade business, Scout helps you show
                    up better, respond faster, and stay top-of-mind with the right people.
                  </li>
                  <li>
                    If you're organizing properties, groups, or communities, Scout helps you keep
                    people, tasks, and tools in one operating system instead of scattered apps.
                  </li>
                </ul>
              </div>
            </div>
            <div className="md:w-56 flex-shrink-0 flex flex-col gap-2">
              <Button
                type="button"
                className="w-full bg-ts-orange hover:bg-ts-orange-dark text-sm md:text-base"
                onClick={handleTourClick}
              >
                Ask Scout for a quick tour
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full border-white/10 text-white/70 hover:bg-tsCard text-xs md:text-sm"
                onClick={handleDummiesClick}
              >
                "TradeScout for Dummies" in chat
              </Button>
              <div className="mt-1.5 border-t border-white/10 pt-1.5">
                <p className="text-[11px] md:text-xs text-white/60 mb-1">
                  What Scout can do right now:
                </p>
                <ul className="text-[11px] md:text-xs text-white/60 space-y-0.5 list-disc list-inside">
                  <li>Explain what you can do next based on your situation.</li>
                  <li>Help you find or offer services and people locally.</li>
                  <li>Walk you through tools and dashboards step-by-step.</li>
                  <li>Summarize what's happening in your area or dashboard.</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
