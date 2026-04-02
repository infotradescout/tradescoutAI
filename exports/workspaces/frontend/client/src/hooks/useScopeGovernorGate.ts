import { useEffect, useState } from "react";
import { FEATURE_SCOPE_GOVERNOR_ENFORCED } from "@shared/governanceFlags";
import type { ScopeGovernorState } from "@shared/missionControlGovernance";

interface GateState {
  enforced: boolean;
  checking: boolean;
  scope: ScopeGovernorState | null;
  error?: string;
}

export function useScopeGovernorGate() {
  const [state, setState] = useState<GateState>({
    enforced: FEATURE_SCOPE_GOVERNOR_ENFORCED,
    checking: FEATURE_SCOPE_GOVERNOR_ENFORCED,
    scope: null,
    error: undefined,
  });

  useEffect(() => {
    if (!FEATURE_SCOPE_GOVERNOR_ENFORCED) return;

    let cancelled = false;

    const loadScopeGovernor = async () => {
      try {
        const res = await fetch("/api/admin/mission-control/summary");
        if (!res.ok) {
          throw new Error(`summary status ${res.status}`);
        }

        const data = await res.json();
        const scope = (data?.scopeGovernor ?? { scopeFrozen: false, reasons: [] }) as ScopeGovernorState;

        if (cancelled) return;
        setState({
          enforced: true,
          checking: false,
          scope,
          error: undefined,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          enforced: true,
          checking: false,
          scope: { scopeFrozen: false, reasons: [] },
          error: err instanceof Error ? err.message : "unknown error",
        });
      }
    };

    loadScopeGovernor();

    return () => {
      cancelled = true;
    };
  }, []);

  const scopeFrozen = !!state.scope?.scopeFrozen;
  const reasons = state.scope?.reasons ?? [];
  const blocked = state.enforced && scopeFrozen;

  return { ...state, blocked, reasons };
}
