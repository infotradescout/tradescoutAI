import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Lock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

interface DecisionCardMetrics {
  available?: boolean;
  message?: string;
  totalShown: number;
  guidanceDistribution: {
    COMPLY: number;
    DEFER: number;
    BLOCK: number;
  };
  choiceSplit: {
    contact_now: number;
    ask_scout: number;
    proceed_anyway: number;
    cancel: number;
    understand_risk: number;
  };
  trend: {
    shown_7d_change: number;
    choice_7d_deltas: Record<string, number>;
  };
}

interface OverrideLegitimacy {
  scoutAction: "COMPLY" | "DEFER" | "BLOCK";
  overrides: number;
  regretAfterOverride: number;
  interpretation: string;
}

interface CancelSignals {
  cancelRate: number;
  byGuidance: {
    COMPLY: number;
    DEFER: number;
    BLOCK: number;
  };
}

interface ObservationLock {
  enabled: boolean;
  lastChangedBy?: string;
  lastChangedAt?: string;
}

interface UnlockCondition {
  phase: string;
  status: "LOCKED" | "UNLOCKED";
  condition: string;
  blockedReason?: string | null;
}

export function AuthorityOperations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("observation");

  // Observation Mode Lock
  const { data: observationLock } = useQuery<ObservationLock>({
    queryKey: ["/api/admin/authority/observation-lock"],
    retry: false,
  });

  const toggleObservationMutation = useMutation({
    mutationFn: async (enabled: boolean) =>
      apiRequest("POST", "/api/admin/authority/observation-lock", { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/authority/observation-lock"] });
      toast({
        title: "Observation Mode Updated",
        description: observationLock?.enabled
          ? "System unlocked - experimental surfaces now allowed"
          : "System locked - authority limited to actions only",
      });
    },
  });

  // Decision Card Metrics
  const {
    data: metrics,
    isError: metricsFailed,
    error: metricsError,
  } = useQuery<DecisionCardMetrics>({
    queryKey: ["/api/admin/authority/decision-card-metrics"],
    retry: false,
  });

  // Override Legitimacy Matrix
  const { data: legitimacy, isError: legitimacyFailed } = useQuery<OverrideLegitimacy[]>({
    queryKey: ["/api/admin/authority/override-legitimacy"],
    retry: false,
  });

  // Cancel Signals
  const { data: cancelSignals, isError: cancelSignalsFailed } = useQuery<CancelSignals>({
    queryKey: ["/api/admin/authority/cancel-signals"],
    retry: false,
  });

  // Unlock Ledger
  const { data: unlockLedger, isError: unlockLedgerFailed } = useQuery<UnlockCondition[]>({
    queryKey: ["/api/admin/authority/unlock-ledger"],
    retry: false,
  });

  const [unlockNotes, setUnlockNotes] = useState<Record<string, string>>({});

  const updateUnlockConditionMutation = useMutation({
    mutationFn: async ({ phase, condition }: { phase: string; condition: string }) =>
      apiRequest("POST", "/api/admin/authority/unlock-condition", { phase, condition }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/authority/unlock-ledger"] });
      toast({
        title: "Unlock Condition Updated",
        description: "Condition saved to ledger",
      });
    },
  });

  const togglePhaseMutation = useMutation({
    mutationFn: async ({ phase, enabled }: { phase: string; enabled: boolean }) =>
      apiRequest("POST", "/api/admin/authority/unlock-phase", { phase, enabled }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/authority/unlock-ledger"] });
      toast({
        title: variables.enabled ? "Phase Unlocked" : "Phase Locked",
        description: `${variables.phase} is now ${variables.enabled ? "enabled" : "disabled"}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to update phase",
        description: formatUserFacingErrorMessage(error, "Phase toggle failed."),
        variant: "destructive",
      });
    },
  });

  const renderTrend = (value: number) => {
    if (value === 0) return <span className="text-white/60">—</span>;
    const Icon = value > 0 ? TrendingUp : TrendingDown;
    const color = value > 0 ? "text-green-500" : "text-red-500";
    return (
      <span className={`flex items-center gap-1 ${color}`}>
        <Icon className="h-4 w-4" />
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  const getInterpretationBadge = (interpretation: string) => {
    if (interpretation.includes("justified")) {
      return (
        <Badge variant="default" className="bg-green-700">
          Authority Justified
        </Badge>
      );
    }
    if (interpretation.includes("too strict")) {
      return <Badge variant="error">Authority Too Strict</Badge>;
    }
    if (interpretation.includes("tone mismatch")) {
      return (
        <Badge variant="outline" className="text-amber-500 border-amber-500">
          Tone Mismatch
        </Badge>
      );
    }
    return <Badge variant="secondary">{interpretation}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-400" />
            Authority Operations
          </h2>
          <p className="text-sm text-white/60 mt-1">
            Observation, interpretation, and unlock governance — no behavior modification
          </p>
        </div>
        <Badge variant={observationLock?.enabled ? "default" : "error"} className="text-sm">
          {observationLock?.enabled ? (
            <>
              <Lock className="h-3 w-3 mr-1" /> Observation Mode
            </>
          ) : (
            "Unlocked"
          )}
        </Badge>
      </div>
      {(metricsFailed || legitimacyFailed || cancelSignalsFailed || unlockLedgerFailed) && (
        <div className="rounded border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          Some authority analytics endpoints are currently unavailable. Values shown below may be
          incomplete for this session.
          {metricsFailed
            ? ` Metrics error: ${String((metricsError as any)?.message || "request failed")}.`
            : ""}
        </div>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="bg-white/5">
          <TabsTrigger value="observation">Observation Mode</TabsTrigger>
          <TabsTrigger value="metrics">Decision Card Metrics</TabsTrigger>
          <TabsTrigger value="legitimacy">Override Legitimacy</TabsTrigger>
          <TabsTrigger value="cancel">Cancel Signals</TabsTrigger>
          <TabsTrigger value="unlock">Unlock Ledger</TabsTrigger>
        </TabsList>

        {/* Observation Mode Lock */}
        <TabsContent value="observation" className="space-y-4">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-500" />
                Observation Mode Lock
              </CardTitle>
              <CardDescription>
                Locks authority to action-gating only. No interpretive signals allowed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="observation-toggle" className="text-white font-medium">
                    Observation Mode
                  </Label>
                  <p className="text-sm text-white/60">
                    When ON: Phase 2B (labels) and 2C (feed weighting) cannot render.
                  </p>
                </div>
                <Switch
                  id="observation-toggle"
                  checked={observationLock?.enabled ?? true}
                  onCheckedChange={(checked) => toggleObservationMutation.mutate(checked)}
                />
              </div>

              {observationLock?.lastChangedAt && (
                <div className="text-sm text-white/60">
                  Last changed by{" "}
                  <span className="text-white">{observationLock.lastChangedBy}</span> on{" "}
                  {new Date(observationLock.lastChangedAt).toLocaleString()}
                </div>
              )}

              {!observationLock?.enabled && (
                <div className="flex items-start gap-2 p-4 bg-red-950/50 border border-red-800 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="text-sm text-red-200">
                    <strong>Warning:</strong> Observation mode disabled. Experimental surfaces are
                    now allowed. This may contaminate early authority data.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Decision Card Metrics */}
        <TabsContent value="metrics" className="space-y-4">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Decision Card Operations</CardTitle>
              <CardDescription>Read-only metrics from authority contract exposure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(metricsFailed || metrics?.available === false) && (
                <div className="rounded border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
                  {metricsFailed
                    ? "Decision card analytics endpoint is unavailable."
                    : metrics?.message || "Decision card analytics are not yet available."}
                </div>
              )}
              {/* Total Shown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-lg">
                  <div className="text-sm text-white/60">Total Decision Cards Shown</div>
                  <div className="text-3xl font-bold text-white mt-2">
                    {metricsFailed ? "N/A" : (metrics?.totalShown ?? 0)}
                  </div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg">
                  <div className="text-sm text-white/60">7-Day Trend</div>
                  <div className="text-2xl font-bold mt-2">
                    {metrics?.trend.shown_7d_change !== undefined
                      ? renderTrend(metrics?.trend?.shown_7d_change ?? 0)
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Guidance Distribution */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Guidance Distribution</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white/5 rounded-lg border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white/60">COMPLY (safe)</div>
                        <div className="text-2xl font-bold text-green-400 mt-1">
                          {metrics?.guidanceDistribution.COMPLY ?? 0}
                        </div>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg border-l-4 border-amber-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white/60">DEFER (caution)</div>
                        <div className="text-2xl font-bold text-amber-400 mt-1">
                          {metrics?.guidanceDistribution.DEFER ?? 0}
                        </div>
                      </div>
                      <Info className="h-8 w-8 text-amber-500 opacity-50" />
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg border-l-4 border-white/15">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white/60">BLOCK (not recommended)</div>
                        <div className="text-2xl font-bold text-white/60 mt-1">
                          {metrics?.guidanceDistribution.BLOCK ?? 0}
                        </div>
                      </div>
                      <XCircle className="h-8 w-8 text-white/60 opacity-50" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Choice Split */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Choice Split</h4>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white/60">Choice</TableHead>
                      <TableHead className="text-white/60 text-right">Count</TableHead>
                      <TableHead className="text-white/60 text-right">7-Day Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-white/10">
                      <TableCell className="text-white">Contact now</TableCell>
                      <TableCell className="text-right text-white">
                        {metrics?.choiceSplit.contact_now ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {metrics?.trend.choice_7d_deltas?.contact_now !== undefined
                          ? renderTrend(metrics?.trend?.choice_7d_deltas?.contact_now ?? 0)
                          : "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-white/10">
                      <TableCell className="text-white">Ask Scout first</TableCell>
                      <TableCell className="text-right text-white">
                        {metrics?.choiceSplit.ask_scout ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {metrics?.trend.choice_7d_deltas?.ask_scout !== undefined
                          ? renderTrend(metrics?.trend?.choice_7d_deltas?.ask_scout ?? 0)
                          : "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-white/10">
                      <TableCell className="text-white">Proceed anyway</TableCell>
                      <TableCell className="text-right text-white">
                        {metrics?.choiceSplit.proceed_anyway ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {metrics?.trend.choice_7d_deltas?.proceed_anyway !== undefined
                          ? renderTrend(metrics?.trend?.choice_7d_deltas?.proceed_anyway ?? 0)
                          : "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-white/10">
                      <TableCell className="text-white">Cancel</TableCell>
                      <TableCell className="text-right text-white">
                        {metrics?.choiceSplit.cancel ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {metrics?.trend.choice_7d_deltas?.cancel !== undefined
                          ? renderTrend(metrics?.trend?.choice_7d_deltas?.cancel ?? 0)
                          : "—"}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-white/10">
                      <TableCell className="text-white">Understand risk (BLOCK override)</TableCell>
                      <TableCell className="text-right text-white">
                        {metrics?.choiceSplit.understand_risk ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {metrics?.trend.choice_7d_deltas?.understand_risk !== undefined
                          ? renderTrend(metrics?.trend?.choice_7d_deltas?.understand_risk ?? 0)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Override Legitimacy Matrix */}
        <TabsContent value="legitimacy" className="space-y-4">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Override Legitimacy Matrix</CardTitle>
              <CardDescription>Where authority is proven or disproven</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-white/60">Scout Action</TableHead>
                    <TableHead className="text-white/60 text-right">Overrides</TableHead>
                    <TableHead className="text-white/60 text-right">
                      Regret After Override
                    </TableHead>
                    <TableHead className="text-white/60">Interpretation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {legitimacy?.map((row) => (
                    <TableRow key={row.scoutAction} className="border-white/10">
                      <TableCell className="text-white font-medium">{row.scoutAction}</TableCell>
                      <TableCell className="text-right text-white">
                        {row.overrides === 0 ? "—" : row.overrides}
                      </TableCell>
                      <TableCell className="text-right text-white">
                        {row.regretAfterOverride === 0
                          ? "—"
                          : `${row.regretAfterOverride} (${row.overrides > 0 ? ((row.regretAfterOverride / row.overrides) * 100).toFixed(1) : 0}%)`}
                      </TableCell>
                      <TableCell>{getInterpretationBadge(row.interpretation)}</TableCell>
                    </TableRow>
                  ))}
                  {(!legitimacy || legitimacy.length === 0) && (
                    <TableRow className="border-white/10">
                      <TableCell colSpan={4} className="text-center text-white/60 py-8">
                        No override data collected yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cancel Signals */}
        <TabsContent value="cancel" className="space-y-4">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Cancel Signal Monitor</CardTitle>
              <CardDescription>
                Cancel ≠ failure. Cancel = decision clarity. Rising cancel after context exposure is
                often success.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-white/5 rounded-lg">
                <div className="text-sm text-white/60">Overall Cancel Rate</div>
                <div className="text-3xl font-bold text-white mt-2">
                  {cancelSignals?.cancelRate !== undefined
                    ? `${(cancelSignals.cancelRate * 100).toFixed(1)}%`
                    : "—"}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Cancel Rate by Guidance</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="text-sm text-white/60">After COMPLY</div>
                    <div className="text-2xl font-bold text-green-400 mt-1">
                      {cancelSignals?.byGuidance.COMPLY !== undefined
                        ? `${(cancelSignals.byGuidance.COMPLY * 100).toFixed(1)}%`
                        : "—"}
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="text-sm text-white/60">After DEFER</div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">
                      {cancelSignals?.byGuidance.DEFER !== undefined
                        ? `${(cancelSignals.byGuidance.DEFER * 100).toFixed(1)}%`
                        : "—"}
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="text-sm text-white/60">After BLOCK</div>
                    <div className="text-2xl font-bold text-white/60 mt-1">
                      {cancelSignals?.byGuidance.BLOCK !== undefined
                        ? `${(cancelSignals.byGuidance.BLOCK * 100).toFixed(1)}%`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unlock Ledger */}
        <TabsContent value="unlock" className="space-y-4">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Authority Unlock Ledger</CardTitle>
              <CardDescription>
                Read-only roadmap. Prevents premature reactivation and loss of institutional memory.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {unlockLedger?.map((item) => (
                  <div key={item.phase} className="p-4 bg-white/5 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-semibold">{item.phase}</h4>
                        <Badge
                          variant={item.status === "LOCKED" ? "error" : "default"}
                          className="mt-1"
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant={item.status === "LOCKED" ? "default" : "outline"}
                        onClick={() =>
                          togglePhaseMutation.mutate({
                            phase: item.phase,
                            enabled: item.status === "LOCKED",
                          })
                        }
                        disabled={togglePhaseMutation.isPending}
                      >
                        {item.status === "LOCKED" ? "Enable phase" : "Disable phase"}
                      </Button>
                    </div>
                    {item.blockedReason && item.status === "LOCKED" && (
                      <div className="text-xs text-amber-300/90 bg-amber-950/40 border border-amber-800/50 rounded-md px-2.5 py-2">
                        {item.blockedReason}
                      </div>
                    )}
                    <div>
                      <Label className="text-white/60 text-xs">Unlock Condition</Label>
                      <Textarea
                        value={unlockNotes[item.phase] ?? item.condition}
                        onChange={(e) =>
                          setUnlockNotes({ ...unlockNotes, [item.phase]: e.target.value })
                        }
                        className="mt-2 bg-tsBg border-white/10 text-white text-sm min-h-[80px]"
                        placeholder="Define unlock condition (e.g., ≥ N overrides with ≥ M regret confirmations)"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() =>
                          updateUnlockConditionMutation.mutate({
                            phase: item.phase,
                            condition: unlockNotes[item.phase] ?? item.condition,
                          })
                        }
                      >
                        Save Condition
                      </Button>
                    </div>
                  </div>
                ))}
                {(!unlockLedger || unlockLedger.length === 0) && (
                  <div className="text-center text-white/60 py-8">No phases defined yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
