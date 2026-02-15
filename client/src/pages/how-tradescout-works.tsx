import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SEOHelmet } from "@/components/SEOHelmet";

export default function HowTradeScoutWorks() {
  return (
    <AppShell>
      <div className=" text-white">
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-10">
          <SEOHelmet
            title="How TradeScout Works – Connection Without Compromise | TradeScout"
            description="Learn how jobs, messaging, money, and community fit together in TradeScout. Trust-first matching, verified contractors, and direct connections."
            canonical="https://www.thetradescout.com/how-tradescout-works"
          />

          <header className="mb-8 md:mb-10">
            <h1 className="text-3xl md:text-4xl font-semibold mb-3">How TradeScout Works</h1>
            <p className="text-sm md:text-base text-slate-300 max-w-2xl">
              Core platform rules at a glance.
            </p>
          </header>

          <div className="space-y-8 md:space-y-10">
            <Card id="connection-without-compromise">
              <CardHeader>
                <CardTitle>Connection Without Compromise</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>Discovery is broad. Active job communication is locked to involved parties.</p>
              </CardContent>
            </Card>

            <Card id="direct-connect-workflow">
              <CardHeader>
                <CardTitle>Direct Connect Workflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>Requests move from created to routed to accepted in a single job flow.</p>
              </CardContent>
            </Card>

            <Card id="finances-invoicing">
              <CardHeader>
                <CardTitle>Finances &amp; Invoicing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>Invoices and payments are managed in Finances.</p>
              </CardContent>
            </Card>

            <Card id="messaging-rules">
              <CardHeader>
                <CardTitle>Messaging Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>Message permissions follow job and request status.</p>
              </CardContent>
            </Card>

            <Card id="cancel-reopen">
              <CardHeader>
                <CardTitle>Cancel &amp; Reopen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>Cancel stops the current flow. Reopen restarts routing.</p>
              </CardContent>
            </Card>

            <Card id="sharing-attribution">
              <CardHeader>
                <CardTitle>Sharing &amp; Attribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>Sharing and attribution are tracked with privacy controls.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
