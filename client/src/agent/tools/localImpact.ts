import type { LocalImpactSummary } from '@/components/dashboard/LocalImpactCard';

/**
 * Fetch the unified Local Impact snapshot for the current user.
 * Scout and other agents should use this as the single source of truth
 * for local vault balance, contributions, and affiliate impact.
 */
export async function fetchLocalImpactSummary(): Promise<LocalImpactSummary> {
  const res = await fetch('/api/local-impact/summary', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.message || `Failed to load local impact summary (${res.status})`;
    throw new Error(message);
  }

  const json = await res.json();

  // Ensure all numeric fields are present and non-null
  return {
    localVaultBalance: Number(json.localVaultBalance ?? 0),
    userDirectContribution: Number(json.userDirectContribution ?? 0),
    userIndirectContribution: Number(json.userIndirectContribution ?? 0),
    affiliateEarnings: Number(json.affiliateEarnings ?? 0),
    affiliatesOnboardedCount: Number(json.affiliatesOnboardedCount ?? 0),
    countyId: json.countyId ?? null,
    countyName: json.countyName ?? null,
    stateCode: json.stateCode ?? null,
  };
}
