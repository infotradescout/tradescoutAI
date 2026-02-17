import { useMemo } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { SEOHelmet } from "@/components/SEOHelmet";

type SharedDirectConnectRequest = {
  id: string;
  title: string;
  scopeSummary: string;
  category: string | null;
  tradeLabel: string;
  locationLabel: string;
  budgetRange: string | null;
};

export default function DirectConnectSharePage() {
  const [, params] = useRoute("/r/:shareToken");
  const shareToken = String(params?.shareToken || "");
  const { isAuthenticated, user } = useAuth();

  const { data, isLoading, isError } = useQuery<SharedDirectConnectRequest>({
    queryKey: ["/api/direct-connect/share", shareToken],
    queryFn: async () => {
      const res = await fetch(`/api/direct-connect/share/${encodeURIComponent(shareToken)}`);
      if (!res.ok) {
        throw new Error("Shared request not found");
      }
      return res.json();
    },
    enabled: Boolean(shareToken),
  });

  const title = useMemo(() => {
    if (data?.title) return `${data.title} | TradeScout`;
    return "Shared request | TradeScout";
  }, [data]);

  const description = useMemo(() => {
    if (!data) return "A shared TradeScout request preview. Join and verify to unlock access.";
    return `${data.tradeLabel} scope in ${data.locationLabel}. Join and verify to unlock request access.`;
  }, [data]);

  const addressVerified = Boolean((user as any)?.addressVerified);
  const joinHref = `/pre-scout-setup?mode=create&next=${encodeURIComponent(`/r/${shareToken}`)}`;
  const verifyHref = `/verification?next=${encodeURIComponent(`/r/${shareToken}`)}`;
  const openHref = `/direct-connect?shared=${encodeURIComponent(shareToken)}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 text-tsTextMain">
      <SEOHelmet title={title} description={description} canonical={window.location.href} />

      <Card className="rounded-2xl border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
        <CardHeader className="space-y-3">
          <Badge variant="outline" className="w-fit">
            Shared request preview
          </Badge>
          <CardTitle className="text-xl md:text-2xl text-[color:var(--text-primary)]">
            {isLoading ? "Loading request..." : data?.title || "Shared request"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError && (
            <p className="text-sm text-[color:var(--text-secondary)]">
              This shared request is no longer available.
            </p>
          )}

          {!isError && (
            <>
              <div className="flex flex-wrap gap-2 text-xs text-[color:var(--text-secondary)]">
                {data?.tradeLabel && <Badge variant="outline">{data.tradeLabel}</Badge>}
                {data?.locationLabel && <Badge variant="outline">{data.locationLabel}</Badge>}
                {data?.budgetRange && <Badge variant="outline">Budget {data.budgetRange}</Badge>}
              </div>
              <p className="text-sm text-[color:var(--text-secondary)]">
                {data?.scopeSummary || "Project scope is available after loading."}
              </p>
              <div className="rounded-md border border-[color:var(--border-subtle)] p-3 text-xs text-[color:var(--text-secondary)]">
                Contact details and claim controls are locked on shared previews. Join TradeScout
                and complete verification to continue through the request flow.
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {!isAuthenticated && (
              <a href={joinHref}>
                <Button className="bg-tsAccent text-tsOnAccent hover:bg-tsAccent/90">
                  Join to request access
                </Button>
              </a>
            )}
            {isAuthenticated && !addressVerified && (
              <a href={verifyHref}>
                <Button className="bg-tsAccent text-tsOnAccent hover:bg-tsAccent/90">
                  Verify to unlock
                </Button>
              </a>
            )}
            {isAuthenticated && addressVerified && (
              <a href={openHref}>
                <Button className="bg-tsAccent text-tsOnAccent hover:bg-tsAccent/90">
                  Open in Direct Connect
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
