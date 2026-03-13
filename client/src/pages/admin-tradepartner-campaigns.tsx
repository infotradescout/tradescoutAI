import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type CampaignCounty = {
  countySlug: string;
  countyName: string;
  stateCode: string;
  localFocus: string;
  neighborhoods: string[];
  sortOrder: number;
};

type CampaignMeeting = {
  meetingId: string;
  countySlug: string;
  countyLabel: string;
  meetingDate: string;
  dateLabel: string;
  teaser: string;
  eventLabel?: string;
  sortOrder?: number;
};

type CampaignResponse = {
  partnerSlug: string;
  partnerName: string;
  campaignTitle: string;
  heroKicker: string;
  heroHeadline: string;
  heroSubhead: string;
  dealAmountUsd: number;
  dealTerms: string;
  coverageScope: string;
  focusNote: string;
  ctaLabel: string;
  ctaUrl?: string;
  seoKeywords?: string;
  benefits: string[];
  counties: CampaignCounty[];
  meetings: CampaignMeeting[];
  isActive: boolean;
};

type CountyObservationSnapshot = {
  status: "ok" | "suppressed";
  reason?: "minimum_threshold_not_met";
  partnerSlug?: string;
  window?: "1h" | "24h" | "7d" | "30d";
  generatedAt?: string;
  counties?: Array<{
    countyFips: string;
    countyName: string;
    stateCode: string;
    requestCount: number;
    okRatePct: number;
    trend: "up" | "down" | "flat";
    changePct: number;
    dominantSurface: string;
    surfaceMix: Array<{
      surface: string;
      requestCount: number;
      sharePct: number;
    }>;
  }>;
};

const DEFAULT_PARTNER = "cumulus-media";

function countiesToText(counties: CampaignCounty[]): string {
  return counties
    .map((county) =>
      [
        county.countySlug,
        county.countyName,
        county.stateCode,
        county.localFocus || "",
        (county.neighborhoods || []).join(";"),
        String(county.sortOrder || 0),
      ].join("|")
    )
    .join("\n");
}

function meetingsToText(meetings: CampaignMeeting[]): string {
  return meetings
    .map((meeting) =>
      [
        meeting.meetingId,
        meeting.countySlug,
        meeting.countyLabel,
        meeting.meetingDate,
        meeting.dateLabel,
        meeting.teaser || "",
        meeting.eventLabel || "",
        String(meeting.sortOrder || 0),
      ].join("|")
    )
    .join("\n");
}

function parseCounties(text: string): CampaignCounty[] {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [
        countySlug,
        countyName,
        stateCode,
        localFocus = "",
        neighborhoods = "",
        sortOrder = "",
      ] = line.split("|").map((part) => part.trim());
      return {
        countySlug,
        countyName,
        stateCode,
        localFocus,
        neighborhoods: neighborhoods
          .split(";")
          .map((city) => city.trim())
          .filter(Boolean),
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : index * 10,
      };
    })
    .filter((county) => county.countySlug && county.countyName && county.stateCode);
}

function parseMeetings(text: string): CampaignMeeting[] {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [
        meetingId,
        countySlug,
        countyLabel,
        meetingDate,
        dateLabel,
        teaser = "",
        eventLabel = "",
        sortOrder = "",
      ] = line.split("|").map((part) => part.trim());

      return {
        meetingId,
        countySlug,
        countyLabel,
        meetingDate,
        dateLabel,
        teaser,
        eventLabel,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : index * 10,
      };
    })
    .filter((meeting) => {
      return (
        meeting.meetingId &&
        meeting.countySlug &&
        meeting.countyLabel &&
        /^\d{4}-\d{2}-\d{2}$/.test(meeting.meetingDate) &&
        meeting.dateLabel
      );
    });
}

export default function AdminTradePartnerCampaignsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [partnerSlug, setPartnerSlug] = useState(DEFAULT_PARTNER);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [heroHeadline, setHeroHeadline] = useState("");
  const [heroSubhead, setHeroSubhead] = useState("");
  const [dealAmountUsd, setDealAmountUsd] = useState("2000");
  const [dealTerms, setDealTerms] = useState("");
  const [coverageScope, setCoverageScope] = useState("national");
  const [focusNote, setFocusNote] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Choose meeting date");
  const [ctaUrl, setCtaUrl] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [benefitsText, setBenefitsText] = useState("");
  const [countiesText, setCountiesText] = useState("");
  const [meetingsText, setMeetingsText] = useState("");
  const [isActive, setIsActive] = useState(true);

  const queryKey = useMemo(() => ["/api/admin/tradepartner-campaigns", partnerSlug], [partnerSlug]);

  const { data, isLoading } = useQuery<CampaignResponse>({
    queryKey,
    queryFn: async () =>
      apiRequest("GET", `/api/admin/tradepartner-campaigns/${encodeURIComponent(partnerSlug)}`),
  });

  const { data: observationData } = useQuery<CountyObservationSnapshot>({
    queryKey: ["/api/market-signals/v1/partners/county-observation", partnerSlug],
    queryFn: async () =>
      apiRequest(
        "GET",
        `/api/market-signals/v1/partners/${encodeURIComponent(partnerSlug)}/county-observation?window=24h&limit=12`
      ),
    enabled: partnerSlug.trim().length > 0,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!data) return;
    setCampaignTitle(data.campaignTitle || "");
    setPartnerName(data.partnerName || "");
    setHeroHeadline(data.heroHeadline || "");
    setHeroSubhead(data.heroSubhead || "");
    setDealAmountUsd(String(data.dealAmountUsd || 0));
    setDealTerms(data.dealTerms || "");
    setCoverageScope(data.coverageScope || "national");
    setFocusNote(data.focusNote || "");
    setCtaLabel(data.ctaLabel || "Choose meeting date");
    setCtaUrl(data.ctaUrl || "");
    setSeoKeywords(data.seoKeywords || "");
    setBenefitsText((data.benefits || []).join("\n"));
    setCountiesText(countiesToText(data.counties || []));
    setMeetingsText(meetingsToText(data.meetings || []));
    setIsActive(data.isActive === true);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(
        "PUT",
        `/api/admin/tradepartner-campaigns/${encodeURIComponent(partnerSlug)}`,
        {
          partnerName,
          campaignTitle,
          heroHeadline,
          heroSubhead,
          dealAmountUsd: Number(dealAmountUsd || 0),
          dealTerms,
          coverageScope,
          focusNote,
          ctaLabel,
          ctaUrl,
          seoKeywords,
          isActive,
          benefits: benefitsText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          counties: parseCounties(countiesText),
          meetings: parseMeetings(meetingsText),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/tradepartner-campaigns", partnerSlug] });
      toast({ title: "Saved", description: "Campaign updated." });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: formatUserFacingErrorMessage(error, "Could not save campaign."),
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="bg-tsCard/95 border-white/10">
      <CardHeader>
        <CardTitle className="text-white">TradePartner Campaigns</CardTitle>
        <CardDescription className="text-white/70">
          Partner-level campaign config with global coverage and focused county launch controls.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Partner slug</Label>
            <Input value={partnerSlug} onChange={(e) => setPartnerSlug(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Coverage scope</Label>
            <Select value={coverageScope} onValueChange={setCoverageScope}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="national">National</SelectItem>
                <SelectItem value="regional">Regional</SelectItem>
                <SelectItem value="focused">Focused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Partner name</Label>
            <Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Campaign title</Label>
            <Input value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Hero headline</Label>
          <Input value={heroHeadline} onChange={(e) => setHeroHeadline(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Hero subhead</Label>
          <Textarea value={heroSubhead} onChange={(e) => setHeroSubhead(e.target.value)} rows={3} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Deal amount (USD)</Label>
            <Input value={dealAmountUsd} onChange={(e) => setDealAmountUsd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>CTA label</Label>
            <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Deal terms</Label>
          <Textarea value={dealTerms} onChange={(e) => setDealTerms(e.target.value)} rows={2} />
        </div>
        <div className="space-y-1">
          <Label>Focus note</Label>
          <Textarea value={focusNote} onChange={(e) => setFocusNote(e.target.value)} rows={2} />
        </div>
        <div className="space-y-1">
          <Label>CTA URL</Label>
          <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>SEO keywords</Label>
          <Textarea value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} rows={2} />
        </div>

        <div className="space-y-1">
          <Label>Benefits (one per line)</Label>
          <Textarea
            value={benefitsText}
            onChange={(e) => setBenefitsText(e.target.value)}
            rows={6}
          />
        </div>

        <div className="space-y-2">
          <Label>Live county observation</Label>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/80">
                County-ranked crawler attention and dominant surfaces for this partner.
              </div>
              <div className="text-xs text-white/50">
                {observationData?.generatedAt
                  ? `Updated ${new Date(observationData.generatedAt).toLocaleTimeString()}`
                  : "Waiting for signal"}
              </div>
            </div>

            {observationData?.status === "suppressed" ? (
              <div className="mt-3 text-sm text-white/60">
                Live county observation is below minimum threshold right now.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {(observationData?.counties || []).map((county) => (
                  <div
                    key={`${county.countyFips}:${county.dominantSurface}`}
                    className="rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {county.countyName}, {county.stateCode}
                        </div>
                        <div className="text-xs text-white/55">
                          FIPS {county.countyFips} | dominant surface {county.dominantSurface}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">
                          {county.requestCount}
                        </div>
                        <div className="text-xs text-white/55">
                          {county.okRatePct}% ok | {county.trend} {county.changePct}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {county.surfaceMix.map((surface) => (
                        <span
                          key={`${county.countyFips}:${surface.surface}`}
                          className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/75"
                        >
                          {surface.surface} {surface.sharePct}%
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Focus counties</Label>
          <p className="text-xs text-white/60">
            Format: <code>countySlug|countyName|stateCode|localFocus|City1;City2|sortOrder</code>
          </p>
          <Textarea
            value={countiesText}
            onChange={(e) => setCountiesText(e.target.value)}
            rows={6}
          />
        </div>

        <div className="space-y-1">
          <Label>Meetings</Label>
          <p className="text-xs text-white/60">
            Format:{" "}
            <code>
              meetingId|countySlug|countyLabel|YYYY-MM-DD|dateLabel|teaser|eventLabel|sortOrder
            </code>
          </p>
          <Textarea
            value={meetingsText}
            onChange={(e) => setMeetingsText(e.target.value)}
            rows={6}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>Campaign active</Label>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading}
        >
          {saveMutation.isPending ? "Saving..." : "Save campaign"}
        </Button>
      </CardContent>
    </Card>
  );
}
