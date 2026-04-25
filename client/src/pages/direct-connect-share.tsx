import { useMemo } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { hasAdminUiAccess } from "@/lib/roleChecks";
import { SEOHelmet } from "@/components/SEOHelmet";
import { share } from "@/utils/share";
import { useToast } from "@/hooks/use-toast";
import { Copy, Share2, ArrowRight } from "lucide-react";

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
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useQuery<SharedDirectConnectRequest>({
    queryKey: ["/api/direct-connect/share", shareToken],
    queryFn: async () => {
      const res = await fetch(`/api/direct-connect/share/${encodeURIComponent(shareToken)}`);
      if (!res.ok) {
        const err = new Error("Shared request not found") as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    enabled: Boolean(shareToken),
  });

  const title = useMemo(() => {
    if (data?.title) return `${data.title} | TradeScout`;
    return "Shared request | TradeScout";
  }, [data]);
  const canonicalUrl = useMemo(
    () => `https://www.thetradescout.com/r/${encodeURIComponent(shareToken)}`,
    [shareToken]
  );

  const description = useMemo(() => {
    if (!data) return "A shared TradeScout request preview. Join and verify to unlock access.";
    return `${data.tradeLabel} scope in ${data.locationLabel}. Join and verify to unlock request access.`;
  }, [data]);

  const addressVerified = Boolean(user?.addressVerified);
  const hasVerificationBypass = Boolean(user?.verificationBypass?.active);
  const isAdminLike = hasAdminUiAccess(user);
  const canUnlockSharedRequest = addressVerified || hasVerificationBypass || isAdminLike;
  const joinHref = `/pre-scout-setup?mode=create&next=${encodeURIComponent(`/r/${shareToken}`)}`;
  const verifyHref = `/verification?next=${encodeURIComponent(`/r/${shareToken}`)}`;
  const openHref = `/direct-connect?shared=${encodeURIComponent(shareToken)}`;
  const startHref = "/direct-connect";

  const sharePage = async () => {
    await share({
      url: window.location.href,
      title: data?.title || "TradeScout Direct Connect request",
      text: "TradeScout Direct Connect request page",
      contextLabel: "Request page",
    });
  };

  const copyLink = async () => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Request page link copied to clipboard.",
      });
    } catch {
      toast({
        title: "Unable to copy link",
        description: "Use Share to send this page.",
        variant: "destructive",
      });
    }
  };

  const errorStatus =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: number }).status || 0)
      : 0;
  const isClosedOrMissing = isError && (errorStatus === 404 || errorStatus === 410 || !errorStatus);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 text-white">
      <SEOHelmet title={title} description={description} canonical={canonicalUrl} />

      <Card className="rounded-2xl border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
        <CardHeader className="space-y-3">
          <Badge variant="outline" className="w-fit">
            {isClosedOrMissing ? "Request closed" : "Shared request preview"}
          </Badge>
          <CardTitle className="text-xl md:text-2xl text-[color:var(--text-primary)]">
            {isLoading
              ? "Loading request..."
              : isClosedOrMissing
                ? "This request is closed"
                : data?.title || "Shared request"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isClosedOrMissing && (
            <>
              <p className="text-sm text-[color:var(--text-secondary)]">
                This mini landing page was removed because the Direct Connect request is no longer
                open.
              </p>
              <div className="rounded-md border border-[color:var(--border-subtle)] p-3 text-xs text-[color:var(--text-secondary)]">
                TradeScout removes request pages when a request is cancelled, completed, or closed.
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={startHref}>
                  <Button className="bg-ts-orange text-text-black hover:bg-ts-orange/90">
                    Start a new request
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </a>
                <a href="/direct-connect/board">
                  <Button variant="outline" className="border-[color:var(--border-subtle)]">
                    Open requests
                  </Button>
                </a>
                <a href="/community">
                  <Button variant="outline" className="border-[color:var(--border-subtle)]">
                    Open Community
                  </Button>
                </a>
              </div>
            </>
          )}

          {!isClosedOrMissing && (
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
                {canUnlockSharedRequest
                  ? "Shared previews keep contact details and claim controls hidden. Open this request in Direct Connect for full action tools."
                  : "Contact details and claim controls stay hidden on shared previews. Join TradeScout and complete verification to continue."}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="border-[color:var(--border-subtle)]"
                  onClick={sharePage}
                >
                  <Share2 className="mr-1 h-4 w-4" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  className="border-[color:var(--border-subtle)]"
                  onClick={copyLink}
                >
                  <Copy className="mr-1 h-4 w-4" />
                  Copy link
                </Button>
              </div>
            </>
          )}

          {!isClosedOrMissing && (
            <div className="flex flex-wrap gap-2 pt-2">
              {!isAuthenticated && (
                <a href={joinHref}>
                  <Button className="bg-ts-orange text-text-black hover:bg-ts-orange/90">
                    Join to request access
                  </Button>
                </a>
              )}
              {isAuthenticated && !canUnlockSharedRequest && (
                <a href={verifyHref}>
                  <Button className="bg-ts-orange text-text-black hover:bg-ts-orange/90">
                    Verify to unlock
                  </Button>
                </a>
              )}
              {isAuthenticated && canUnlockSharedRequest && (
                <a href={openHref}>
                  <Button className="bg-ts-orange text-text-black hover:bg-ts-orange/90">
                    Open in Direct Connect
                  </Button>
                </a>
              )}
              <a href="/direct-connect/board">
                <Button variant="outline" className="border-[color:var(--border-subtle)]">
                  Open requests
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
