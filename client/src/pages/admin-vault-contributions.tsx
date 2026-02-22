import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type VaultAdjustmentRow = {
  id: string;
  userId: string;
  countyId: string | null;
  directAmount: string;
  networkAmount: string;
  note: string | null;
  source: string;
  createdBy: string | null;
  createdAt: string;
};

export default function AdminVaultContributionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetUserId, setTargetUserId] = useState("");
  const [countyId, setCountyId] = useState("");
  const [directAmount, setDirectAmount] = useState("");
  const [networkAmount, setNetworkAmount] = useState("");
  const [source, setSource] = useState("manual_adjustment");
  const [note, setNote] = useState("");
  const [applyToCountyVault, setApplyToCountyVault] = useState(true);

  const normalizedUserId = useMemo(() => targetUserId.trim(), [targetUserId]);

  const { data: adjustments = [], isLoading } = useQuery<VaultAdjustmentRow[]>({
    queryKey: ["admin-vault-adjustments", normalizedUserId],
    enabled: normalizedUserId.length > 0,
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/community-builder/users/${encodeURIComponent(
          normalizedUserId
        )}/vault-contribution-adjustments`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load adjustments");
      return res.json();
    },
  });

  const createAdjustment = useMutation({
    mutationFn: async () => {
      if (!normalizedUserId) throw new Error("Enter a user ID");
      const res = await fetch(
        `/api/admin/community-builder/users/${encodeURIComponent(
          normalizedUserId
        )}/vault-contribution-adjustments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            countyId: countyId.trim() || undefined,
            directAmount: Number(directAmount || 0),
            networkAmount: Number(networkAmount || 0),
            note: note.trim() || undefined,
            source: source.trim() || undefined,
            applyToCountyVault,
          }),
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Failed to save adjustment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Vault contribution adjustment recorded." });
      setDirectAmount("");
      setNetworkAmount("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["admin-vault-adjustments", normalizedUserId] });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error?.message || "Unable to save adjustment",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>County Vault Contribution Overrides</CardTitle>
          <CardDescription>
            Admin-only direct/network adjustments for off-platform cash or manually verified
            contributions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="target-user-id">Target user ID</Label>
              <Input
                id="target-user-id"
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                placeholder="user_..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="county-id">County ID (optional)</Label>
              <Input
                id="county-id"
                value={countyId}
                onChange={(event) => setCountyId(event.target.value)}
                placeholder="county_..."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="direct-amount">Direct contribution ($)</Label>
              <Input
                id="direct-amount"
                type="number"
                step="0.01"
                value={directAmount}
                onChange={(event) => setDirectAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="network-amount">Network contribution ($)</Label>
              <Input
                id="network-amount"
                type="number"
                step="0.01"
                value={networkAmount}
                onChange={(event) => setNetworkAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="manual_adjustment"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Why this override is being applied"
              rows={3}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={applyToCountyVault}
              onChange={(event) => setApplyToCountyVault(event.target.checked)}
            />
            Also write this amount into county vault ledger
          </label>

          <div className="flex justify-end">
            <Button
              onClick={() => createAdjustment.mutate()}
              disabled={createAdjustment.isPending || normalizedUserId.length === 0}
            >
              Save override
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent overrides</CardTitle>
          <CardDescription>
            {normalizedUserId
              ? `Adjustment history for ${normalizedUserId}`
              : "Enter a target user ID to load history."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!normalizedUserId ? (
            <p className="text-sm text-slate-400">No user selected.</p>
          ) : isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : adjustments.length === 0 ? (
            <p className="text-sm text-slate-400">No adjustments yet.</p>
          ) : (
            <div className="space-y-2">
              {adjustments.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded border border-slate-800 px-3 py-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Direct ${Number(row.directAmount || 0).toFixed(2)}
                      </Badge>
                      <Badge variant="outline">
                        Network ${Number(row.networkAmount || 0).toFixed(2)}
                      </Badge>
                      <Badge variant="secondary">{row.source}</Badge>
                    </div>
                    <p className="text-xs text-slate-400">{row.note || "No note"}</p>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>{new Date(row.createdAt).toLocaleString()}</div>
                    <div>{row.countyId || "No county"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
