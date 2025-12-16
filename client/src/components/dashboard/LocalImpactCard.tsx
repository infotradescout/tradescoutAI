import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'wouter';

export interface LocalImpactSummary {
  localVaultBalance: number;
  userDirectContribution: number;
  userIndirectContribution: number;
  affiliateEarnings: number;
  affiliatesOnboardedCount: number;
  countyId: string | null;
  countyName: string | null;
  stateCode: string | null;
}

interface LocalImpactCardProps {
  className?: string;
}

export function LocalImpactCard({ className }: LocalImpactCardProps) {
  const { user } = useAuth();

  const { data, isLoading, isError, error } = useQuery<LocalImpactSummary | null>({
    queryKey: ['/api/local-impact/summary'],
    queryFn: async () => {
      const res = await fetch('/api/local-impact/summary');
      if (res.status === 400) {
        // User has not set county/state yet
        return null;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.message || 'Failed to load local impact summary';
        throw new Error(message);
      }
      return res.json();
    },
  });

  const locationLabel = data?.countyName && data?.stateCode
    ? `${data.countyName}, ${data.stateCode}`
    : user?.county && user?.state
      ? `${user.county}, ${user.state}`
      : 'Set your location';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const showDevErrorDetails = import.meta.env.DEV && isError && error instanceof Error;

  return (
    <Card className={`bg-white dark:bg-slate-800 border-0 shadow-sm ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-orange-500" />
              Local Impact
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {locationLabel}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && (
          <p className="text-slate-500 dark:text-slate-400">
            Loading your Local Impact snapshot...
          </p>
        )}

        {!isLoading && isError && (
          <div className="space-y-2">
            <p className="text-sm text-red-500">
              We couldn't load your Local Impact right now.
            </p>
            {showDevErrorDetails && (
              <p className="text-xs text-red-400 break-all">
                {(error as Error).message}
              </p>
            )}
          </div>
        )}

        {!isLoading && !isError && data && (
          <>
            <div className="space-y-2">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Local Vault
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(data.localVaultBalance)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Community-funded projects &amp; incentives
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Your Direct Contribution
                  </div>
                  <div className="text-base font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(data.userDirectContribution)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Your Indirect Contribution
                  </div>
                  <div className="text-base font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(data.userIndirectContribution)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Affiliate Earnings
                  </div>
                  <div className="text-base font-semibold text-emerald-600 dark:text-emerald-300">
                    {formatCurrency(data.affiliateEarnings)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Affiliates Onboarded
                  </div>
                  <div className="text-base font-semibold text-slate-900 dark:text-white">
                    {data.affiliatesOnboardedCount || 0}
                  </div>
                </div>
              </div>
            </div>

            {data.countyId && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between mt-2">
                <span className="text-slate-500 dark:text-slate-400">
                  Transparency
                </span>
                <Link href={`/county/${data.countyId}/transparency`}>
                  <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline cursor-pointer">
                    View full local transparency
                  </span>
                </Link>
              </div>
            )}
          </>
        )}

        {!isLoading && !isError && data === null && (
          <div className="space-y-2 text-sm">
            <p className="text-slate-600 dark:text-slate-400">
              Add your county and state so we can show how your community vault is being funded.
            </p>
            <Link href="/profile">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white w-full">
                Update location
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
