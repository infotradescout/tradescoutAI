import React from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowUpRight, Wallet } from 'lucide-react';

interface VaultResponse {
  id: string;
  countyId: string;
  currentBalance: string;
  lifetimeInflow: string;
  lifetimeOutflow: string;
  lastContributionAt?: string;
}

export default function CountyTransparencyPage() {
  const [, params] = useRoute('/county/:countyId/transparency');
  const countyId = params?.countyId || '';

  const { data: vault } = useQuery<VaultResponse | null>({
    queryKey: ['countyVault', countyId],
    enabled: Boolean(countyId),
    queryFn: async () => {
      const res = await fetch(`/api/community-builder/county/${countyId}/vault`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch vault');
      return res.json();
    },
  });

  const { data: contributions = [] } = useQuery({
    queryKey: ['countyContributions', countyId],
    enabled: Boolean(countyId),
    queryFn: async () => {
      const res = await fetch(`/api/community-builder/county/${countyId}/contributions`);
      if (!res.ok) throw new Error('Failed to fetch contributions');
      return res.json();
    },
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['countyLedger', countyId],
    enabled: Boolean(countyId),
    queryFn: async () => {
      const res = await fetch(`/api/community-builder/county/${countyId}/ledger`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">County Transparency</h1>
            <p className="text-gray-600">Live view of vault inflows and contributions.</p>
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
              <p className="text-3xl font-bold">${vault?.currentBalance ?? '0.00'}</p>
              <p className="text-sm text-gray-500 mt-1">Lifetime inflow: ${vault?.lifetimeInflow ?? '0.00'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Contributions</CardTitle>
              <CardDescription>Verified in this county</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{contributions.length}</p>
              <p className="text-sm text-gray-500 mt-1">Recent inflow events: {ledger.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Momentum</CardTitle>
              <CardDescription>30-day inflow progress (proxy)</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={Math.min(100, (ledger.length / 10) * 100)} />
              <p className="text-sm text-gray-500 mt-2">Events last 30 days: {ledger.length}</p>
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
              <p className="text-gray-500">No ledger entries yet.</p>
            ) : (
              <div className="space-y-3">
                {ledger.slice(0, 8).map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-semibold">${entry.amount}</p>
                      <p className="text-sm text-gray-600">{entry.memo || entry.sourceType}</p>
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
              <p className="text-gray-500">No contributions yet.</p>
            ) : (
              <div className="space-y-3">
                {contributions.slice(0, 6).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-semibold">{c.title}</p>
                      <p className="text-sm text-gray-600">${c.actualValue || c.estimatedValue}</p>
                    </div>
                    <Badge variant="outline">{c.status}</Badge>
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
