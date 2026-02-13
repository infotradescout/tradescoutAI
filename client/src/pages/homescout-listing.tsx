import React, { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, BedDouble, Bath, Square, Home, ShieldAlert, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { uploadObject } from "@/lib/objectUpload";
import {
  ContactOutcomeModal,
  type ContactOutcome,
} from "@/components/community/ContactOutcomeModal";

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
  zipCode?: string | null;
  address1?: string | null;
  address2?: string | null;
  addressVisibility?: "exact" | "approximate" | string | null;
  listedAt?: string | null;
  createdAt?: string | null;
  contactUserId?: string | null;
  sellerUserId?: string | null;
  agentUserId?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
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
  inspectionDate?: string | null;
  inspectorName?: string | null;
  inspectorCompany?: string | null;
  summary?: string | null;
  highlights?: string[] | null;
  reportUrl: string;
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
  contactUserId: string | null;
  events: HomeScoutListingEvent[];
  marketBucket: HomeScoutMarketBucket | null;
  countyMetrics: CountyMetric[];
  inspectionReports: HomeScoutInspectionReport[];
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
  const [contactOutcome, setContactOutcome] = useState<ContactOutcome | null>(null);
  const [inspectionRequestMessage, setInspectionRequestMessage] = useState("");
  const [inspectionPreferredWindow, setInspectionPreferredWindow] = useState("");
  const [uploadReportType, setUploadReportType] = useState("buyer_independent");
  const [uploadSummary, setUploadSummary] = useState("");
  const [uploadInspectorName, setUploadInspectorName] = useState("");
  const [uploadInspectorCompany, setUploadInspectorCompany] = useState("");
  const [uploadInspectionDate, setUploadInspectionDate] = useState("");
  const [uploadHighlights, setUploadHighlights] = useState("");
  const [uploadSourceRequestId, setUploadSourceRequestId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { user, isAuthenticated } = useAuth();
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
  const contactUserId = data?.contactUserId ?? null;
  const events = Array.isArray(data?.events) ? data!.events : [];
  const marketBucket = data?.marketBucket ?? null;
  const countyMetrics = Array.isArray(data?.countyMetrics) ? data!.countyMetrics : [];
  const inspectionReports = Array.isArray(data?.inspectionReports) ? data!.inspectionReports : [];
  const openInspectionRequests = Array.isArray(data?.openInspectionRequests)
    ? data!.openInspectionRequests
    : [];

  const createInspectionRequest = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/homescout/listings/${encodeURIComponent(listingId)}/inspection-requests`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestMessage: inspectionRequestMessage,
            preferredWindow: inspectionPreferredWindow || undefined,
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
        description: err?.message || "Could not create inspection request",
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
    onSuccess: () => {
      setUploadSummary("");
      setUploadInspectorName("");
      setUploadInspectorCompany("");
      setUploadInspectionDate("");
      setUploadHighlights("");
      setUploadSourceRequestId("");
      setUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/homescout/listings", listingId] });
      toast({
        title: "Inspection report uploaded",
        description: "The report is now visible on this listing.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Upload failed",
        description: err?.message || "Could not upload inspection report",
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
      const res = await fetch(
        `/api/homescout/inspection-reports/${encodeURIComponent(params.reportId)}/service-requests`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
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
        description: err?.message || "Could not create service request",
        variant: "destructive",
      });
    },
  });

  const { data: contactPublicProfile } = useQuery<any>({
    queryKey: ["/api/users/public", contactUserId],
    queryFn: async () => {
      if (!contactUserId) return null;
      const res = await fetch(`/api/users/${encodeURIComponent(contactUserId)}/public`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(contactUserId),
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
        <Card className="bg-slate-950/70 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-400" />
              Listing unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>{error instanceof Error ? error.message : "This listing could not be loaded."}</p>
            <div className="flex gap-2">
              <Link href="/real-estate-marketplace">
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
  const coordsLabel = (() => {
    const lat = listing.latitude != null ? Number(listing.latitude) : NaN;
    const lng = listing.longitude != null ? Number(listing.longitude) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  })();

  const canContact = Boolean(contactUserId);
  const targetName =
    (contactPublicProfile as any)?.displayName ||
    (contactPublicProfile as any)?.name ||
    (contactPublicProfile as any)?.fullName ||
    "Listing contact";
  const targetRole =
    (contactPublicProfile as any)?.role ||
    (contactPublicProfile as any)?.userRole ||
    "Seller/Agent";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-orange-500" />
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">{listing.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span>{locationLabel || `${listing.countyFips}, ${listing.stateCode}`}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-slate-700 text-slate-200">
            {statusLabel}
          </Badge>
          <div className="text-xl font-semibold text-slate-100">
            {formatCurrency(listing.price)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card className="bg-slate-950/60 border-slate-800 overflow-hidden">
            {primaryPhoto ? (
              <img
                src={primaryPhoto}
                alt={listing.title}
                className="w-full h-72 md:h-96 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-72 md:h-96 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                <div className="text-slate-400 text-sm">No photos yet</div>
              </div>
            )}
          </Card>

          {listing.description && (
            <Card className="bg-slate-950/60 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-100">About this home</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-300 whitespace-pre-wrap">
                {listing.description}
              </CardContent>
            </Card>
          )}

          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">Price history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              {priceEvents.length === 0 ? (
                <div className="text-xs text-slate-400">No recorded price changes yet.</div>
              ) : (
                priceEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3">
                    <div className="text-slate-200">
                      {formatCurrency((e.payload as any)?.from ?? 0)} →{" "}
                      <span className="font-semibold">
                        {formatCurrency((e.payload as any)?.to ?? 0)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(e.observedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">
                Inspections and repair follow-up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              <div className="text-xs text-slate-400">
                Sellers can post current inspections. Buyers can request inspections, upload
                independent reports, and open repair/service requests from findings.
              </div>

              <div className="space-y-2">
                <div className="text-slate-100 font-semibold text-sm">
                  Open inspection requests ({openInspectionRequests.length})
                </div>
                {openInspectionRequests.length === 0 ? (
                  <div className="text-xs text-slate-500">No open requests yet.</div>
                ) : (
                  <div className="space-y-2">
                    {openInspectionRequests.slice(0, 6).map((r) => (
                      <div
                        key={r.id}
                        className="rounded-md border border-slate-800 p-3 bg-slate-950/40"
                      >
                        <div className="text-slate-200">{r.requestMessage}</div>
                        {r.preferredWindow ? (
                          <div className="text-xs text-slate-400 mt-1">
                            Window: {r.preferredWindow}
                          </div>
                        ) : null}
                        <div className="text-xs text-slate-500 mt-1">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-slate-100 font-semibold text-sm">
                  Published inspection reports ({inspectionReports.length})
                </div>
                {inspectionReports.length === 0 ? (
                  <div className="text-xs text-slate-500">No reports uploaded yet.</div>
                ) : (
                  <div className="space-y-3">
                    {inspectionReports.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-md border border-slate-800 p-3 bg-slate-950/40 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-slate-100 font-medium">
                            {String(r.reportType || "other").replace(/_/g, " ")}
                          </div>
                          <a
                            href={r.reportUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-orange-300 hover:text-orange-200 text-xs"
                          >
                            Open report
                          </a>
                        </div>
                        {r.inspectionDate ? (
                          <div className="text-xs text-slate-400">
                            Inspection date: {new Date(r.inspectionDate).toLocaleDateString()}
                          </div>
                        ) : null}
                        {(r.inspectorName || r.inspectorCompany) && (
                          <div className="text-xs text-slate-400">
                            Inspector:{" "}
                            {[r.inspectorName, r.inspectorCompany].filter(Boolean).join(" - ")}
                          </div>
                        )}
                        {r.summary ? (
                          <div className="text-sm text-slate-300">{r.summary}</div>
                        ) : null}
                        {Array.isArray(r.highlights) && r.highlights.length > 0 ? (
                          <div className="text-xs text-slate-400">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div className="space-y-2">
                    <div className="text-slate-100 font-semibold text-sm">Request inspection</div>
                    <textarea
                      value={inspectionRequestMessage}
                      onChange={(e) => setInspectionRequestMessage(e.target.value)}
                      placeholder="Request an inspection for this property..."
                      className="w-full min-h-[92px] rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
                    />
                    <input
                      value={inspectionPreferredWindow}
                      onChange={(e) => setInspectionPreferredWindow(e.target.value)}
                      placeholder="Preferred window (optional)"
                      className="w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
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
                    <div className="text-slate-100 font-semibold text-sm">
                      Upload inspection report
                    </div>
                    <select
                      value={uploadReportType}
                      onChange={(e) => setUploadReportType(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
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
                      className="w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
                    />
                    <input
                      value={uploadInspectorName}
                      onChange={(e) => setUploadInspectorName(e.target.value)}
                      placeholder="Inspector name (optional)"
                      className="w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
                    />
                    <input
                      value={uploadInspectorCompany}
                      onChange={(e) => setUploadInspectorCompany(e.target.value)}
                      placeholder="Inspector company (optional)"
                      className="w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
                    />
                    <textarea
                      value={uploadSummary}
                      onChange={(e) => setUploadSummary(e.target.value)}
                      placeholder="Summary of findings (optional)"
                      className="w-full min-h-[72px] rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
                    />
                    <textarea
                      value={uploadHighlights}
                      onChange={(e) => setUploadHighlights(e.target.value)}
                      placeholder="Highlights, one per line (optional)"
                      className="w-full min-h-[72px] rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
                    />
                    <input
                      value={uploadSourceRequestId}
                      onChange={(e) => setUploadSourceRequestId(e.target.value)}
                      placeholder="Source request id (required for buyer independent)"
                      className="w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
                    />
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200"
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
                <div className="text-xs text-slate-400">
                  Sign in to request inspections, upload reports, and request repair services.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">Facts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Type</span>
                <span className="font-medium text-slate-100">{listing.propertyType || "Home"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center gap-2 text-slate-200">
                    <BedDouble className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold">{listing.beds ?? "?"}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Beds</div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Bath className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold">{listing.baths ?? "?"}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Baths</div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Square className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold">{listing.sqft ?? "?"}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Sqft</div>
                </div>
              </div>
              {listing.yearBuilt != null && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">Year built</span>
                  <span className="font-medium text-slate-100">{listing.yearBuilt}</span>
                </div>
              )}
              {listing.lotSqft != null && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">Lot</span>
                  <span className="font-medium text-slate-100">{listing.lotSqft} sqft</span>
                </div>
              )}
              {coordsLabel ? (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">Coords</span>
                  <span className="font-medium text-slate-100">{coordsLabel}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">County context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Active listings</span>
                <span className="font-medium text-slate-100">
                  {String(metricMap.get("homescout_active_listings") ?? "—")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Median price</span>
                <span className="font-medium text-slate-100">
                  {metricMap.has("homescout_median_price")
                    ? formatCurrency(metricMap.get("homescout_median_price") as any)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Median DOM</span>
                <span className="font-medium text-slate-100">
                  {String(metricMap.get("homescout_median_dom_days") ?? "—")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Price drops (7d)</span>
                <span className="font-medium text-slate-100">
                  {String(metricMap.get("homescout_price_drops_7d") ?? "—")}
                </span>
              </div>

              {marketBucket ? (
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400">Similar homes snapshot</div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Count</span>
                    <span className="font-medium text-slate-100">
                      {marketBucket.activeCount ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Median price</span>
                    <span className="font-medium text-slate-100">
                      {marketBucket.medianPrice != null
                        ? formatCurrency(marketBucket.medianPrice as any)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Median $/sqft</span>
                    <span className="font-medium text-slate-100">
                      {marketBucket.medianPricePerSqft != null
                        ? `$${Math.round(Number(marketBucket.medianPricePerSqft))}`
                        : "—"}
                    </span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">Status timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              {statusEvents.length === 0 ? (
                <div className="text-xs text-slate-400">No recorded status timeline yet.</div>
              ) : (
                statusEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3">
                    <div className="text-slate-200">
                      {String((e.payload as any)?.from ?? "").trim()
                        ? `${String((e.payload as any)?.from).replace(/_/g, " ")} → ${String(
                            (e.payload as any)?.to ?? ""
                          ).replace(/_/g, " ")}`
                        : String((e.payload as any)?.status ?? listing.status).replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(e.observedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="space-y-1">
                <div className="text-slate-100 font-semibold">{targetName}</div>
                <div className="text-xs text-slate-400">
                  {String(targetRole).replace(/_/g, " ")}
                </div>
                <div className="text-xs text-slate-500">
                  HomeScout never exposes direct contact without intent gating.
                </div>
              </div>
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                disabled={!canContact}
                onClick={() => {
                  if (!contactUserId) return;
                  setContactOutcome({
                    targetUserId: contactUserId,
                    targetUserName: targetName,
                    targetRole: String(targetRole),
                    targetLocation: locationLabel || undefined,
                    suggestedIntent: "advise",
                    reasonForContact: `Hi ${targetName} — I'm interested in this listing. Can we discuss next steps?`,
                    riskFlags: [],
                    decisionScope: `homescout_listing:${listing.id}`,
                    decisionTitle: `HomeScout: ${listing.title}`,
                  });
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Request contact
              </Button>
              <Link href="/real-estate-marketplace">
                <Button variant="outline" className="w-full">
                  Back to HomeScout
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {contactOutcome && (
        <ContactOutcomeModal outcome={contactOutcome} onClose={() => setContactOutcome(null)} />
      )}
    </div>
  );
}
