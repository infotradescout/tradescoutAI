import React, { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type VaultData = {
  profile: { id: string; slug: string; displayName: string; roleContext: string } | null;
  vault: {
    id: string;
    profileId: string;
    currentBalance: number;
    lifetimeInflow: number;
    lifetimeOutflow: number;
    lastContributionAt?: string | null;
  } | null;
  ledger: Array<{
    id: string;
    vaultId: string;
    externalKey?: string | null;
    sourceType: string;
    sourceId?: string | null;
    amount: number;
    memo?: string | null;
    causeId?: string | null;
    createdAt: string;
  }>;
};

type Cause = {
  id: string;
  profileId: string;
  title: string;
  description?: string | null;
  status: string;
  createdAt: string;
  voteCount: number;
  weightedVoteTotal: number;
  allocationShare: number;
};

type PlatformSupportLedgerEntry = {
  id: string;
  allocation: "platform" | "community";
  mode: "one_time" | "subscription";
  amount: number;
  currency: string;
  originatingProfileId?: string | null;
  memo?: string | null;
  createdAt: string;
};

function formatMoney(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export default function ProfileCommunityPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/profile/:profileId/community");
  const profileId = params?.profileId || "";

  const moneyFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }),
    []
  );

  const { data: vaultData, refetch: refetchVault } = useQuery<VaultData>({
    queryKey: ["communityVault", profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      const res = await fetch(`/api/community-vault/profile/${profileId}/ledger?limit=50`);
      if (res.status === 404) {
        return { profile: null, vault: null, ledger: [] };
      }
      if (!res.ok) throw new Error("Failed to fetch community vault");
      return res.json();
    },
  });

  const { data: causes = [], refetch: refetchCauses } = useQuery<Cause[]>({
    queryKey: ["communityCauses", profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      const res = await fetch(`/api/community-causes/profile/${profileId}`);
      if (!res.ok) throw new Error("Failed to fetch causes");
      return res.json();
    },
  });

  const { data: supportLedger = [], refetch: refetchSupportLedger } = useQuery<
    PlatformSupportLedgerEntry[]
  >({
    queryKey: ["platformSupportLedger", profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      const res = await fetch(
        `/api/platform-support/ledger?originatingProfileId=${encodeURIComponent(profileId)}&limit=50`
      );
      if (!res.ok) throw new Error("Failed to fetch platform support ledger");
      return res.json();
    },
  });

  const [donationAmount, setDonationAmount] = useState("25");
  const [supportAmount, setSupportAmount] = useState("10");

  const donateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/community-vault/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          amount: donationAmount,
          successUrl: `${window.location.origin}/profile/${profileId}/community?checkout=success`,
          cancelUrl: `${window.location.origin}/profile/${profileId}/community?checkout=cancel`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to create donation checkout");
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({
        title: "Donation failed",
        description: err?.message || "Unable to start donation checkout.",
        variant: "destructive",
      });
    },
  });

  const supportMutation = useMutation({
    mutationFn: async (mode: "one_time" | "subscription") => {
      const res = await fetch("/api/platform-support/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: supportAmount,
          mode,
          originatingProfileId: profileId,
          successUrl: `${window.location.origin}/profile/${profileId}/community?checkout=success`,
          cancelUrl: `${window.location.origin}/profile/${profileId}/community?checkout=cancel`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to create platform support checkout");
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({
        title: "Platform support failed",
        description: err?.message || "Unable to start checkout.",
        variant: "destructive",
      });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (causeId: string) => {
      const res = await fetch(`/api/community-causes/${causeId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Failed to vote");
      }
      return res.json();
    },
    onSuccess: async (result: any) => {
      await refetchCauses();
      toast({
        title: "Vote recorded",
        description: `Vote weight ${Number(result?.voteWeight || 1).toFixed(2)} • Current share ${Number(
          result?.allocationShare || 0
        ).toFixed(2)}%`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Vote failed",
        description: err?.message || "Unable to record vote.",
        variant: "destructive",
      });
    },
  });

  const refreshAll = async () => {
    await Promise.all([refetchVault(), refetchCauses(), refetchSupportLedger()]);
  };

  const communityEvaluation = useMemo(() => {
    const vault = vaultData?.vault;
    const balance = Number(vault?.currentBalance || 0);
    const inflow = Number(vault?.lifetimeInflow || 0);
    const outflow = Number(vault?.lifetimeOutflow || 0);

    const netRetention = inflow > 0 ? clamp(((inflow - outflow) / inflow) * 100) : 0;
    const fundingDepth = clamp((inflow / 10000) * 100);
    const participation = clamp((causes.length / 10) * 100);
    const supportSignal = clamp((supportLedger.length / 20) * 100);

    const totalScore = clamp(
      Math.round(
        fundingDepth * 0.35 + netRetention * 0.25 + participation * 0.2 + supportSignal * 0.2
      )
    );

    return {
      totalScore,
      fundingDepth,
      netRetention,
      participation,
      supportSignal,
      balance,
    };
  }, [vaultData?.vault, causes.length, supportLedger.length]);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-white py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Community Vault (Beta)</h1>
            <p className="text-white/60">
              Real money in, fully transparent ledger out. No withdrawals/payouts during beta.
            </p>
            {vaultData?.profile && (
              <p className="text-sm text-white/60">
                Community: <span className="font-semibold">{vaultData.profile.displayName}</span> (
                {vaultData.profile.slug})
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshAll}>
              Refresh
            </Button>
          </div>
        </div>

        {!vaultData?.profile ? (
          <Card>
            <CardHeader>
              <CardTitle>Profile not found</CardTitle>
              <CardDescription>Check the URL and try again.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Vault Balance</CardTitle>
                  <CardDescription>Current balance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatMoney(vaultData.vault?.currentBalance ?? 0)}
                  </div>
                  <div className="text-sm text-white/60 mt-2">
                    Lifetime inflow: {formatMoney(vaultData.vault?.lifetimeInflow ?? 0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ledger Events</CardTitle>
                  <CardDescription>Latest inflows</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{vaultData.ledger?.length ?? 0}</div>
                  <div className="text-sm text-white/60 mt-2">
                    Lifetime outflow: {formatMoney(vaultData.vault?.lifetimeOutflow ?? 0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Platform Support</CardTitle>
                  <CardDescription>Split-eligible from this community</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{supportLedger.length}</div>
                  <div className="text-sm text-white/60 mt-2">
                    Two rows per split payment (platform + community)
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Community Health Snapshot</CardTitle>
                <CardDescription>
                  Evaluation based on funding depth, retention, participation, and support signals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-white/60">Current score</p>
                    <p className="text-3xl font-bold">{communityEvaluation.totalScore}/100</p>
                  </div>
                  <p className="text-sm text-white/60">
                    Current balance: {formatMoney(communityEvaluation.balance)}
                  </p>
                </div>

                {[
                  { label: "Funding depth", value: communityEvaluation.fundingDepth },
                  { label: "Net retention", value: communityEvaluation.netRetention },
                  { label: "Cause participation", value: communityEvaluation.participation },
                  { label: "Support signal", value: communityEvaluation.supportSignal },
                ].map((metric) => (
                  <div key={metric.label} className="space-y-1">
                    <div className="flex justify-between text-xs text-white/60">
                      <span>{metric.label}</span>
                      <span>{Math.round(metric.value)}%</span>
                    </div>
                    <div className="h-2 rounded bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${Math.round(metric.value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Donate to Vault</CardTitle>
                  <CardDescription>Direct donation into this community vault.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                      placeholder="25"
                    />
                    <Button
                      onClick={() => donateMutation.mutate()}
                      disabled={donateMutation.isPending}
                    >
                      Donate
                    </Button>
                  </div>
                  <p className="text-xs text-white/60">You’ll be redirected to Stripe Checkout.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Support the Platform</CardTitle>
                  <CardDescription>
                    Initiated from community context: 50/50 split to this community vault.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={supportAmount}
                      onChange={(e) => setSupportAmount(e.target.value)}
                      placeholder="10"
                    />
                    <Badge variant="secondary">USD</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => supportMutation.mutate("one_time")}
                      disabled={supportMutation.isPending}
                    >
                      One-time
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => supportMutation.mutate("subscription")}
                      disabled={supportMutation.isPending}
                    >
                      Monthly
                    </Button>
                  </div>
                  <p className="text-xs text-white/60">
                    Monthly support is recorded on Stripe invoice payment.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Causes (Weighted Representation)</CardTitle>
                <CardDescription>
                  Platform-curated causes with proportional representation by weighted community
                  vote.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-white/60">
                  Representation shares are normalized to 100.00% after rounding for transparent
                  allocation.
                </p>
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Active causes</div>
                  {causes.length === 0 ? (
                    <p className="text-sm text-white/60">No causes available.</p>
                  ) : (
                    <div className="space-y-2">
                      {causes.slice(0, 10).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-start justify-between gap-3 p-3 border rounded-lg"
                        >
                          <div className="space-y-1">
                            <div className="font-semibold">{c.title}</div>
                            {c.description && (
                              <div className="text-sm text-white/60">{c.description}</div>
                            )}
                            <div className="text-xs text-white/60">
                              Votes: {c.voteCount} • Weighted total:{" "}
                              {Number(c.weightedVoteTotal || 0).toFixed(2)}
                            </div>
                            <div className="text-xs text-white/60">
                              Representation share: {Number(c.allocationShare || 0).toFixed(2)}% •
                              Status: {c.status}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => voteMutation.mutate(c.id)}
                            disabled={voteMutation.isPending}
                          >
                            Vote
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Community Vault Ledger</CardTitle>
                  <CardDescription>Immutable event stream</CardDescription>
                </CardHeader>
                <CardContent>
                  {vaultData.ledger.length === 0 ? (
                    <p className="text-sm text-white/60">No ledger entries yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {vaultData.ledger.slice(0, 12).map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between gap-3 p-3 border rounded-lg"
                        >
                          <div>
                            <div className="font-semibold">{moneyFormatter.format(e.amount)}</div>
                            <div className="text-xs text-white/60">{e.memo || e.sourceType}</div>
                          </div>
                          <Badge variant="outline">{e.sourceType}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Platform Support Ledger</CardTitle>
                  <CardDescription>Transparent split rows</CardDescription>
                </CardHeader>
                <CardContent>
                  {supportLedger.length === 0 ? (
                    <p className="text-sm text-white/60">No platform support entries yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {supportLedger.slice(0, 12).map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between gap-3 p-3 border rounded-lg"
                        >
                          <div>
                            <div className="font-semibold">
                              {moneyFormatter.format(e.amount)}
                              <span className="text-xs text-white/60"> • {e.mode}</span>
                            </div>
                            <div className="text-xs text-white/60">
                              {e.memo || "Platform Support"}
                            </div>
                          </div>
                          <Badge variant={e.allocation === "community" ? "secondary" : "outline"}>
                            {e.allocation}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
