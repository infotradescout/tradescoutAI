import React from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowUpRight, Wallet } from "lucide-react";

interface VaultResponse {
  id: string;
  countyId: string;
  currentBalance: string;
  lifetimeInflow: string;
  lifetimeOutflow: string;
  lastContributionAt?: string;
  allocation?: Array<{
    key: string;
    label: string;
    percent: number;
    amount: number;
  }>;
}

interface CountyContributor {
  userId: string;
  displayName: string;
  profileSlug?: string | null;
  businessSlug?: string | null;
  directTotal: number;
  networkTotal: number;
  totalAmount: number;
  lastContributionAt?: string | null;
}

export default function CountyTransparencyPage() {
  const [, params] = useRoute("/county/:countyId/transparency");
  const countyId = params?.countyId || "";

  const { data: vault } = useQuery<VaultResponse | null>({
    queryKey: ["countyVault", countyId],
    enabled: Boolean(countyId),
    queryFn: async () => {
      const res = await fetch(`/api/community-builder/county/${countyId}/vault`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch vault");
      return res.json();
    },
  });

  const { data: contributions = [] } = useQuery({
    queryKey: ["countyContributions", countyId],
    enabled: Boolean(countyId),
    queryFn: async () => {
      const res = await fetch(`/api/community-builder/county/${countyId}/contributions`);
      if (!res.ok) throw new Error("Failed to fetch contributions");
      return res.json();
    },
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["countyLedger", countyId],
    enabled: Boolean(countyId),
    queryFn: async () => {
      const res = await fetch(`/api/community-builder/county/${countyId}/ledger`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: contributors = [] } = useQuery<CountyContributor[]>({
    queryKey: ["countyContributors", countyId],
    enabled: Boolean(countyId),
    queryFn: async () => {
      const res = await fetch(`/api/community-builder/county/${countyId}/contributors`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="bg-gradient-to-br from-slate-50 to-white py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">County Transparency</h1>
            <p className="text-white/60">Live view of vault inflows and contributions.</p>
          </div>
          {vault && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Wallet className="w-4 h-4" /> ${vault.currentBalance}
            </Badge>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Vault Balance</CardTitle>
              <CardDescription>Current funds available</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">${vault?.currentBalance ?? "0.00"}</p>
              <p className="text-sm text-white/60 mt-1">
                Lifetime inflow: ${vault?.lifetimeInflow ?? "0.00"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Contributions</CardTitle>
              <CardDescription>Verified in this county</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{contributions.length}</p>
              <p className="text-sm text-white/60 mt-1">Recent inflow events: {ledger.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Momentum</CardTitle>
              <CardDescription>30-day inflow progress (proxy)</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={Math.min(100, (ledger.length / 10) * 100)} />
              <p className="text-sm text-white/60 mt-2">Events last 30 days: {ledger.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Ledger Entries</CardTitle>
            <CardDescription>Latest inflows and adjustments</CardDescription>
          </CardHeader>
          <CardContent>
            {ledger.length === 0 ? (
              <p className="text-white/60">No ledger entries yet.</p>
            ) : (
              <div className="space-y-3">
                {ledger.slice(0, 8).map((entry: any) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">${entry.amount}</p>
                      <p className="text-sm text-white/60">{entry.memo || entry.sourceType}</p>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <ArrowUpRight className="w-4 h-4" /> {entry.sourceType}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Contributions</CardTitle>
            <CardDescription>Verified builder contributions</CardDescription>
          </CardHeader>
          <CardContent>
            {contributions.length === 0 ? (
              <p className="text-white/60">No contributions yet.</p>
            ) : (
              <div className="space-y-3">
                {contributions.slice(0, 6).map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">{c.title}</p>
                      <p className="text-sm text-white/60">${c.actualValue || c.estimatedValue}</p>
                    </div>
                    <Badge variant="outline">{c.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>County Vault Contributors</CardTitle>
            <CardDescription>
              People and businesses tied to this county vault, including direct and network totals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contributors.length === 0 ? (
              <p className="text-white/60">No contributor records yet.</p>
            ) : (
              <div className="space-y-3">
                {contributors.slice(0, 20).map((contributor) => (
                  <div
                    key={contributor.userId}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold text-white truncate">{contributor.displayName}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                        {contributor.profileSlug && (
                          <a
                            href={`/u/${contributor.profileSlug}`}
                            className="underline-offset-2 hover:underline"
                          >
                            Profile
                          </a>
                        )}
                        {contributor.businessSlug && (
                          <a
                            href={`/business/${contributor.businessSlug}`}
                            className="underline-offset-2 hover:underline"
                          >
                            Business
                          </a>
                        )}
                        {contributor.lastContributionAt && (
                          <span>
                            Last: {new Date(contributor.lastContributionAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-semibold text-white">
                        ${Number(contributor.totalAmount || 0).toFixed(2)}
                      </p>
                      <div className="flex gap-2 justify-end">
                        <Badge variant="outline">
                          Direct ${Number(contributor.directTotal || 0).toFixed(2)}
                        </Badge>
                        <Badge variant="outline">
                          Network ${Number(contributor.networkTotal || 0).toFixed(2)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>County Vault Split</CardTitle>
            <CardDescription>Fixed 20% allocation across all five buckets.</CardDescription>
          </CardHeader>
          <CardContent>
            {!vault?.allocation?.length ? (
              <p className="text-white/60">No allocation data yet.</p>
            ) : (
              <div className="space-y-3">
                {vault.allocation.map((bucket) => (
                  <div
                    key={bucket.key}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">{bucket.label}</p>
                      <p className="text-xs text-white/60">{bucket.percent}% of county vault</p>
                    </div>
                    <Badge variant="outline">${bucket.amount.toFixed(2)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
