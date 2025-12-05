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
  createdAt: string;
}

export default function AdminAffiliatesPage() {
  const { data, refetch } = useQuery<AdminAffiliateAccount[]>({
    queryKey: ["/api/admin/affiliates"],
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
    <div className="min-h-screen bg-slate-950 text-white pt-24 px-4 pb-16">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Affiliate Management</h1>
          <p className="text-slate-400 text-sm">Review affiliate accounts and create manual payouts.</p>
        </div>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">Affiliate Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data || data.length === 0 ? (
              <p className="text-slate-400 text-sm">No affiliates found.</p>
            ) : (
              data.map((a) => <AffiliateRow key={a.id} account={a} onPayout={payoutMutation.mutate} />)
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
}: {
  account: AdminAffiliateAccount;
  onPayout: (payload: { id: string; amount: number; method?: string; note?: string }) => void;
}) {
  let amount = 0;
  let method = "manual";
  let note = "";

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{account.name || account.email || account.affiliateId}</span>
          {account.status && <Badge className="bg-emerald-600/80 text-xs">{account.status}</Badge>}
        </div>
        <div className="text-xs text-slate-400 space-x-3">
          <span>ID: {account.id.slice(0, 8)}</span>
          {account.referralCode && <span>Code: {account.referralCode}</span>}
          <span>Joined: {format(new Date(account.createdAt), "MMM d, yyyy")}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-300 mt-1">
          <span>Lifetime: ${account.lifetimeEarned}</span>
          <span>Paid: ${account.available}</span>
          <span>Pending: ${account.pending}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          placeholder="Amount"
          className="w-24 h-8 text-xs bg-slate-950 border-slate-800"
          onChange={(e) => {
            amount = Number(e.target.value || 0);
          }}
        />
        <Input
          placeholder="Method (manual/stripe/etc)"
          className="w-32 h-8 text-xs bg-slate-950 border-slate-800"
          onChange={(e) => {
            method = e.target.value || "manual";
          }}
        />
        <Input
          placeholder="Note"
          className="w-40 h-8 text-xs bg-slate-950 border-slate-800"
          onChange={(e) => {
            note = e.target.value || "";
          }}
        />
        <Button
          size="sm"
          className="h-8 text-xs bg-orange-600 hover:bg-orange-700"
          onClick={() => {
            if (!amount || amount <= 0) return;
            onPayout({ id: account.id, amount, method, note });
          }}
        >
          Create Payout
        </Button>
      </div>
    </div>
  );
}
