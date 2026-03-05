import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { isSuperAdminLike } from "@/lib/roleChecks";

interface DiagnosticData {
  summary: {
    totalOverrides: number;
    totalSuccesses: number;
    totalFailures: number;
    overrideRate: string;
  };
  overridesByScope: Array<{
    scope: string;
    count: number;
    recentTimestamp: string;
  }>;
  confidenceDistribution: Array<{
    scope: string;
    successCount: number;
    failureCount: number;
    confidence: number;
    lastUpdated: string;
  }>;
  outcomeSequences: Array<{
    overrideId: number;
    scope: string;
    overrideTime: string;
    followedBy: {
      outcome: string;
      when: string;
    } | null;
  }>;
  generatedAt: string;
}

export default function AdminAuthorityDiagnostics() {
  const { user } = useAuth();
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isSuperAdminLike(user.role)) return;

    fetch("/api/scout-analytics/authority-diagnostics")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load diagnostics");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isSuperAdminLike(user.role)) {
    return <div className="p-8 text-center">Admin access required</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-6 bg-destructive/10 border-destructive">
          <p className="text-destructive font-semibold">Error: {error}</p>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  // Calculate regret vs success from outcome sequences
  const sequenceAnalysis = data.outcomeSequences.reduce(
    (acc, seq) => {
      if (!seq.followedBy) {
        acc.noData++;
      } else if (seq.followedBy.outcome === "success") {
        acc.overrideSuccess++;
      } else if (seq.followedBy.outcome === "failure") {
        acc.overrideRegret++;
      }
      return acc;
    },
    { overrideSuccess: 0, overrideRegret: 0, noData: 0 }
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Authority Diagnostics</h1>
        <p className="text-muted-foreground mt-2">
          Observe how Scout's authority system performs. Do not treat this as feature metrics—use it
          to detect calibration drift.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Generated: {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>

      {/* Summary */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">System Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold text-primary">{data.summary.totalSuccesses}</div>
            <div className="text-sm text-muted-foreground">Total Successes</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-destructive">{data.summary.totalFailures}</div>
            <div className="text-sm text-muted-foreground">Total Failures</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">{data.summary.totalOverrides}</div>
            <div className="text-sm text-muted-foreground">Ignored Advice (Overrides)</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{data.summary.overrideRate}</div>
            <div className="text-sm text-muted-foreground">Override Rate</div>
          </div>
        </div>
      </Card>

      {/* Override Outcomes */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">What Happens After Overrides</h2>
        <p className="text-sm text-muted-foreground mb-4">
          When users defy Scout's guidance, does it end well or badly? This reveals if boundaries
          are too strict or too loose.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {sequenceAnalysis.overrideSuccess}
            </div>
            <div className="text-sm text-green-600 dark:text-green-500">Override → Success</div>
            <div className="text-xs text-muted-foreground mt-1">Scout was too cautious</div>
          </div>
          <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {sequenceAnalysis.overrideRegret}
            </div>
            <div className="text-sm text-red-600 dark:text-red-500">Override → Failure</div>
            <div className="text-xs text-muted-foreground mt-1">Scout was correct</div>
          </div>
          <div className="bg-white/5 dark:bg-tsCard p-4 rounded-lg border border-white/10 dark:border-white/10">
            <div className="text-2xl font-bold text-white/70 dark:text-white/60">
              {sequenceAnalysis.noData}
            </div>
            <div className="text-sm text-white/60 dark:text-white/60">No Follow-up Data</div>
            <div className="text-xs text-muted-foreground mt-1">Outcome unknown</div>
          </div>
        </div>
      </Card>

      {/* Overrides by Scope */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Overrides by Scope (Top 20)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Which scopes trigger the most defiance? High override rates suggest authority doesn't
          match user intent.
        </p>
        <div className="space-y-2">
          {data.overridesByScope.slice(0, 20).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded">
              <div className="flex-1">
                <code className="text-xs font-mono text-primary">{item.scope}</code>
              </div>
              <div className="text-right">
                <div className="font-semibold">{item.count} overrides</div>
                <div className="text-xs text-muted-foreground">
                  Last: {new Date(item.recentTimestamp).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
          {data.overridesByScope.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No overrides recorded yet.
            </p>
          )}
        </div>
      </Card>

      {/* Confidence Distribution */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Confidence Distribution (Top 20 Scopes)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Where is Scout most and least confident? Low confidence with high success suggests
          under-learning.
        </p>
        <div className="space-y-2">
          {data.confidenceDistribution.slice(0, 20).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded">
              <div className="flex-1">
                <code className="text-xs font-mono text-primary">{item.scope}</code>
              </div>
              <div className="text-right space-y-1">
                <div className="font-semibold">Confidence: {item.confidence.toFixed(3)}</div>
                <div className="text-xs text-muted-foreground">
                  {item.successCount} ✓ / {item.failureCount} ✗
                </div>
                <div className="text-xs text-muted-foreground">
                  Updated: {new Date(item.lastUpdated).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
          {data.confidenceDistribution.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No confidence data yet.
            </p>
          )}
        </div>
      </Card>

      {/* Interpretation Guide */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          How to Read This Data
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>
            <strong>High override rate + low regret:</strong> Scout is too strict; users are right
            to defy.
          </li>
          <li>
            <strong>High override rate + high regret:</strong> Users ignore good advice; UI needs
            clarity.
          </li>
          <li>
            <strong>Low override rate + high confidence:</strong> System is well-calibrated.
          </li>
          <li>
            <strong>Low confidence + consistent success:</strong> Scout is under-learning (rate too
            slow).
          </li>
          <li>
            <strong>Scope with many overrides:</strong> Likely wrong risk category or fingerprint
            collision.
          </li>
        </ul>
      </Card>
    </div>
  );
}
