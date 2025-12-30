import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { RegisterForm } from "@/components/RegisterForm";

export default function CreateAccountPortal() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // If the user is already signed in, send them into onboarding or back home.
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const anyUser: any = user;
    const profileVersion: number = typeof anyUser.profileVersion === "number" ? anyUser.profileVersion : 0;

    if (profileVersion <= 0) {
      navigate("/onboarding/profile");
      return;
    }

    // Already normalized – just send them back to Scout.
    navigate("/");
  }, [user, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-tsBg via-slate-950 to-tsBg flex items-center justify-center px-4 py-10 text-tsTextMain">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr_minmax(0,1fr)] gap-8">
        <div className="space-y-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/community-feed")}
            className="flex items-center gap-2 text-tsTextMuted hover:text-white hover:bg-white/5 pl-0"
          >
            <span className="text-sm">Skip and browse as guest</span>
          </Button>

          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-tsBorder/60 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.18em] text-tsAccentSoft">
              ACCOUNT SETUP
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
              Create your TradeScout account.
            </h1>
            <p className="text-sm md:text-base text-tsTextMuted max-w-xl">
              Start with the basics - just your email and password. After this step, Scout will walk you through a quick profile check so things look right in your neighborhood.
            </p>

            <div className="rounded-2xl border border-tsBorder bg-black/30 p-4 text-xs text-tsTextMuted">
              <p className="mb-2 font-semibold text-tsTextMain">What this unlocks</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Join conversations and activity feeds for where you live.</li>
                <li>Show up correctly in local directories and profiles.</li>
                <li>Use messaging, recommendations, and higher-trust features.</li>
              </ul>
            </div>
          </div>
        </div>

        <Card className="bg-tsCard border border-tsBorder shadow-2xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TradeScoutLogo size="xs" />
                <span className="text-xs uppercase tracking-[0.2em] text-tsTextMuted">TRADESCOUT</span>
              </div>
            </div>
            <CardTitle className="text-lg font-semibold text-tsTextMain">
              Create your TradeScout account
            </CardTitle>
          </CardHeader>

          <CardContent>
            <RegisterForm
              onSuccess={() => {
                // After successful registration, send the user directly into
                // the profile basics flow to normalize their account.
                navigate("/onboarding/profile");
              }}
              onSwitchToLogin={() => navigate("/login?redirect=/create-account")} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
