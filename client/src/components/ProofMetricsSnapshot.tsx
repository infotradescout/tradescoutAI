import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ProofMetricsResponse {
  generatedAt: string;
  cacheSeconds: number;
  countiesIndexed: number;
  decisionsLast7Days: number;
  verifiedClaimsLast30Days: number;
}

const formatNumber = (value: number) => new Intl.NumberFormat(undefined).format(value);

export function ProofMetricsSnapshot() {
  const { data, isLoading, isError } = useQuery<ProofMetricsResponse>({
    queryKey: ["/api/public/proof-metrics"],
    staleTime: 60_000,
    retry: 1,
  });

  // Fail-safe: hide module entirely on error to avoid implying false success.
  if (isError) return null;

  return (
    <Card className="bg-surface border-subtle mt-6">
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Metric label="Counties indexed" value={data?.countiesIndexed} isLoading={isLoading} />
          <Metric label="Decisions (7 days)" value={data?.decisionsLast7Days} isLoading={isLoading} />
          <Metric label="Verified claims (30 days)" value={data?.verifiedClaimsLast30Days} isLoading={isLoading} />
        </div>
        <p className="text-xs text-secondary mt-3">
          Counts are anonymized. Contact is gated by a Decision Card.
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  isLoading,
}: {
  label: string;
  value?: number;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-lg border border-subtle bg-surface-hover p-4">
      <div className="text-xs font-medium text-secondary mb-2">{label}</div>
      {isLoading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="text-2xl font-bold text-primary">
          {typeof value === "number" ? formatNumber(value) : "—"}
        </div>
      )}
    </div>
  );
}
