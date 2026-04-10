import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, BookOpen, Target, DollarSign, Users } from "lucide-react";
import { SEOHelmet, createFAQStructuredData } from "@/components/SEOHelmet";
import { trackShellEvent } from "@/lib/analytics";

export default function Help() {
  const [, navigate] = useLocation();

  useEffect(() => {
    try {
      void trackShellEvent({
        type: "community_shell_nav_click",
        fromPath: "/community",
        toPath: "/help",
        deviceType: "desktop",
        hasUnreadNotifications: false,
      });
    } catch {
      // Ignore analytics failures.
    }
  }, []);

  return (
    <div className="gradient-bg py-8">
      <div className="w-full max-w-4xl mx-auto px-3 md:px-4 py-6 md:py-10">
        <SEOHelmet
          title="Help Center – Articles and Guides | TradeScout"
          description="Use TradeScout Help to understand core flows, resolve blockers quickly, and move from discovery to action with Scout and Direct Connect."
          canonical="https://www.thetradescout.com/help"
          structuredData={createFAQStructuredData([
            {
              question: "What should I do first when I feel stuck on TradeScout?",
              answer:
                "Start with Scout and describe your goal in plain language. Scout routes you to the right page and tells you the next concrete step so you do not have to guess.",
            },
            {
              question: "When should I use Direct Connect instead of browsing pages?",
              answer:
                "Use Direct Connect when you are ready to request real local action. Discovery pages are for context; Direct Connect is the gated bridge into contact and execution.",
            },
            {
              question: "How does TradeScout decide what gets shown first?",
              answer:
                "TradeScout prioritizes trust, relevance, and local fit. Payment does not override trust/CVS behavior or authority constraints.",
            },
            {
              question: "Where can I learn platform rules before taking action?",
              answer:
                "Use How TradeScout Works and Trust Model pages to understand authority, contact gating, and what Scout can do before you commit to a workflow.",
            },
          ])}
        />

        <div className="mb-8 md:mb-10">
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-ts-orange" />
            TradeScout Help Home
          </h1>
          <p className="text-sm md:text-base text-white/70 max-w-2xl">
            Start here when you need clear next steps. Each section below is tuned to a real
            decision moment so you can move forward without menu hunting.
          </p>
        </div>

        <div className="space-y-6">
          {/* Start Here */}
          <Card className="bg-tsCard/60 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-lg md:text-xl">
                <BookOpen className="w-5 h-5 text-ts-orange" />
                Start Here: How TradeScout Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm md:text-base text-white/70">
              <p>
                Read this first if you want the shortest explanation of TradeScout rules, authority
                boundaries, and why contact is gated through Scout and Direct Connect.
              </p>
              <Button
                size="sm"
                className="bg-ts-orange hover:bg-ts-orange-dark text-black"
                onClick={() => navigate("/help/how-tradescout-works#connection-without-compromise")}
              >
                Open: How TradeScout Works
              </Button>
            </CardContent>
          </Card>

          {/* Getting Work Done (Direct Connect) */}
          <Card className="bg-tsCard/60 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-lg md:text-xl">
                <Target className="w-5 h-5 text-ts-orange" />
                Getting Work Done (Direct Connect)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm md:text-base text-white/70">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
                  onClick={() => navigate("/help/how-tradescout-works#direct-connect-workflow")}
                >
                  Request to contact flow
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
                  onClick={() => navigate("/help/how-tradescout-works#messaging-rules")}
                >
                  Why messaging is gated
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
                  onClick={() => navigate("/help/how-tradescout-works#cancel-reopen")}
                >
                  Pause and restart safely
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Money & Records */}
          <Card className="bg-tsCard/60 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-lg md:text-xl">
                <DollarSign className="w-5 h-5 text-ts-orange" />
                Money &amp; Records
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm md:text-base text-white/70">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
                  onClick={() => navigate("/help/how-tradescout-works#finances-invoicing")}
                >
                  Records, invoices, and payouts
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Community & Sharing */}
          <Card className="bg-tsCard/60 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-lg md:text-xl">
                <Users className="w-5 h-5 text-ts-orange" />
                Community &amp; Sharing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm md:text-base text-white/70">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
                  onClick={() => navigate("/community-feed")}
                >
                  Community feed priorities
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
                  onClick={() => navigate("/help/how-tradescout-works#sharing-attribution")}
                >
                  Sharing, attribution, and trust
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scout (Your Control Center) */}
          <Card className="bg-tsCard/60 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-lg md:text-xl">
                <Badge className="bg-ts-orange text-black text-xs uppercase tracking-wide">
                  Scout
                </Badge>
                <span>Scout (Your Control Center)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm md:text-base text-white/70">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
                  onClick={() => navigate("/scout")}
                >
                  Start with Scout
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
                  onClick={() =>
                    navigate("/help/how-tradescout-works#connection-without-compromise")
                  }
                >
                  Scout authority boundaries
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange/10"
                  onClick={() => navigate("/help/how-tradescout-works#direct-connect-workflow")}
                >
                  Why Scout recommends actions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
