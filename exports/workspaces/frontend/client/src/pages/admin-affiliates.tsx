import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface AdminAffiliateAccount {
  id: string;
  affiliateId: string;
  email?: string;
  name?: string;
  status?: string;
  lifetimeEarned: string;
  available: string;
  pending: string;
  referralCode?: string;
   commissionRate?: string;
  createdAt: string;
}

export default function AdminAffiliatesPage() {
  const { data, refetch } = useQuery<AdminAffiliateAccount[]>({
    queryKey: ["/api/admin/affiliates"],
  });

  const commissionMutation = useMutation({
    mutationFn: (payload: { id: string; commissionRate: number }) =>
      apiRequest("PUT", `/api/admin/affiliates/${payload.id}/commission-rate`, {
        commissionRate: payload.commissionRate,
      }),
    onSuccess: () => {
      refetch();
    },
  });

  const payoutMutation = useMutation({
    mutationFn: (payload: { id: string; amount: number; method?: string; note?: string }) =>
      apiRequest("POST", `/api/admin/affiliates/${payload.id}/payout`, {
        amount: payload.amount,
        method: payload.method,
        note: payload.note,
      }),
    onSuccess: () => {
      refetch();
    },
  });

  return (
    <div className="bg-tsBg text-white pt-24 px-4 pb-16">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Affiliate Management</h1>
          <p className="text-white/60 text-sm">Review affiliate accounts and create manual payouts.</p>
        </div>

        <Card className="bg-tsCard/95 border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Affiliate Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data || data.length === 0 ? (
              <p className="text-white/60 text-sm">No affiliates found.</p>
            ) : (
              data.map((a) => (
                <AffiliateRow
                  key={a.id}
                  account={a}
                  onPayout={payoutMutation.mutate}
                  onUpdateCommission={commissionMutation.mutate}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AffiliateRow({
  account,
  onPayout,
  onUpdateCommission,
}: {
  account: AdminAffiliateAccount;
  onPayout: (payload: { id: string; amount: number; method?: string; note?: string }) => void;
  onUpdateCommission: (payload: { id: string; commissionRate: number }) => void;
}) {
  let amount = 0;
  let method = "manual";
  let note = "";
  let commissionRatePercent = account.commissionRate ? Number(account.commissionRate) * 100 : 5;

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-lg bg-tsCard border border-white/10">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{account.name || account.email || account.affiliateId}</span>
          {account.status && <Badge className="bg-emerald-600/80 text-xs">{account.status}</Badge>}
        </div>
        <div className="text-xs text-white/60 space-x-3">
          <span>ID: {account.id.slice(0, 8)}</span>
          {account.referralCode && <span>Code: {account.referralCode}</span>}
          <span>Joined: {format(new Date(account.createdAt), "MMM d, yyyy")}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-white/70 mt-1 items-center">
          <span>Lifetime: ${account.lifetimeEarned}</span>
          <span>Paid: ${account.available}</span>
          <span>Pending: ${account.pending}</span>
          <span className="inline-flex items-center gap-1">
            <span className="text-white/60">Commission:</span>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              defaultValue={commissionRatePercent.toFixed(2)}
              className="w-20 h-7 text-xs bg-tsBg border-white/10"
              onChange={(e) => {
                const v = Number(e.target.value || 0);
                commissionRatePercent = v;
              }}
            />
            <span className="text-white/60">%</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          placeholder="Amount"
          className="w-24 h-8 text-xs bg-tsBg border-white/10"
          onChange={(e) => {
            amount = Number(e.target.value || 0);
          }}
        />
        <Input
          placeholder="Method (manual/stripe/etc)"
          className="w-32 h-8 text-xs bg-tsBg border-white/10"
          onChange={(e) => {
            method = e.target.value || "manual";
          }}
        />
        <Input
          placeholder="Note"
          className="w-40 h-8 text-xs bg-tsBg border-white/10"
          onChange={(e) => {
            note = e.target.value || "";
          }}
        />
        <Button
          size="sm"
          className="h-8 text-xs bg-ts-orange-dark hover:bg-ts-orange-dark"
          onClick={() => {
            if (!amount || amount <= 0) return;
            onPayout({ id: account.id, amount, method, note });
          }}
        >
          Create Payout
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs border-emerald-600 text-emerald-400 hover:bg-emerald-600/10"
          onClick={() => {
            const rateDecimal = commissionRatePercent / 100;
            if (!rateDecimal || rateDecimal <= 0 || rateDecimal >= 1) return;
            onUpdateCommission({ id: account.id, commissionRate: rateDecimal });
          }}
        >
          Save Rate
        </Button>
      </div>
    </div>
  );
}
