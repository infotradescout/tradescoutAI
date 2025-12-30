import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageLoadingSpinner } from "@/components/LoadingSpinner";
import { Megaphone, Layers, Star, Target, Heart, Shield, Settings } from "lucide-react";

type AdminHealthResponse = {
  ok: boolean;
  userId: string | null;
  role: string | null;
  isSuperAdmin: boolean;
};

type AdminSectionKey =
  | "promotions"
  | "tradeDeals"
  | "sponsors"
  | "placements"
  | "feedback"
  | "communityBuilders"
  | "system";

const sections: { key: AdminSectionKey; label: string; description: string; icon: React.ComponentType<any> }[] = [
  {
    key: "promotions",
    label: "Promotions",
    description: "Canonical promotions and TradeDeals controls",
    icon: Megaphone,
  },
  {
    key: "tradeDeals",
    label: "TradeDeals Directory",
    description: "Directory and governance for exclusive TradeDeals",
    icon: Layers,
  },
  {
    key: "sponsors",
    label: "Sponsors & Affiliates",
    description: "Sponsor lanes and affiliate programs",
    icon: Star,
  },
  {
    key: "placements",
    label: "Placements",
    description: "Where promotions can appear across the OS",
    icon: Target,
  },
  {
    key: "feedback",
    label: "Feedback & Quality",
    description: "Signals, suppression, and safety rules",
    icon: Shield,
  },
  {
    key: "communityBuilders",
    label: "Community Builders",
    description: "County-level vaults and philanthropy OS",
    icon: Heart,
  },
  {
    key: "system",
    label: "System",
    description: "Kill switches, experiments, and audit trails",
    icon: Settings,
  },
];

export default function AdminShell() {
  const [activeSection, setActiveSection] = useState<AdminSectionKey>("promotions");

  const { data, isLoading, error } = useQuery<AdminHealthResponse>({
    queryKey: ["/api/admin/health"],
  });

  if (isLoading) {
    return <PageLoadingSpinner message="Verifying super admin access..." />;
  }

  if (error || !data?.ok || !data.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center py-24">
        <Card className="max-w-md w-full border-red-500/40 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-red-300">Super admin access required</CardTitle>
            <CardDescription className="text-slate-300">
              This portal is restricted to head administrators and super admins. Your current
              session does not have access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-400">
              If you believe this is an error, check your assigned role or contact the
              platform owner.
            </p>
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>Requested: /admin</span>
              <span>Role: {(data as any)?.role || "unknown"}</span>
            </div>
            <div className="flex gap-2 justify-end">
              <Link href="/">
                <Button variant="outline" size="sm">
                  Return home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeMeta = sections.find((s) => s.key === activeSection) ?? sections[0];
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="min-h-screen bg-slate-950 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6">
        {/* Left nav */}
        <aside className="w-64 shrink-0">
          <Card className="bg-slate-900/80 border-slate-800 mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-200">
                Super Admin Portal
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Role: {data.role || "unknown"}
              </CardDescription>
            </CardHeader>
          </Card>

          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = section.key === activeSection;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left border
                    ${
                      isActive
                        ? "bg-orange-600/20 border-orange-500/60 text-orange-100"
                        : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 truncate">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 space-y-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-100">
                  <ActiveIcon className="w-5 h-5 text-orange-400" />
                  <span>{activeMeta.label}</span>
                  <Badge variant="outline" className="border-orange-500/60 text-orange-300 bg-orange-500/10">
                    Super admin
                  </Badge>
                </CardTitle>
                <CardDescription className="text-slate-300 mt-1">
                  {activeMeta.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeSection === "promotions" && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-300">
                    This is the canonical Promotions OS for TradeDeals, sponsors, and high-safety
                    placements. Use the Promotions manager to create TradeDeals that feed the
                    Community Snapshot and other placements.
                  </p>
                  <Separator className="bg-slate-800" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-slate-950/60 border-slate-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-100">Open Promotions manager</CardTitle>
                        <CardDescription className="text-xs text-slate-400">
                          Create, target, and activate promotions that drive local TradeDeals into
                          Community Snapshot.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 flex justify-end">
                        <Link href="/admin/promotions">
                          <Button size="sm" variant="outline">
                            Manage promotions
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-950/60 border-slate-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-100">Inspect TradeDeals surface</CardTitle>
                        <CardDescription className="text-xs text-slate-400">
                          Review how TradeDeals are currently presented to communities.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 flex justify-end">
                        <Link href="/trade-deals">
                          <Button size="sm" variant="outline">
                            View TradeDeals
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {activeSection === "tradeDeals" && (
                <div className="space-y-3 text-sm text-slate-300">
                  <p>
                    TradeDeals are exclusive, locality-aware offers surfaced only inside the
                    TradeScout OS. Use this area to audit how TradeDeals map to real projects,
                    communities, and counties.
                  </p>
                  <p>
                    Today, the canonical public view for TradeDeals is available on the
                    TradeDeals directory and in the Community Snapshot. Future iterations of this
                    admin surface will let you inspect source promotions, placements, and policy
                    rules for each deal.
                  </p>
                  <div className="flex gap-2">
                    <Link href="/community-feed">
                      <Button size="sm" variant="outline">
                        Open Community Snapshot
                      </Button>
                    </Link>
                    <Link href="/trade-deals">
                      <Button size="sm" variant="outline">
                        Open TradeDeals directory
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {activeSection === "sponsors" && (
                <p className="text-sm text-slate-300">
                  Sponsors and affiliates will be managed here, including lane allocation,
                  sponsor tiers, and how sponsorships translate into visible TradeDeals and
                  placements across the OS.
                </p>
              )}

              {activeSection === "placements" && (
                <p className="text-sm text-slate-300">
                  Placement rules will determine where a promotion can appear (Community Snapshot,
                  Scout tiles, Direct Connect, notifications, and more) with strict controls to
                  avoid outside ads and preserve trust.
                </p>
              )}

              {activeSection === "feedback" && (
                <p className="text-sm text-slate-300">
                  Feedback and quality controls will aggregate like/dislike signals, hide poor
                  performers, and enforce global suppression rules so the network stays healthy.
                </p>
              )}

              {activeSection === "communityBuilders" && (
                <div className="space-y-3 text-sm text-slate-300">
                  <p>
                    Community Builders is the county-level philanthropy OS. Use this section to
                    reason about how TradeDeals, platform fees, and donations roll up into county
                    vaults and impact reporting.
                  </p>
                  <Link href="/foundation">
                    <Button size="sm" variant="outline">
                      Open Community Builders
                    </Button>
                  </Link>
                </div>
              )}

              {activeSection === "system" && (
                <p className="text-sm text-slate-300">
                  System controls will centralize kill switches, experiment flags, and audit
                  traces for promotions, TradeDeals, and high-risk placements so you can recover
                  from issues quickly.
                </p>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
