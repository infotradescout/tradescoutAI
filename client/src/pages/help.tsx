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
          description="Browse help overviews for how TradeScout actually works. If you still don't see the answer, you can ask Scout from here for step-by-step help."
          canonical="https://www.thetradescout.com/help"
          structuredData={createFAQStructuredData([
            {
              question: "What is TradeScout?",
              answer:
                "TradeScout is a local participation platform that connects people, services, and tools through verified community activity.",
            },
            {
              question: "What is Scout on TradeScout?",
              answer:
                "Scout is TradeScout's built-in helper that runs the site day-to-day. It helps people understand what they can do next, find or offer services, use tools step-by-step, and see what's happening locally.",
            },
            {
              question: "Who is TradeScout for?",
              answer:
                "TradeScout is for anyone who participates locally—people getting projects done, offering services, managing properties or groups, buying and selling locally, or organizing communities.",
            },
            {
              question: "Do I need to be a contractor or homeowner to use TradeScout?",
              answer:
                "No. TradeScout supports many ways of participating locally, including services, property management, community activity, buying and selling, and general tools.",
            },
          ])}
        />

        <div className="mb-8 md:mb-10">
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-orange-400" />
            TradeScout Help Home
          </h1>
          <p className="text-sm md:text-base text-slate-200 max-w-2xl">
            TradeScout is built around Connection Without Compromise. Start here to understand how
            jobs, messaging, money, community, and Scout work together.
          </p>
        </div>

        <div className="space-y-6">
          {/* Start Here */}
          <Card className="bg-navy-800/60 border-navy-600">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-lg md:text-xl">
                <BookOpen className="w-5 h-5 text-orange-400" />
                Start Here: How TradeScout Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
              <p>
                TradeScout is built around Connection Without Compromise. Start here to understand
                how jobs, messaging, and money work together.
              </p>
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-slate-950"
                onClick={() => navigate("/help/how-tradescout-works#connection-without-compromise")}
              >
                Open: How TradeScout Works
              </Button>
            </CardContent>
          </Card>

          {/* Getting Work Done (Direct Connect) */}
          <Card className="bg-navy-800/60 border-navy-600">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-lg md:text-xl">
                <Target className="w-5 h-5 text-orange-400" />
                Getting Work Done (Direct Connect)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500/70 text-orange-300 hover:bg-orange-500/10"
                  onClick={() => navigate("/help/how-tradescout-works#direct-connect-workflow")}
                >
                  How jobs work
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500/70 text-orange-300 hover:bg-orange-500/10"
                  onClick={() => navigate("/help/how-tradescout-works#messaging-rules")}
                >
                  Why messaging is locked
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500/70 text-orange-300 hover:bg-orange-500/10"
                  onClick={() => navigate("/help/how-tradescout-works#cancel-reopen")}
                >
                  Cancel &amp; reopen
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Money & Records */}
          <Card className="bg-navy-800/60 border-navy-600">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-lg md:text-xl">
                <DollarSign className="w-5 h-5 text-orange-400" />
                Money &amp; Records
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500/70 text-orange-300 hover:bg-orange-500/10"
                  onClick={() => navigate("/help/how-tradescout-works#finances-invoicing")}
                >
                  Invoicing &amp; payments
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Community & Sharing */}
          <Card className="bg-navy-800/60 border-navy-600">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-lg md:text-xl">
                <Users className="w-5 h-5 text-orange-400" />
                Community &amp; Sharing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500/70 text-orange-300 hover:bg-orange-500/10"
                  onClick={() => navigate("/community-feed")}
                >
                  Community feed basics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500/70 text-orange-300 hover:bg-orange-500/10"
                  onClick={() => navigate("/help/how-tradescout-works#sharing-attribution")}
                >
                  Sharing &amp; attribution
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scout (Your Control Center) */}
          <Card className="bg-navy-800/60 border-navy-600">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white text-lg md:text-xl">
                <Badge className="bg-orange-500 text-slate-950 text-xs uppercase tracking-wide">
                  Scout
                </Badge>
                <span>Scout (Your Control Center)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500/70 text-orange-300 hover:bg-orange-500/10"
                  onClick={() => navigate("/scout")}
                >
                  How Scout works
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500/70 text-orange-300 hover:bg-orange-500/10"
                  onClick={() =>
                    navigate("/help/how-tradescout-works#connection-without-compromise")
                  }
                >
                  What Scout can and can&apos;t do
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500/70 text-orange-300 hover:bg-orange-500/10"
                  onClick={() => navigate("/help/how-tradescout-works#direct-connect-workflow")}
                >
                  Why Scout suggests certain actions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
