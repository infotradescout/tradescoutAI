import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SEOHelmet } from "@/components/SEOHelmet";

export default function HowTradeScoutWorks() {
  return (
    <AppShell>
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-10">
          <SEOHelmet
            title="How TradeScout Works"
            description="Connection Without Compromise: how jobs, messaging, money, and community fit together in TradeScout."
          />

          <header className="mb-8 md:mb-10">
            <h1 className="text-3xl md:text-4xl font-semibold mb-3">
              How TradeScout Works
            </h1>
            <p className="text-sm md:text-base text-slate-300 max-w-2xl">
              This guide explains the system behind TradeScout: why discovery is
              limited, how Direct Connect jobs move, how money is tracked, and
              how sharing and Scout fit into the same rules.
            </p>
          </header>

          <div className="space-y-8 md:space-y-10">
            <Card id="connection-without-compromise">
              <CardHeader>
                <CardTitle>Connection Without Compromise</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>
                  TradeScout is built around one doctrine: Connection Without
                  Compromise. The system is designed so that people can find
                  each other and get work done without spam, harassment, or
                  pressure.
                </p>
                <p>
                  The core rule is simple: discovery is limited, engagement is
                  exclusive. You might see many options while you are deciding
                  what to do, but once a job is underway the conversation is
                  locked to the people actually doing the work.
                </p>
              </CardContent>
            </Card>

            <Card id="direct-connect-workflow">
              <CardHeader>
                <CardTitle>Direct Connect Workflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>
                  Direct Connect is the job system that turns a request into a
                  single, focused conversation. Requests move through a clear
                  sequence: created, routed to a short list of providers, then
                  accepted into an in-progress job.
                </p>
                <p>
                  Once a provider accepts, the job is locked to that
                  conversation. Other providers can no longer message the
                  requester about that job. This protects everyone from
                  back-channel pressure and keeps the work focused.
                </p>
              </CardContent>
            </Card>

            <Card id="finances-invoicing">
              <CardHeader>
                <CardTitle>Finances &amp; Invoicing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>
                  Money and records live in the Finances workspace. Direct
                  Connect jobs hand off into invoices so that work, payments,
                  and history stay in one place.
                </p>
                <p>
                  Scout may nudge you to create an invoice or record a payment
                  once a job is in progress, but the Finances views remain the
                  source of truth for what was billed and what was paid.
                </p>
              </CardContent>
            </Card>

            <Card id="messaging-rules">
              <CardHeader>
                <CardTitle>Messaging Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>
                  Messaging is intentionally locked in TradeScout. You cannot
                  always start or continue a conversation just because you know
                  someone exists on the platform.
                </p>
                <p>
                  For Direct Connect jobs, messaging opens when a request is
                  routed and a provider is accepted. When a job is cancelled or
                  closed, messaging follows the job state so that people are not
                  surprised by late pings or new pressure.
                </p>
              </CardContent>
            </Card>

            <Card id="cancel-reopen">
              <CardHeader>
                <CardTitle>Cancel &amp; Reopen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>
                  Sometimes a job stalls or needs to be reset. TradeScout
                  handles this with explicit Cancel and Reopen actions instead
                  of hidden automation.
                </p>
                <p>
                  When a request is cancelled, the current job flow stops and
                  messaging closes. Reopening moves the request back to an open
                  state so it can be routed again under the same rules as
                  before.
                </p>
              </CardContent>
            </Card>

            <Card id="sharing-attribution">
              <CardHeader>
                <CardTitle>Sharing &amp; Attribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm md:text-base text-slate-200">
                <p>
                  Community sharing, feed posts, and affiliate links are all
                  governed by the same principle: give credit where it is due
                  without turning participation into noise.
                </p>
                <p>
                  When you share a contractor, post about a project, or earn an
                  affiliate reward, TradeScout keeps a record so that
                  attribution is clear but private details stay protected.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
