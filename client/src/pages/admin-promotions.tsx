import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Plus, Filter, MapPin, Image as ImageIcon, Link2, CheckCircle2 } from "lucide-react";

type Promotion = {
  id: string;
  title: string;
  shortDescription: string;
  imageAttachmentId?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  type: "trade_deal" | "sponsor" | "affiliate" | "announcement";
  exclusive: boolean;
  status: "draft" | "active" | "paused" | "ended";
  countyFips: string[];
  placementCommunitySnapshot: boolean;
  createdAt: string;
};

export default function AdminPromotionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const { data: promotions, isLoading } = useQuery<Promotion[]>({
    queryKey: ["/api/admin/promotions", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      return apiRequest("GET", `/api/admin/promotions?${params.toString()}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Promotion>) => {
      return apiRequest("POST", "/api/admin/promotions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      toast({ title: "Promotion created", description: "New promotion is now available." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Action failed."),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Promotion> }) => {
      return apiRequest("PUT", `/api/admin/promotions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      toast({ title: "Promotion updated", description: "Changes saved successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: formatUserFacingErrorMessage(error, "Action failed."),
        variant: "destructive",
      });
    },
  });

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftCountyFips, setDraftCountyFips] = useState("");
  const [draftCtaLabel, setDraftCtaLabel] = useState("View TradeDeal");
  const [draftCtaUrl, setDraftCtaUrl] = useState("");
  const [draftSnapshot, setDraftSnapshot] = useState(true);

  const handleCreateTradeDeal = () => {
    const countyList = draftCountyFips
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    createMutation.mutate({
      title: draftTitle.trim(),
      shortDescription: draftDescription.trim(),
      type: "trade_deal",
      exclusive: true,
      tier: "paid_campaign",
      status: "active",
      countyFips: countyList,
      ctaLabel: draftCtaLabel.trim(),
      ctaUrl: draftCtaUrl.trim(),
      placementCommunitySnapshot: draftSnapshot,
      placementCommunityFeed: false,
      placementScout: false,
      placementMarketplace: false,
    } as any);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-tsCard/95 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Plus className="w-4 h-4 text-ts-orange" />
            Promotions Manager
          </CardTitle>
          <CardDescription className="text-white/70">
            Canonical promotions for TradeDeals, sponsors, and announcements. TradeDeals here feed
            the Community Snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="space-y-4">
            <TabsList>
              <TabsTrigger value="create">Create TradeDeal</TabsTrigger>
              <TabsTrigger value="list">All promotions</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="Local TradeDeal title"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Short description</Label>
                    <Textarea
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      placeholder="One or two lines describing the TradeDeal."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>County FIPS (comma-separated)</Label>
                    <Input
                      value={draftCountyFips}
                      onChange={(e) => setDraftCountyFips(e.target.value)}
                      placeholder="06037, 48453"
                    />
                    <p className="text-xs text-white/60">
                      Required for Community Snapshot. Each TradeDeal must declare the counties it
                      is eligible for.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>CTA label</Label>
                    <Input
                      value={draftCtaLabel}
                      onChange={(e) => setDraftCtaLabel(e.target.value)}
                      placeholder="View TradeDeal"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>CTA URL</Label>
                    <Input
                      value={draftCtaUrl}
                      onChange={(e) => setDraftCtaUrl(e.target.value)}
                      placeholder="https://... or internal path"
                    />
                    <p className="text-xs text-white/60">
                      Where should this TradeDeal send users? Can be an internal route or external
                      partner page.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox
                      id="snapshot"
                      checked={draftSnapshot}
                      onCheckedChange={(v) => setDraftSnapshot(Boolean(v))}
                    />
                    <Label htmlFor="snapshot" className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-ts-orange" />
                      Eligible for Community Snapshot
                    </Label>
                  </div>
                  <Button
                    type="button"
                    className="mt-4"
                    onClick={handleCreateTradeDeal}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Creating..." : "Create TradeDeal"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="list">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Filter className="w-3 h-3" />
                  <span>Status:</span>
                  {(["active", "draft", "paused", "ended"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`px-2 py-0.5 rounded-full border text-[11px] ${
                        statusFilter === s
                          ? "border-ts-orange/30 text-ts-orange"
                          : "border-white/10 text-white/60"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="text-sm text-white/60">Loading promotions...</div>
              ) : !promotions || promotions.length === 0 ? (
                <div className="text-sm text-white/60">No promotions found for this filter.</div>
              ) : (
                <div className="space-y-3">
                  {promotions.map((promo) => (
                    <Card
                      key={promo.id}
                      className="bg-black/30 border-white/10 flex items-start justify-between gap-3 p-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{promo.title}</span>
                          <Badge variant="outline" className="border-ts-orange/30 text-ts-orange">
                            {promo.type}
                          </Badge>
                          {promo.placementCommunitySnapshot && (
                            <Badge className="bg-emerald-600/30 text-emerald-300 border-emerald-500/60 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Snapshot
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-white/70 max-w-xl">{promo.shortDescription}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="outline" className="border-white/15 text-white/70">
                            Status: {promo.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-white/15 text-white/70 flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" />{" "}
                            {promo.countyFips.join(", ") || "No counties"}
                          </Badge>
                          {promo.ctaUrl && (
                            <Badge
                              variant="outline"
                              className="border-white/15 text-white/70 flex items-center gap-1"
                            >
                              <Link2 className="w-3 h-3" /> CTA
                            </Badge>
                          )}
                          {promo.imageAttachmentId && (
                            <Badge
                              variant="outline"
                              className="border-white/15 text-white/70 flex items-center gap-1"
                            >
                              <ImageIcon className="w-3 h-3" /> Image
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-xs">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateMutation.mutate({
                              id: promo.id,
                              data: { status: promo.status === "active" ? "paused" : "active" },
                            })
                          }
                        >
                          {promo.status === "active" ? "Pause" : "Activate"}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
