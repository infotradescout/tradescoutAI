import React from "react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ReconciliationRow {
  countyId: string;
  vaultBalance: string;
  ledgerInflow: string;
  ledgerOutflow: string;
  contributionCount: number;
  payoutCount: number;
  delta: number;
}

export default function AdminCommunityBuilderReconciliationPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user?.isAdmin) setLocation("/unauthorized");
  }, [user?.isAdmin, setLocation]);

  if (!user?.isAdmin) return null;
  const { data: recs = [], isLoading } = useQuery<ReconciliationRow[]>({
    queryKey: ["cbReconciliation"],
    queryFn: async () => {
      const res = await fetch("/api/admin/community-builder/reconciliation");
      if (!res.ok) throw new Error("Failed to load reconciliation");
      return res.json();
    },
  });

  const warnings = recs.filter((r) => Math.abs(r.delta) > 1);

  return (
    <div className="bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vault Reconciliation</h1>
            <p className="text-gray-600">Ledger vs vault balance by area.</p>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Wallet className="w-4 h-4" /> {recs.length} areas
          </Badge>
        </div>

        {warnings.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Reconciliation warnings</AlertTitle>
            <AlertDescription>{warnings.length} area(s) need attention.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Balances</CardTitle>
            <CardDescription>Delta = vaultBalance - (inflow - outflow)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-500">Loading...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Area</TableHead>
                      <TableHead className="text-right">Vault</TableHead>
                      <TableHead className="text-right">Inflow</TableHead>
                      <TableHead className="text-right">Outflow</TableHead>
                      <TableHead className="text-right">Contribs</TableHead>
                      <TableHead className="text-right">Payouts</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recs.map((r) => (
                      <TableRow key={r.countyId}>
                        <TableCell>{r.countyId}</TableCell>
                        <TableCell className="text-right">${r.vaultBalance}</TableCell>
                        <TableCell className="text-right">${r.ledgerInflow}</TableCell>
                        <TableCell className="text-right">${r.ledgerOutflow}</TableCell>
                        <TableCell className="text-right">{r.contributionCount}</TableCell>
                        <TableCell className="text-right">{r.payoutCount}</TableCell>
                        <TableCell className="text-right">
                          {Math.abs(r.delta) < 1 ? (
                            <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> OK
                            </Badge>
                          ) : (
                            <Badge variant="error">{r.delta.toFixed(2)}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
