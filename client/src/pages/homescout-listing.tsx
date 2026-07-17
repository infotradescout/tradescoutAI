import React, { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  BedDouble,
  Bath,
  Square,
  Home,
  ShieldAlert,
  MessageCircle,
  Share2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { uploadObject } from "@/lib/objectUpload";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  createHomeScoutInspectionRequestDecisionAuthority,
  createHomeScoutInspectionServiceDecisionAuthority,
} from "@/lib/homeScoutAuthority";
import { formatCountyLabel } from "@/utils/countyFipsToName";
import { share } from "@/utils/share";

type HomeScoutListing = {
  id: string;
  status: string;
  title: string;
  description?: string | null;
  price: string | number;
  propertyType?: string | null;
  beds?: number | null;
  baths?: string | number | null;
  sqft?: number | null;
  lotSqft?: number | null;
  yearBuilt?: number | null;
  features?: string[] | null;
  photos?: string[] | null;
  countyFips: string;
  stateCode: string;
  city?: string | null;
  listedAt?: string | null;
  createdAt?: string | null;
  listingAuthorType?: string | null;
  canonicalProfileUrl?: string | null;
};

type HomeScoutListingEvent = {
  id: string;
  eventType: string;
  observedAt: string;
  payload: any;
};

type HomeScoutMarketBucket = {
  countyFips: string;
  stateCode: string;
  propertyType: string;
  bedsBucket?: number | null;
  activeCount: number;
  medianPrice?: string | number | null;
  medianPricePerSqft?: string | number | null;
  medianDomDays?: number | null;
  priceDropCount7d?: number | null;
  computedAt?: string | null;
};

type CountyMetric = {
  countyFips: string;
  metricKey: string;
  metricValue: string | number;
  updatedAt?: string | null;
};

type HomeScoutInspectionReport = {
  id: string;
  reportType: string;
  status?: string | null;
  visibility?: string | null;
  inspectionDate?: string | null;
  inspectorName?: string | null;
  inspectorCompany?: string | null;
  summary?: string | null;
  highlights?: string[] | null;
  downloadPath: string;
  createdAt: string;
};

type HomeScoutInspectionRequest = {
  id: string;
  status: string;
  requestMessage: string;
  preferredWindow?: string | null;
  createdAt: string;
};

type ListingResponse = {
  listing: HomeScoutListing;
  events: HomeScoutListingEvent[];
  marketBucket: HomeScoutMarketBucket | null;
  countyMetrics: CountyMetric[];
  inspectorRecommendations?: Array<{
    category: string;
    displayName: string;
    company: string | null;
  }>;
  inspectionReports: HomeScoutInspectionReport[];
  myInspectionReports?: HomeScoutInspectionReport[];
  pendingInspectionReports?: HomeScoutInspectionReport[];
  openInspectionRequests: HomeScoutInspectionRequest[];
};

function formatCurrency(value: string | number) {
  const num = typeof value === "number" ? value : Number(String(value || 0));
  const safe = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(safe);
}

function safePhotos(input: unknown): string[] {
  if (Array.isArray(input))
    return input.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return [];
}

export default function HomeScoutListingPage() {
  const [match, params] = useRoute("/homescout/listings/:id");
  const listingId = params?.id ? String(params.id) : "";
  const [inspectionRequestMessage, setInspectionRequestMessage] = useState("");
  const [inspectionPreferredWindow, setInspectionPreferredWindow] = useState("");
  const [showInspectionInsights, setShowInspectionInsights] = useState(false);
  const [inspectionInsights, setInspectionInsights] = useState<any | null>(null);
  const [uploadReportType, setUploadReportType] = useState("buyer_independent");
  const [uploadSummary, setUploadSummary] = useState("");
  const [uploadInspectorName, setUploadInspectorName] = useState("");
  const [uploadInspectorCompany, setUploadInspectorCompany] = useState("");
  const [uploadInspectionDate, setUploadInspectionDate] = useState("");
  const [uploadHighlights, setUploadHighlights] = useState("");
  const [uploadSourceRequestId, setUploadSourceRequestId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [sharing, setSharing] = useState(false);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery<ListingResponse>({
    queryKey: ["/api/homescout/listings", listingId],
    queryFn: async () => {
      const res = await fetch(`/api/homescout/listings/${encodeURIComponent(listingId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.message || "Failed to load listing";
        throw new Error(message);
      }
      return res.json();
    },
    enabled: Boolean(match && listingId),
  });

  const listing = data?.listing ?? null;
  const events = Array.isArray(data?.events) ? data!.events : [];
  const marketBucket = data?.marketBucket ?? null;
  const countyMetrics = Array.isArray(data?.countyMetrics) ? data!.countyMetrics : [];
  const inspectionReports = Array.isArray(data?.inspectionReports) ? data!.inspectionReports : [];
  const inspectorRecommendations = Array.isArray((data as any)?.inspectorRecommendations)
    ? ((data as any).inspectorRecommendations as any[])
    : [];
  const myInspectionReports = Array.isArray((data as any)?.myInspectionReports)
    ? ((data as any).myInspectionReports as HomeScoutInspectionReport[])
    : [];
  const pendingInspectionReports = Array.isArray((data as any)?.pendingInspectionReports)
    ? ((data as any).pendingInspectionReports as HomeScoutInspectionReport[])
    : [];
  const openInspectionRequests = Array.isArray(data?.openInspectionRequests)
    ? data!.openInspectionRequests
    : [];

  const createInspectionRequest = useMutation({
    mutationFn: async () => {
      const requestMessage = inspectionRequestMessage.trim();
      if (requestMessage.length < 12 || requestMessage.length > 2000) {
        throw new Error("Describe the inspection need in 12-2000 characters");
      }
      const preferredWindow = inspectionPreferredWindow.trim();
      if (preferredWindow.length > 120) {
        throw new Error("Keep the preferred inspection window under 120 characters");
      }
      const authority = await createHomeScoutInspectionRequestDecisionAuthority({
        listingId,
        listingTitle: listing?.title,
      });
      const res = await fetch(
        `/api/homescout/listings/${encodeURIComponent(listingId)}/inspection-requests`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestMessage,
            preferredWindow: preferredWindow || undefined,
            ...authority,
          }),
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Failed to create inspection request");
      return body;
    },
    onSuccess: () => {
      setInspectionRequestMessage("");
      setInspectionPreferredWindow("");
      queryClient.invalidateQueries({ queryKey: ["/api/homescout/listings", listingId] });
      toast({
        title: "Inspection requested",
        description: "Your request is posted on this listing for inspection follow-through.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Request failed",
        description: formatUserFacingErrorMessage(err, "Could not create inspection request"),
        variant: "destructive",
      });
    },
  });

  const uploadInspectionReport = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("Attach an inspection report file first");
      const { publicUrl } = await uploadObject(uploadFile);

      const highlights = uploadHighlights
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 20);

      const res = await fetch(
        `/api/homescout/listings/${encodeURIComponent(listingId)}/inspection-reports`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportType: uploadReportType,
            reportUrl: publicUrl,
            inspectionDate: uploadInspectionDate || undefined,
            inspectorName: uploadInspectorName || undefined,
            inspectorCompany: uploadInspectorCompany || undefined,
            summary: uploadSummary || undefined,
            highlights,
            sourceRequestId: uploadSourceRequestId || undefined,
          }),
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Failed to upload inspection report");
      return body;
    },
    onSuccess: (body: any) => {
      setUploadSummary("");
      setUploadInspectorName("");
      setUploadInspectorCompany("");
      setUploadInspectionDate("");
      setUploadHighlights("");
      setUploadSourceRequestId("");
      setUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/homescout/listings", listingId] });

      const status = typeof body?.status === "string" ? body.status : "";
      toast({
        title: "Inspection report uploaded",
        description:
          status === "pending_review"
            ? "Thanks. This upload is pending review before it becomes public on the listing."
            : "The report is now visible on this listing.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Upload failed",
        description: formatUserFacingErrorMessage(err, "Could not upload inspection report"),
        variant: "destructive",
      });
    },
  });

  const publishInspectionReport = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(
        `/api/homescout/inspection-reports/${encodeURIComponent(reportId)}/publish`,
        { method: "POST", credentials: "include" }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Failed to publish report");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homescout/listings", listingId] });
      toast({ title: "Report published" });
    },
    onError: (err: any) => {
      toast({
        title: "Publish failed",
        description: formatUserFacingErrorMessage(err, "Could not publish report"),
        variant: "destructive",
      });
    },
  });

  const removeInspectionReport = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(
        `/api/homescout/inspection-reports/${encodeURIComponent(reportId)}/remove`,
        { method: "POST", credentials: "include" }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Failed to remove report");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homescout/listings", listingId] });
      toast({ title: "Report removed" });
    },
    onError: (err: any) => {
      toast({
        title: "Remove failed",
        description: formatUserFacingErrorMessage(err, "Could not remove report"),
        variant: "destructive",
      });
    },
  });

  const fetchInspectionInsights = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/homescout/listings/${encodeURIComponent(listingId)}/inspection-insights`,
        { credentials: "include", headers: { Accept: "application/json" } }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Failed to load insights");
      return body;
    },
    onSuccess: (body: any) => {
      setInspectionInsights(body?.insights || null);
    },
    onError: (err: any) => {
      toast({
        title: "Could not load takeaways",
        description: formatUserFacingErrorMessage(err, "Try again."),
        variant: "destructive",
      });
    },
  });

  const createServiceRequest = useMutation({
    mutationFn: async (params: {
      reportId: string;
      serviceCategory: string;
      serviceDescription: string;
    }) => {
      const allowedCategories = new Set([
        "roofing",
        "plumbing",
        "electrical",
        "hvac",
        "foundation",
        "structural",
        "pest",
        "mold",
        "general_repair",
        "follow_up_inspection",
      ]);
      if (!allowedCategories.has(params.serviceCategory)) {
        throw new Error("Choose a valid service category");
      }
      const serviceDescription = params.serviceDescription.trim();
      if (serviceDescription.length < 12 || serviceDescription.length > 4000) {
        throw new Error("Describe the work needed in 12-4000 characters");
      }
      const authority = await createHomeScoutInspectionServiceDecisionAuthority({
        reportId: params.reportId,
        listingTitle: listing?.title,
      });
      const res = await fetch(
        `/api/homescout/inspection-reports/${encodeURIComponent(params.reportId)}/service-requests`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceCategory: params.serviceCategory,
            serviceDescription,
            ...authority,
          }),
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Failed to request service");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Service request sent",
        description: "We opened a guided work request from this inspection report.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Service request failed",
        description: formatUserFacingErrorMessage(err, "Could not create service request"),
        variant: "destructive",
      });
    },
  });

  const primaryPhoto = useMemo(() => {
    const photos = safePhotos(listing?.photos);
    return photos.length > 0 ? photos[0] : null;
  }, [listing?.photos]);

  const priceEvents = useMemo(() => {
    return events
      .filter((e) => String(e.eventType) === "price_changed")
      .sort((a, b) => +new Date(b.observedAt) - +new Date(a.observedAt))
      .slice(0, 20);
  }, [events]);

  const statusEvents = useMemo(() => {
    return events
      .filter((e) => String(e.eventType) === "status_changed" || String(e.eventType) === "created")
      .sort((a, b) => +new Date(b.observedAt) - +new Date(a.observedAt))
      .slice(0, 20);
  }, [events]);

  const metricMap = useMemo(() => {
    const m = new Map<string, string | number>();
    for (const cm of countyMetrics) {
      if (cm?.metricKey) m.set(String(cm.metricKey), cm.metricValue);
    }
    return m;
  }, [countyMetrics]);

  if (!match) return null;
  if (isLoading) return <PageLoadingSpinner message="Loading HomeScout listing..." />;

  if (isError || !listing) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Card className="bg-black/30 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-ts-orange" />
              Listing unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/70">
            <p>{formatUserFacingErrorMessage(error, "This listing could not be loaded.")}</p>
            <div className="flex gap-2">
              <Link href="/homescout-listings">
                <Button variant="outline" size="sm">
                  Back to HomeScout
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusLabel = String(listing.status || "active").replace(/_/g, " ");
  const locationLabel = [listing.city, listing.stateCode].filter(Boolean).join(", ");

  const targetRole =
    String((listing as any)?.listingAuthorType || "owner") === "agent" ? "Agent" : "Owner";
  const targetName = targetRole === "Agent" ? "Listing agent" : "Listing owner";
  const canonicalProfileUrl =
    typeof (listing as any)?.canonicalProfileUrl === "string" &&
    String((listing as any).canonicalProfileUrl).trim().length > 0
      ? String((listing as any).canonicalProfileUrl).trim()
      : null;
  const contactProfileHref = canonicalProfileUrl || "/community";

  const handleShareListing = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await share({
        path: `/homescout/listings/${encodeURIComponent(listingId)}`,
        title: listing.title,
        text: `HomeScout listing: ${listing.title}${locationLabel ? ` in ${locationLabel}` : ""}.`,
        contextLabel: "Share link",
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 md:py-8 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 md:gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-ts-orange" />
            <h1 className="text-xl md:text-3xl font-bold text-white">{listing.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <MapPin className="h-4 w-4 text-white/60" />
            <span>{locationLabel || formatCountyLabel(listing.countyFips, listing.stateCode)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleShareListing()}
            disabled={sharing}
          >
            <Share2 className="h-4 w-4 mr-2" />
            {sharing ? "Sharing..." : "Share"}
          </Button>
          <Badge variant="outline" className="border-white/10 text-white/70">
            {statusLabel}
          </Badge>
          <div className="text-lg md:text-xl font-semibold text-white">
            {formatCurrency(listing.price)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card className="bg-black/30 border-white/10 overflow-hidden">
            {primaryPhoto ? (
              <img
                src={primaryPhoto}
                alt={listing.title}
                className="w-full h-56 sm:h-64 md:h-96 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-56 sm:h-64 md:h-96 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                <div className="text-white/60 text-sm">No photos yet</div>
              </div>
            )}
          </Card>

          {listing.description && (
            <Card className="bg-black/30 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">About this home</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-white/70 whitespace-pre-wrap">
                {listing.description}
              </CardContent>
            </Card>
          )}

          <Card className="bg-black/30 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Price history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-white/70">
              {priceEvents.length === 0 ? (
                <div className="text-xs text-white/60">No recorded price changes yet.</div>
              ) : (
                priceEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3">
                    <div className="text-white/70">
                      {formatCurrency((e.payload as any)?.from ?? 0)}
                      {" -> "}
                      <span className="font-semibold">
                        {formatCurrency((e.payload as any)?.to ?? 0)}
                      </span>
                    </div>
                    <div className="text-xs text-white/60 whitespace-nowrap">
                      {new Date(e.observedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-black/30 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">
                Inspections and repair follow-up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-white/70">
              <div className="text-xs text-white/60">
                Sellers can post current inspections. Buyers can request inspections, upload
                independent reports, and open repair/service requests from findings.
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/60">
                  Scout can summarize repeated findings across published reports.
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const next = !showInspectionInsights;
                    setShowInspectionInsights(next);
                    if (next && !inspectionInsights) {
                      fetchInspectionInsights.mutate();
                    }
                  }}
                  disabled={fetchInspectionInsights.isPending}
                >
                  {fetchInspectionInsights.isPending
                    ? "Loading..."
                    : showInspectionInsights
                      ? "Hide takeaways"
                      : "View takeaways"}
                </Button>
              </div>

              {showInspectionInsights && inspectionInsights ? (
                <div className="rounded-md border border-white/10 p-3 bg-black/30 space-y-2">
                  <div className="text-white font-semibold text-sm">Takeaways</div>
                  {Array.isArray(inspectionInsights?.buyerRecommendations) &&
                  inspectionInsights.buyerRecommendations.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-xs text-white/60">For buyers</div>
                      <ul className="list-disc pl-5 text-sm text-white/70 space-y-1">
                        {inspectionInsights.buyerRecommendations
                          .slice(0, 6)
                          .map((x: string, idx: number) => (
                            <li key={`b-${idx}`}>{x}</li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                  {Array.isArray(inspectionInsights?.sellerRecommendations) &&
                  inspectionInsights.sellerRecommendations.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-xs text-white/60">For sellers</div>
                      <ul className="list-disc pl-5 text-sm text-white/70 space-y-1">
                        {inspectionInsights.sellerRecommendations
                          .slice(0, 6)
                          .map((x: string, idx: number) => (
                            <li key={`s-${idx}`}>{x}</li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isAuthenticated ? (
                <div className="space-y-2">
                  <div className="text-white font-semibold text-sm">
                    Inspection requests visible to you ({openInspectionRequests.length})
                  </div>
                  {openInspectionRequests.length === 0 ? (
                    <div className="text-xs text-white/60">No open requests yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {openInspectionRequests.slice(0, 6).map((r) => (
                        <div
                          key={r.id}
                          className="rounded-md border border-white/10 p-3 bg-black/30"
                        >
                          <div className="text-white/70">{r.requestMessage}</div>
                          {r.preferredWindow ? (
                            <div className="text-xs text-white/60 mt-1">
                              Window: {r.preferredWindow}
                            </div>
                          ) : null}
                          <div className="text-xs text-white/60 mt-1">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {isAuthenticated ? (
                <>
                  <div className="space-y-2">
                    <div className="text-white font-semibold text-sm">
                      Pending inspection reports ({pendingInspectionReports.length})
                    </div>
                    {pendingInspectionReports.length === 0 ? (
                      <div className="text-xs text-white/60">No pending reports.</div>
                    ) : (
                      <div className="space-y-3">
                        {pendingInspectionReports.map((r) => (
                          <div
                            key={r.id}
                            className="rounded-md border border-white/10 p-3 bg-black/30 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-white font-medium">
                                {String(r.reportType || "other").replace(/_/g, " ")}{" "}
                                <span className="text-xs text-white/60">(pending review)</span>
                              </div>
                              <a
                                href={r.downloadPath}
                                rel="noreferrer"
                                className="text-ts-orange hover:text-ts-orange text-xs"
                              >
                                Download report
                              </a>
                            </div>
                            {r.summary ? (
                              <div className="text-sm text-white/70">{r.summary}</div>
                            ) : null}
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => publishInspectionReport.mutate(r.id)}
                                disabled={publishInspectionReport.isPending}
                              >
                                Publish
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeInspectionReport.mutate(r.id)}
                                disabled={removeInspectionReport.isPending}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-white font-semibold text-sm">
                      Your uploads ({myInspectionReports.length})
                    </div>
                    {myInspectionReports.length === 0 ? (
                      <div className="text-xs text-white/60">No uploads yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {myInspectionReports
                          .filter((r) => (r.status || "published") !== "published")
                          .slice(0, 6)
                          .map((r) => (
                            <div
                              key={r.id}
                              className="rounded-md border border-white/10 p-3 bg-black/30"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-white font-medium">
                                  {String(r.reportType || "other").replace(/_/g, " ")}
                                  {r.status ? (
                                    <span className="text-xs text-white/60">
                                      {" "}
                                      ({String(r.status).replace(/_/g, " ")})
                                    </span>
                                  ) : null}
                                </div>
                                <a
                                  href={r.downloadPath}
                                  rel="noreferrer"
                                  className="text-ts-orange hover:text-ts-orange text-xs"
                                >
                                  Download
                                </a>
                              </div>
                              {r.summary ? (
                                <div className="text-xs text-white/60 mt-1">{r.summary}</div>
                              ) : null}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              <div className="space-y-2">
                <div className="text-white font-semibold text-sm">
                  Published inspection reports ({inspectionReports.length})
                </div>
                {inspectionReports.length === 0 ? (
                  <div className="text-xs text-white/60">No reports uploaded yet.</div>
                ) : (
                  <div className="space-y-3">
                    {inspectionReports.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-md border border-white/10 p-3 bg-black/30 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-white font-medium">
                            {String(r.reportType || "other").replace(/_/g, " ")}
                          </div>
                          <a
                            href={r.downloadPath}
                            rel="noreferrer"
                            className="text-ts-orange hover:text-ts-orange text-xs"
                          >
                            Download report
                          </a>
                        </div>
                        {r.inspectionDate ? (
                          <div className="text-xs text-white/60">
                            Inspection date: {new Date(r.inspectionDate).toLocaleDateString()}
                          </div>
                        ) : null}
                        {(r.inspectorName || r.inspectorCompany) && (
                          <div className="text-xs text-white/60">
                            Inspector:{" "}
                            {[r.inspectorName, r.inspectorCompany].filter(Boolean).join(" - ")}
                          </div>
                        )}
                        {r.summary ? (
                          <div className="text-sm text-white/70">{r.summary}</div>
                        ) : null}
                        {Array.isArray(r.highlights) && r.highlights.length > 0 ? (
                          <div className="text-xs text-white/60">
                            Highlights: {r.highlights.slice(0, 5).join("; ")}
                          </div>
                        ) : null}
                        {isAuthenticated ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const serviceCategory =
                                window.prompt(
                                  "Service category (roofing, plumbing, electrical, hvac, foundation, structural, pest, mold, general_repair, follow_up_inspection):",
                                  "general_repair"
                                ) || "";
                              const serviceDescription =
                                window.prompt(
                                  "Describe the work needed from this report:",
                                  "Need licensed pro to quote and fix highlighted items."
                                ) || "";
                              if (!serviceCategory.trim() || !serviceDescription.trim()) return;
                              createServiceRequest.mutate({
                                reportId: r.id,
                                serviceCategory: serviceCategory.trim(),
                                serviceDescription: serviceDescription.trim(),
                              });
                            }}
                          >
                            Request service from this report
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isAuthenticated ? (
                <div className="space-y-2">
                  <div className="text-white font-semibold text-sm">Find a local inspector</div>
                  <div className="text-xs text-white/60">
                    Scout can recommend inspectors in this county and help route you through the
                    intent and decision flow.
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/scout?source=homescout_listing&listingId=${encodeURIComponent(
                        listingId
                      )}&countyFips=${encodeURIComponent(
                        String(listing?.countyFips || "")
                      )}&stateCode=${encodeURIComponent(
                        String(listing?.stateCode || "")
                      )}&prompt=${encodeURIComponent(
                        `I need a home inspection for this listing (${listingId}) in ${String(
                          listing?.city || ""
                        ).trim()} ${String(listing?.stateCode || "").trim()} (${String(
                          listing?.countyFips || ""
                        ).trim()}). Please recommend a few local inspectors and help me take the next step.`
                      )}`}
                    >
                      <Button size="sm" variant="outline">
                        Start Inspector Request
                      </Button>
                    </Link>
                  </div>

                  {inspectorRecommendations.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {inspectorRecommendations.slice(0, 3).map((p: any) => (
                        <div
                          key={`${String(p?.category || "inspector")}:${String(
                            p?.displayName || "Inspector"
                          )}:${String(p?.company || "")}`}
                          className="rounded-md border border-white/10 p-3 bg-black/30 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm text-white font-medium truncate">
                              {String(p?.displayName || "Inspector")}
                            </div>
                            <div className="text-xs text-white/60 truncate">
                              {p?.company ? String(p.company) : "Local inspector"}
                            </div>
                          </div>
                          <Link
                            href={`/scout?source=homescout_listing&listingId=${encodeURIComponent(
                              listingId
                            )}&prompt=${encodeURIComponent(
                              `I’m reviewing this listing (${listingId}). You suggested inspector: ${String(
                                p?.displayName || ""
                              ).trim()}${p?.company ? ` (${String(p.company).trim()})` : ""}. Help me evaluate and choose the right inspector and take the next step.`
                            )}`}
                          >
                            <Button
                              size="sm"
                              className="bg-ts-orange hover:bg-ts-orange-dark text-black font-semibold"
                            >
                              Review Next Step
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isAuthenticated ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/10">
                  <div className="space-y-2">
                    <div className="text-white font-semibold text-sm">Request inspection</div>
                    <textarea
                      value={inspectionRequestMessage}
                      onChange={(e) => setInspectionRequestMessage(e.target.value)}
                      placeholder="Request an inspection for this property..."
                      className="w-full min-h-[92px] rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={inspectionPreferredWindow}
                      onChange={(e) => setInspectionPreferredWindow(e.target.value)}
                      placeholder="Preferred window (optional)"
                      className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <Button
                      size="sm"
                      onClick={() => createInspectionRequest.mutate()}
                      disabled={createInspectionRequest.isPending}
                    >
                      {createInspectionRequest.isPending ? "Submitting..." : "Request inspection"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-white font-semibold text-sm">Upload inspection report</div>
                    <select
                      value={uploadReportType}
                      onChange={(e) => setUploadReportType(e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    >
                      <option value="buyer_independent">Buyer independent</option>
                      <option value="seller_pre_listing">Seller pre-listing</option>
                      <option value="municipal">Municipal</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="date"
                      value={uploadInspectionDate}
                      onChange={(e) => setUploadInspectionDate(e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={uploadInspectorName}
                      onChange={(e) => setUploadInspectorName(e.target.value)}
                      placeholder="Inspector name (optional)"
                      className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={uploadInspectorCompany}
                      onChange={(e) => setUploadInspectorCompany(e.target.value)}
                      placeholder="Inspector company (optional)"
                      className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <textarea
                      value={uploadSummary}
                      onChange={(e) => setUploadSummary(e.target.value)}
                      placeholder="Summary of findings (optional)"
                      className="w-full min-h-[72px] rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <textarea
                      value={uploadHighlights}
                      onChange={(e) => setUploadHighlights(e.target.value)}
                      placeholder="Highlights, one per line (optional)"
                      className="w-full min-h-[72px] rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={uploadSourceRequestId}
                      onChange={(e) => setUploadSourceRequestId(e.target.value)}
                      placeholder="Source request id (optional, if you requested an inspection here)"
                      className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70"
                    />
                    <Button
                      size="sm"
                      onClick={() => uploadInspectionReport.mutate()}
                      disabled={uploadInspectionReport.isPending || !uploadFile}
                    >
                      {uploadInspectionReport.isPending ? "Uploading..." : "Upload report"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-white/60">
                  Sign in to request inspections, upload reports, and request repair services.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-black/30 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">
                {String((listing as any)?.listingAuthorType || "owner") === "agent"
                  ? "Listed by agent"
                  : "Listed by owner"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-white/70">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{String(targetName)}</div>
                  <div className="text-xs text-white/60 truncate">{String(targetRole)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/30 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white flex items-center justify-between gap-3">
                <span>Facts</span>
                <span className="text-xs text-white/60">
                  {String((listing as any)?.listingAuthorType || "owner") === "agent"
                    ? "Posted by agent"
                    : "Posted by owner"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Type</span>
                <span className="font-medium text-white">{listing.propertyType || "Home"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-2 text-white/70">
                    <BedDouble className="h-4 w-4 text-white/60" />
                    <span className="font-semibold">{listing.beds ?? "?"}</span>
                  </div>
                  <div className="text-[11px] text-white/60 mt-1">Beds</div>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-2 text-white/70">
                    <Bath className="h-4 w-4 text-white/60" />
                    <span className="font-semibold">{listing.baths ?? "?"}</span>
                  </div>
                  <div className="text-[11px] text-white/60 mt-1">Baths</div>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-2 text-white/70">
                    <Square className="h-4 w-4 text-white/60" />
                    <span className="font-semibold">{listing.sqft ?? "?"}</span>
                  </div>
                  <div className="text-[11px] text-white/60 mt-1">Sqft</div>
                </div>
              </div>
              {listing.yearBuilt != null && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60">Year built</span>
                  <span className="font-medium text-white">{listing.yearBuilt}</span>
                </div>
              )}
              {listing.lotSqft != null && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-white/60">Lot</span>
                  <span className="font-medium text-white">{listing.lotSqft} sqft</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-black/30 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">County context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Active listings</span>
                <span className="font-medium text-white">
                  {String(metricMap.get("homescout_active_listings") ?? "—")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Median price</span>
                <span className="font-medium text-white">
                  {metricMap.has("homescout_median_price")
                    ? formatCurrency(metricMap.get("homescout_median_price") as any)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Median DOM</span>
                <span className="font-medium text-white">
                  {String(metricMap.get("homescout_median_dom_days") ?? "—")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Price drops (7d)</span>
                <span className="font-medium text-white">
                  {String(metricMap.get("homescout_price_drops_7d") ?? "—")}
                </span>
              </div>

              {marketBucket ? (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-xs text-white/60">Similar homes snapshot</div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Count</span>
                    <span className="font-medium text-white">{marketBucket.activeCount ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Median price</span>
                    <span className="font-medium text-white">
                      {marketBucket.medianPrice != null
                        ? formatCurrency(marketBucket.medianPrice as any)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Median $/sqft</span>
                    <span className="font-medium text-white">
                      {marketBucket.medianPricePerSqft != null
                        ? `$${Math.round(Number(marketBucket.medianPricePerSqft))}`
                        : "—"}
                    </span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-black/30 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Status timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-white/70">
              {statusEvents.length === 0 ? (
                <div className="text-xs text-white/60">No recorded status timeline yet.</div>
              ) : (
                statusEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3">
                    <div className="text-white/70">
                      {String((e.payload as any)?.from ?? "").trim()
                        ? `${String((e.payload as any)?.from).replace(/_/g, " ")} → ${String(
                            (e.payload as any)?.to ?? ""
                          ).replace(/_/g, " ")}`
                        : String((e.payload as any)?.status ?? listing.status).replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-white/60 whitespace-nowrap">
                      {new Date(e.observedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-black/30 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/70">
              <div className="space-y-1">
                <div className="text-white font-semibold">{targetName}</div>
                <div className="text-xs text-white/60">{String(targetRole).replace(/_/g, " ")}</div>
                <div className="text-xs text-white/60">
                  HomeScout never exposes direct contact from listing discovery.
                </div>
              </div>
              {canonicalProfileUrl ? (
                <Link href={contactProfileHref}>
                  <Button variant="outline" className="w-full">
                    View public profile
                  </Button>
                </Link>
              ) : null}
              <Link
                href={`/scout?intent=homescout_contact&listingId=${encodeURIComponent(String(listing.id))}`}
              >
                <Button className="w-full bg-ts-orange hover:bg-ts-orange-dark text-black font-semibold">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Request contact via Scout
                </Button>
              </Link>
              <Link href="/homescout-listings">
                <Button variant="outline" className="w-full">
                  Back to HomeScout
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
