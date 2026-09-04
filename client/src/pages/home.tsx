import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bolt, Calculator, ChevronRight, ClipboardList, Hammer, Leaf, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InteractiveCountyMap } from "@/components/InteractiveCountyMap";
import { sanitizeAreaLabel } from "@/lib/copyHelpers";
import { FirstUseGuidanceCard } from "@/components/guidance/FirstUseGuidanceCard";
import { FirstUsefulStepLauncher } from "@/components/guidance/FirstUsefulStepLauncher";
import {
  DIRECT_CONNECT_GUIDANCE_TEXT,
  HOMEID_GUIDANCE_TEXT,
  SCOUT_GUIDANCE_TEXT,
  TRADE_SCOUT_PRODUCT_EXPLANATION,
} from "@/lib/firstUseGuidance";
import { trackFirstUseGuidanceViewed } from "@/lib/firstUseAnalytics";

const SERVICE_SHORTCUTS = [
  {
    label: "Plumbing",
    icon: Wrench,
    href: "/direct-connect?source=home_action_surface&category=plumbing",
  },
  {
    label: "Electrical",
    icon: Bolt,
    href: "/direct-connect?source=home_action_surface&category=electrical",
  },
  {
    label: "Handyman",
    icon: Hammer,
    href: "/direct-connect?source=home_action_surface&category=handyman",
  },
  {
    label: "Roofing",
    icon: ChevronRight,
    href: "/direct-connect?source=home_action_surface&category=roofing",
  },
  {
    label: "Landscaping",
    icon: Leaf,
    href: "/direct-connect?source=home_action_surface&category=landscaping",
  },
] as const;

export default function HomeActionPage() {
  const { user } = useAuth();
  const firstUseUserState = user ? "authenticated" : "anonymous";

  useEffect(() => {
    trackFirstUseGuidanceViewed("home", firstUseUserState);
  }, [firstUseUserState]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const { data: vaultSnapshot, isLoading: vaultLoading } = useQuery({
    queryKey: ["/api/vaults/my-county"],
    queryFn: async () => {
      const res = await fetch("/api/vaults/my-county");
      if (res.status === 400) return null;
      if (!res.ok) throw new Error("Failed to load vault");
      return res.json();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const countyLabel = vaultSnapshot?.county
    ? `${sanitizeAreaLabel(vaultSnapshot.county.name)}, ${vaultSnapshot.county.stateCode}`
    : user?.county && user?.state
      ? `${sanitizeAreaLabel(user.county)}, ${user.state}`
      : "Your area";

  return (
    <ScrollArea
      className="h-full"
      headerHeight={80}
      pageHeight={window.innerHeight - 80}
      scrollToTop={false}
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-7">
        <section className="rounded-3xl border border-ts-orange/35 bg-[radial-gradient(circle_at_18%_12%,rgba(255,145,30,0.28),rgba(6,17,36,0.96)_58%)] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.45)] md:p-6">
          <h1 className="text-[2rem] font-semibold leading-[1.05] text-white md:text-[2.4rem]">
            What do you need done?
          </h1>
          <p className="mt-2 max-w-[34ch] text-base leading-6 text-white/78">
            Describe the job and send it to local pros who match the work.
          </p>

          <Card className="mt-5 rounded-2xl border-ts-orange/35 bg-[color:var(--surface-card)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <CardContent className="p-4">
              <p className="text-[0.95rem] font-medium text-ts-orange">Describe your job...</p>
              <p className="mt-2 text-base leading-7 text-white/62">
                Replace kitchen faucet, fix drywall, install backyard lighting...
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Badge className="rounded-xl border border-white/20 bg-[color:var(--surface-intermediate)] px-3 py-1.5 text-xs text-white/80">
                  Add timeline
                </Badge>
                <Badge className="rounded-xl border border-white/20 bg-[color:var(--surface-intermediate)] px-3 py-1.5 text-xs text-white/80">
                  Set budget
                </Badge>
                <Button
                  asChild
                  className="ml-auto rounded-xl bg-ts-orange px-5 text-base font-semibold text-text-black hover:bg-ts-orange-dark"
                >
                  <Link href="/direct-connect?source=home_action_surface">Describe the job</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Popular services</h2>
              <Link href="/direct-connect/pros" className="text-sm font-medium text-ts-orange">
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
              {SERVICE_SHORTCUTS.map((service) => {
                const Icon = service.icon;
                return (
                  <Link
                    key={service.label}
                    href={service.href}
                    className="rounded-2xl border border-ts-orange/30 bg-[color:var(--surface-card)] p-3.5 transition-colors hover:border-ts-orange/55"
                  >
                    <Icon className="h-4 w-4 text-ts-orange" />
                    <p className="mt-2 text-sm font-medium text-white">{service.label}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-ts-orange/35 bg-[color:var(--surface-card)] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.35)] md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Start a Direct Connect request</h2>
              <p className="mt-1.5 max-w-[42ch] text-sm leading-6 text-white/75">
                Send your job details to local pros who match this work.
              </p>
              <p className="mt-2 text-xs text-white/70">
                Your contact details stay private until you choose the next step.
              </p>
            </div>
            <Button
              asChild
              className="h-12 rounded-xl bg-ts-orange px-6 text-base font-semibold text-black hover:bg-ts-orange/90"
            >
              <Link href="/direct-connect?source=home_direct_connect_cta">Start request</Link>
            </Button>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
            <CardContent className="p-3.5 md:p-5">
              <p className="text-sm text-white/78">{TRADE_SCOUT_PRODUCT_EXPLANATION}</p>
            </CardContent>
          </Card>
          <FirstUsefulStepLauncher surface="home" userState={firstUseUserState} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FirstUseGuidanceCard
              title="Scout is your discovery page."
              description={SCOUT_GUIDANCE_TEXT}
            />
            <FirstUseGuidanceCard
              title="HomeID keeps your home history organized."
              description={HOMEID_GUIDANCE_TEXT}
            />
            <FirstUseGuidanceCard
              title="Direct Connect prepares your request."
              description={DIRECT_CONNECT_GUIDANCE_TEXT}
            />
          </div>
        </div>

        <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="bg-gradient-to-r from-slate-800 to-navy-700 border-white/10 card-enhanced">
            <CardContent className="p-4 md:p-6">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-sm text-white/60">Community Vault</p>
                  <h2 className="text-xl font-semibold text-white">{countyLabel}</h2>
                </div>
                <Badge className="bg-ts-orange text-white">Local Impact</Badge>
              </div>
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end md:gap-4">
                <div>
                  <p className="text-2xl font-bold text-white md:text-3xl">
                    {vaultLoading
                      ? "Loading..."
                      : formatCurrency(vaultSnapshot?.vault?.currentBalance ?? 0)}
                  </p>
                  <p className="text-sm text-white/60">Local reinvestment balance</p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/20 text-white hover:border-ts-orange/40"
                >
                  <Link href="/foundation">Open Community Builders</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard border-white/10 card-enhanced">
            <CardContent className="flex h-full flex-col justify-between p-4 md:p-6">
              <div>
                <p className="mb-1 text-sm text-white/70">Transparency</p>
                <h2 className="mb-2 text-xl font-semibold text-white">See where dollars go</h2>
                <p className="text-sm text-white/60">
                  Track TradeScout contributions flowing back into your county across Exchange fees,
                  contractor programs, and Community Builders donations.
                </p>
              </div>
              <div className="pt-4">
                <Button asChild className="bg-ts-orange hover:bg-ts-orange-dark">
                  <Link href="/community-builder/dashboard">Open transparency dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="mt-8 md:mt-10">
          <InteractiveCountyMap variant="homeowner" showTitle={true} className="max-w-full" />
        </div>
      </div>
    </ScrollArea>
  );
}
