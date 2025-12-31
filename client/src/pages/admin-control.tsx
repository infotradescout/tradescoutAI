import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Shield, TrendingDown, Database } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface ControlState {
  authorityMode: "normal" | "conservative" | "advisory";
  confidenceDampener: number;
  outcomeLearningEnabled: boolean;
}

interface HealthMetrics {
  blockRate: string;
  overrideRate: string;
  regretAfterOverride: string;
  totalOutcomes: number;
  totalOverrides: number;
}

export default function AdminControl() {
  const { user } = useAuth();
  const [state, setState] = useState<ControlState | null>(null);
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  const apiBase = "/api/admin-control";

  const loadState = async () => {
    try {
      const res = await fetch(`${apiBase}/state`);
      if (!res.ok) throw new Error("Failed to load state");
      const data = await res.json();
      setState(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadHealth = async () => {
    try {
      const res = await fetch(`${apiBase}/health`);
      if (!res.ok) throw new Error("Failed to load health");
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!user || (user.role !== "super_admin" && user.role !== "head_admin")) return;

    Promise.all([loadState(), loadHealth()]).finally(() => setLoading(false));
  }, [user]);

  const setAuthorityMode = async (mode: ControlState["authorityMode"]) => {
    setActionPending(true);
    try {
      const res = await fetch(`${apiBase}/authority-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error("Failed to set mode");
      await loadState();
    } catch (err) {
      console.error(err);
    } finally {
      setActionPending(false);
    }
  };

  const setConfidenceDampener = async (multiplier: number) => {
    setActionPending(true);
    try {
      const res = await fetch(`${apiBase}/confidence-dampener`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiplier }),
      });
      if (!res.ok) throw new Error("Failed to set dampener");
      await loadState();
    } catch (err) {
      console.error(err);
    } finally {
      setActionPending(false);
    }
  };

  const toggleOutcomeLearning = async () => {
    if (!state) return;
    setActionPending(true);
    try {
      const res = await fetch(`${apiBase}/outcome-learning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !state.outcomeLearningEnabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle learning");
      await loadState();
    } catch (err) {
      console.error(err);
    } finally {
      setActionPending(false);
    }
  };

  const resetScope = async () => {
    const scope = prompt("Enter scope hash to reset (dangerous):");
    if (!scope) return;

    setActionPending(true);
    try {
      const res = await fetch(`${apiBase}/reset-scope`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (!res.ok) throw new Error("Failed to reset scope");
      alert(`Scope ${scope} reset successfully`);
      await loadHealth();
    } catch (err) {
      console.error(err);
      alert("Failed to reset scope");
    } finally {
      setActionPending(false);
    }
  };

  if (!user || (user.role !== "super_admin" && user.role !== "head_admin")) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-semibold">Super admin access required</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!state || !health) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Super Admin Control Plane
        </h1>
        <p className="text-muted-foreground mt-2">
          Emergency brakes and system governors. Use sparingly.
        </p>
      </div>

      {/* System Health Panel */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-blue-900 dark:text-blue-100">
          <TrendingDown className="h-5 w-5" />
          System Health
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {health.blockRate}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-500">BLOCK Rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {health.overrideRate}
            </div>
            <div className="text-sm text-yellow-600 dark:text-yellow-500">Override Rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {health.regretAfterOverride}
            </div>
            <div className="text-sm text-red-600 dark:text-red-500">Regret After Override</div>
          </div>
        </div>
        <div className="mt-4 text-xs text-blue-800 dark:text-blue-200">
          Total: {health.totalOutcomes} outcomes, {health.totalOverrides} overrides
        </div>
      </Card>

      {/* Authority Mode */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Scout Authority Mode
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Control how aggressively Scout exercises authority.
        </p>
        <div className="flex gap-3">
          <Button
            onClick={() => setAuthorityMode("normal")}
            disabled={actionPending}
            variant={state.authorityMode === "normal" ? "default" : "outline"}
          >
            Normal
          </Button>
          <Button
            onClick={() => setAuthorityMode("conservative")}
            disabled={actionPending}
            variant={state.authorityMode === "conservative" ? "default" : "outline"}
          >
            Conservative (no BLOCK)
          </Button>
          <Button
            onClick={() => setAuthorityMode("advisory")}
            disabled={actionPending}
            variant={state.authorityMode === "advisory" ? "default" : "outline"}
          >
            Advisory Only
          </Button>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          Current: <span className="font-semibold">{state.authorityMode}</span>
        </div>
      </Card>

      {/* Confidence Dampener */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Confidence Dampener</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Global multiplier for all confidence scores. Lower = more cautious.
        </p>
        <div className="space-y-4">
          <Slider
            value={[state.confidenceDampener]}
            onValueChange={([val]) => setConfidenceDampener(val)}
            min={0}
            max={2}
            step={0.1}
            disabled={actionPending}
            className="w-full"
          />
          <div className="text-center">
            <span className="text-2xl font-bold">{state.confidenceDampener.toFixed(1)}x</span>
          </div>
        </div>
      </Card>

      {/* Outcome Learning */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Outcome Learning</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Emergency brake. Disable if outcome signals are poisoned.
        </p>
        <Button
          onClick={toggleOutcomeLearning}
          disabled={actionPending}
          variant={state.outcomeLearningEnabled ? "default" : "destructive"}
        >
          {state.outcomeLearningEnabled ? "Learning: ON" : "Learning: OFF (EMERGENCY)"}
        </Button>
      </Card>

      {/* Institutional Memory Manager */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Database className="h-5 w-5" />
          Institutional Memory
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Reset confidence for a specific scope. Use only when pattern is poisoned.
        </p>
        <Button onClick={resetScope} disabled={actionPending} variant="destructive">
          Reset Scope Confidence
        </Button>
      </Card>

      {/* Warning */}
      <Card className="p-6 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
        <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">⚠️ Warning</h3>
        <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
          <li>These controls affect the entire system immediately.</li>
          <li>Conservative mode disables BLOCK globally—use during calibration only.</li>
          <li>Disabling learning freezes all confidence updates.</li>
          <li>Resetting a scope erases all learned patterns for that context.</li>
        </ul>
      </Card>
    </div>
  );
}
