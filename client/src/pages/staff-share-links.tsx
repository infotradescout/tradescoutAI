import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Copy, ExternalLink, Link2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ShareableLink = {
  id: string;
  title: string;
  path: string;
  description: string;
  recommendedFor: string;
  useCase: string;
  funnelStage: "awareness" | "consideration" | "conversion" | "retention";
  requiresAuth: boolean;
  cleanUrl: string;
  affiliateUrl: string;
};

type CustomShareLink = {
  id: string;
  slug: string | null;
  description: string;
  destinationUrl: string;
  shortUrl: string | null;
  createdAt: string;
};

type ShareableLinksResponse = {
  referralCode: string;
  generatedAt: string;
  links: ShareableLink[];
  customLinks: CustomShareLink[];
};

function stageLabel(stage: ShareableLink["funnelStage"]): string {
  if (stage === "awareness") return "Awareness";
  if (stage === "consideration") return "Consideration";
  if (stage === "conversion") return "Conversion";
  return "Retention";
}

function stageBadgeClass(stage: ShareableLink["funnelStage"]): string {
  if (stage === "awareness") return "bg-blue-500/20 text-blue-300 border-blue-400/40";
  if (stage === "consideration") return "bg-violet-500/20 text-violet-300 border-violet-400/40";
  if (stage === "conversion") return "bg-emerald-500/20 text-emerald-300 border-emerald-400/40";
  return "bg-amber-500/20 text-amber-300 border-amber-400/40";
}

export default function StaffShareLinksPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [lastCopied, setLastCopied] = useState<string>("");

  const { data, isLoading, isError, error } = useQuery<ShareableLinksResponse>({
    queryKey: ["/api/staff/shareable-links"],
    enabled: isAuthenticated,
    queryFn: () => apiRequest("GET", "/api/staff/shareable-links"),
  });

  const links = data?.links || [];
  const customLinks = data?.customLinks || [];

  const filteredLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter((link) =>
      [link.title, link.description, link.path, link.recommendedFor, link.useCase]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [links, search]);

  const copyText = async (value: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setLastCopied(key);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard.`,
      });
      setTimeout(() => setLastCopied(""), 1500);
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy link. Try again.",
        variant: "destructive",
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen  text-tsTextMain px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <Card className="bg-tsCard border-tsBorder">
            <CardHeader>
              <CardTitle>Staff/Admin access required</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-tsTextMuted">
              Sign in with a staff or admin account to access the shareable links library.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen  text-tsTextMain px-4 py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card className="bg-tsCard border-tsBorder">
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Link2 className="h-6 w-6 text-tsOrange" />
              Shareable Site Link Library
            </CardTitle>
            <p className="text-sm text-tsTextMuted max-w-3xl">
              Staff and admin can copy strategic page links without hunting through the app. Every
              affiliate URL below already includes your referral credit.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <Badge className="bg-tsOrange/20 text-tsOrange border border-tsOrange/40">
                Referral code: {data?.referralCode || "loading..."}
              </Badge>
              {data?.generatedAt ? (
                <span className="text-tsTextMuted">
                  Generated: {new Date(data.generatedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-tsTextMuted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by page, use-case, funnel stage..."
                className="pl-9 bg-tsBg border-tsBorder text-tsTextMain"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card className="bg-tsCard border-tsBorder">
            <CardContent className="py-8 text-sm text-tsTextMuted">
              Loading share links...
            </CardContent>
          </Card>
        ) : null}

        {isError ? (
          <Card className="bg-tsCard border-destructive/50">
            <CardContent className="py-8 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load share links."}
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && !isError ? (
          <div className="space-y-4">
            {filteredLinks.map((link) => {
              const affiliateKey = `${link.id}:aff`;
              const cleanKey = `${link.id}:clean`;
              return (
                <Card key={link.id} className="bg-tsCard border-tsBorder">
                  <CardContent className="pt-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-tsTextMain">{link.title}</h3>
                        <Badge
                          variant="outline"
                          className={`border ${stageBadgeClass(link.funnelStage)}`}
                        >
                          {stageLabel(link.funnelStage)}
                        </Badge>
                        {link.requiresAuth ? (
                          <Badge variant="outline" className="border-amber-400/40 text-amber-300">
                            Requires login
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-400/40 text-emerald-300"
                          >
                            Public
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-tsTextMuted">{link.description}</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-md border border-tsBorder bg-tsBg/60 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-tsTextMuted mb-1">
                            Recommended For
                          </p>
                          <p className="text-tsTextMain">{link.recommendedFor}</p>
                        </div>
                        <div className="rounded-md border border-tsBorder bg-tsBg/60 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-tsTextMuted mb-1">
                            Use Case
                          </p>
                          <p className="text-tsTextMain">{link.useCase}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="rounded-md border border-tsBorder bg-tsBg/70 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-tsTextMuted mb-1">
                            Affiliate URL
                          </p>
                          <p className="font-mono text-xs text-tsTextMain break-all">
                            {link.affiliateUrl}
                          </p>
                        </div>
                        <div className="rounded-md border border-tsBorder bg-tsBg/60 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-tsTextMuted mb-1">
                            Clean URL
                          </p>
                          <p className="font-mono text-xs text-tsTextMuted break-all">
                            {link.cleanUrl}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-tsOrange hover:bg-tsOrange/90"
                          onClick={() => copyText(link.affiliateUrl, affiliateKey, "Affiliate URL")}
                        >
                          {lastCopied === affiliateKey ? (
                            <Check className="w-4 h-4 mr-2" />
                          ) : (
                            <Copy className="w-4 h-4 mr-2" />
                          )}
                          Copy Affiliate URL
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-tsBorder text-tsTextMain"
                          onClick={() => copyText(link.cleanUrl, cleanKey, "Clean URL")}
                        >
                          {lastCopied === cleanKey ? (
                            <Check className="w-4 h-4 mr-2" />
                          ) : (
                            <Copy className="w-4 h-4 mr-2" />
                          )}
                          Copy Clean URL
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-tsBorder text-tsTextMain"
                          onClick={() =>
                            window.open(link.affiliateUrl, "_blank", "noopener,noreferrer")
                          }
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filteredLinks.length === 0 ? (
              <Card className="bg-tsCard border-tsBorder">
                <CardContent className="py-8 text-sm text-tsTextMuted">
                  No links matched that filter.
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        <Card className="bg-tsCard border-tsBorder">
          <CardHeader>
            <CardTitle className="text-lg">Your Custom Short-Link Log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customLinks.length === 0 ? (
              <p className="text-sm text-tsTextMuted">
                No custom short links yet. Create them in your affiliate dashboard if needed.
              </p>
            ) : (
              customLinks.map((link) => (
                <div
                  key={link.id}
                  className="rounded-md border border-tsBorder bg-tsBg/60 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-tsTextMain">{link.description}</p>
                    <span className="text-xs text-tsTextMuted">
                      {new Date(link.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-tsTextMuted break-all">
                    {link.shortUrl || link.destinationUrl}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-tsBorder text-tsTextMain"
                      onClick={() =>
                        copyText(
                          link.shortUrl || link.destinationUrl,
                          `custom:${link.id}`,
                          "Short link"
                        )
                      }
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-tsBorder text-tsTextMain"
                      onClick={() =>
                        window.open(
                          link.shortUrl || link.destinationUrl,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
