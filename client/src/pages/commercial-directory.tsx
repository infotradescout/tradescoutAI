/* eslint-disable no-restricted-syntax */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Clock3,
  Building2,
  CalendarClock,
  FileCheck2,
  Gavel,
  Lock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";

type BoardProject = {
  project: {
    id: string;
    title: string;
    slug: string;
    summary: string;
    countyFips: string;
    stateCode: string;
    budgetMin?: string | null;
    budgetMax?: string | null;
    bidDueAt?: string | null;
  };
  bidsCount: number;
  docsCount: number;
};

type ProjectDetails = {
  project: {
    id: string;
    title: string;
    slug: string;
    summary: string;
    scopeOfWork: string;
    requirements: string;
    countyFips: string;
    stateCode: string;
    budgetMin?: string | null;
    budgetMax?: string | null;
    bidDueAt?: string | null;
    status: string;
  };
  documents: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
    fileSizeBytes?: number | null;
  }>;
  bidsCount: number;
  myBid: {
    id: string;
    amount: string;
    timelineDays?: number | null;
    proposal: string;
    status: string;
  } | null;
  submissionAccess?: {
    canBid: boolean;
    hasContractorProfile: boolean;
    isVerifiedForCommercial: boolean;
    requires: string[];
    message: string;
  };
};

type VerificationStatusPayload = {
  contractorId: string | null;
  verifiedLicensed: boolean;
  verifiedInsured: boolean;
  hasApprovedLicenseDoc: boolean;
  hasApprovedInsuranceDoc: boolean;
  isEligible: boolean;
  requires: string[];
  documents: Array<{
    id: string;
    type: string;
    status: string;
    fileName: string;
    fileUrl: string;
    expiresAt?: string | null;
    createdAt?: string | null;
    reviewNotes?: string | null;
  }>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function CommercialDirectoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectSearch, setProjectSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [timelineDays, setTimelineDays] = useState("");
  const [proposal, setProposal] = useState("");
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [licenseExpiresAt, setLicenseExpiresAt] = useState("");
  const [insuranceExpiresAt, setInsuranceExpiresAt] = useState("");

  const { data: verificationStatus } = useQuery<VerificationStatusPayload>({
    queryKey: ["/api/commercial-directory/verification/status"],
    queryFn: () => apiRequest("GET", "/api/commercial-directory/verification/status"),
  });
  const canSubmitCommercialBid = verificationStatus?.isEligible ?? false;
  const verificationDocs = verificationStatus?.documents || [];

  const { data, isLoading, error } = useQuery<BoardProject[]>({
    queryKey: ["/api/commercial-directory/projects"],
    queryFn: () => apiRequest("GET", "/api/commercial-directory/projects"),
  });

  const { data: details, isLoading: detailsLoading } = useQuery<ProjectDetails>({
    queryKey: ["/api/commercial-directory/projects/detail", selectedProjectId],
    queryFn: () => apiRequest("GET", `/api/commercial-directory/projects/${selectedProjectId}`),
    enabled: Boolean(selectedProjectId),
  });

  const boardRows = useMemo(() => {
    const rows = data || [];
    const mockPattern = /\b(mock|demo|sample|test|placeholder)\b/i;
    return rows.filter((row) => {
      const title = row.project.title || "";
      const summary = row.project.summary || "";
      const slug = row.project.slug || "";
      if (mockPattern.test(title) || mockPattern.test(summary) || mockPattern.test(slug)) {
        return false;
      }
      if (projectSearch.trim().length > 0) {
        const haystack = `${title} ${summary} ${slug}`.toLowerCase();
        return haystack.includes(projectSearch.trim().toLowerCase());
      }
      return true;
    });
  }, [data, projectSearch]);

  useEffect(() => {
    if (!selectedProjectId && boardRows.length > 0) {
      setSelectedProjectId(boardRows[0].project.id);
      return;
    }
    if (selectedProjectId && !boardRows.some((row) => row.project.id === selectedProjectId)) {
      setSelectedProjectId(boardRows[0]?.project.id || "");
    }
  }, [boardRows, selectedProjectId]);

  useEffect(() => {
    if (details?.myBid) {
      setAmount(details.myBid.amount || "");
      setTimelineDays(details.myBid.timelineDays ? String(details.myBid.timelineDays) : "");
      setProposal(details.myBid.proposal || "");
    }
  }, [details]);

  const budgetLabel = useMemo(() => {
    if (!details?.project) return "Budget on request";
    const min = details.project.budgetMin
      ? Number(details.project.budgetMin).toLocaleString()
      : null;
    const max = details.project.budgetMax
      ? Number(details.project.budgetMax).toLocaleString()
      : null;
    if (min && max) return `$${min} - $${max}`;
    if (min) return `From $${min}`;
    if (max) return `Up to $${max}`;
    return "Budget on request";
  }, [details]);

  const readiness = useMemo(() => {
    const rows = [
      {
        id: "license",
        label: "Approved license",
        done: Boolean(verificationStatus?.hasApprovedLicenseDoc),
      },
      {
        id: "insurance",
        label: "Approved insurance",
        done: Boolean(verificationStatus?.hasApprovedInsuranceDoc),
      },
      {
        id: "portal",
        label: "Bid submission unlocked",
        done: Boolean(canSubmitCommercialBid),
      },
    ];
    const doneCount = rows.filter((r) => r.done).length;
    return {
      rows,
      doneCount,
      pct: Math.round((doneCount / rows.length) * 100),
    };
  }, [verificationStatus, canSubmitCommercialBid]);

  const bidMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error("Select a project first");
      return apiRequest("POST", `/api/commercial-directory/projects/${selectedProjectId}/bids`, {
        amount: Number(amount),
        timelineDays: timelineDays ? Number(timelineDays) : undefined,
        proposal,
      });
    },
    onSuccess: () => {
      toast({ title: "Bid submitted", description: "Your bid is now on the project board." });
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-directory/projects"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/commercial-directory/projects/detail", selectedProjectId],
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Bid failed",
        description: getErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const uploadVerificationMutation = useMutation({
    mutationFn: async () => {
      if (!licenseFile || !insuranceFile) {
        throw new Error("Both license and insurance documents are required.");
      }
      const fd = new FormData();
      fd.append("licenseFile", licenseFile);
      fd.append("insuranceFile", insuranceFile);
      if (licenseExpiresAt) fd.append("licenseExpiresAt", licenseExpiresAt);
      if (insuranceExpiresAt) fd.append("insuranceExpiresAt", insuranceExpiresAt);

      const res = await fetch("/api/commercial-directory/verification/documents", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Upload failed");
      return body;
    },
    onSuccess: () => {
      setLicenseFile(null);
      setInsuranceFile(null);
      setLicenseExpiresAt("");
      setInsuranceExpiresAt("");
      toast({
        title: "Verification documents submitted",
        description: "Your license and insurance are now pending human review.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/commercial-directory/verification/status"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-directory/projects"] });
    },
    onError: (err: unknown) => {
      toast({
        title: "Upload failed",
        description: getErrorMessage(err, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const hasLiveProjects = boardRows.length > 0;

  return (
    <div className="relative max-w-7xl mx-auto px-4 py-4 md:py-6 space-y-4 md:space-y-6">
      <SEOHelmet
        title="Commercial Job Board | TradeScout"
        description="Review active commercial projects, requirements, bid packages, and submission deadlines."
        canonical="https://www.thetradescout.com/commercial-directory"
        noIndex={true}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.14),transparent_40%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.12),transparent_32%)]" />

      <div className="rounded-2xl md:rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-950 to-cyan-950 p-4 md:p-7 shadow-[0_25px_80px_rgba(2,6,23,0.6)]">
        <p className="text-xs tracking-[0.22em] uppercase text-cyan-200">Commercial Job Board</p>
        <h1 className="text-2xl md:text-4xl font-semibold mt-2 md:mt-3 leading-tight">
          Commercial Jobs
        </h1>
        <div className="mt-4 md:mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3 text-xs sm:text-sm">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
            <Building2 className="h-4 w-4 text-cyan-200" />
            <div>Projects matched to your area</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-emerald-200" />
            <div>See jobs first, verify to pursue</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
            <Gavel className="h-4 w-4 text-blue-200" />
            <div>Formal bid adjudication</div>
          </div>
        </div>
      </div>

      <Card className="border-white/10 bg-black/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-cyan-200" />
            Commercial Verification
          </CardTitle>
          <CardDescription>
            {hasLiveProjects
              ? "Review jobs before verification. License and insurance approval unlock bid submission when you choose a project."
              : "Complete verification now so your business is ready when future commercial work is published."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 md:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-white/60">Readiness</div>
                <div className="text-sm text-white/70 mt-1">
                  {readiness.doneCount}/{readiness.rows.length} ready
                </div>
              </div>
              <div className="text-lg md:text-xl font-semibold">{readiness.pct}%</div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                style={{ width: `${readiness.pct}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
              {readiness.rows.map((step) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs flex items-center gap-2"
                >
                  {step.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Clock3 className="h-3.5 w-3.5 text-amber-300" />
                  )}
                  <span className="text-white/70">{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              License:{" "}
              {verificationStatus?.hasApprovedLicenseDoc ? (
                <span className="text-emerald-300">approved</span>
              ) : (
                <span className="text-amber-300">required</span>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              Insurance:{" "}
              {verificationStatus?.hasApprovedInsuranceDoc ? (
                <span className="text-emerald-300">approved</span>
              ) : (
                <span className="text-amber-300">required</span>
              )}
            </div>
          </div>

          {!!verificationDocs.length && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 md:p-4 space-y-2">
              <div className="text-xs uppercase tracking-[0.16em] text-white/60">
                Verification Documents
              </div>
              {verificationDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-sm text-white/70">
                      {doc.type} - {doc.fileName}
                    </div>
                    <div className="text-[11px] text-white/60">
                      Uploaded{" "}
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "n/a"}
                    </div>
                  </div>
                  <div
                    className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-1 border ${
                      doc.status === "approved"
                        ? "text-emerald-200 bg-emerald-500/15 border-emerald-500/40"
                        : doc.status === "rejected"
                          ? "text-rose-200 bg-rose-500/15 border-rose-500/40"
                          : "text-amber-200 bg-amber-500/15 border-amber-500/40"
                    }`}
                  >
                    {doc.status}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!verificationStatus?.isEligible && (
            <div className="space-y-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 md:p-4">
              {verificationStatus?.contractorId ? (
                <>
                  <p className="text-sm text-amber-100">
                    Upload both documents to start review. Opportunities stay visible now, and bid
                    submission unlocks after approval.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>License Document</Label>
                      <Input
                        type="file"
                        onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div>
                      <Label>Insurance Document</Label>
                      <Input
                        type="file"
                        onChange={(e) => setInsuranceFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div>
                      <Label>License Expiration (optional)</Label>
                      <Input
                        type="date"
                        value={licenseExpiresAt}
                        onChange={(e) => setLicenseExpiresAt(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Insurance Expiration (optional)</Label>
                      <Input
                        type="date"
                        value={insuranceExpiresAt}
                        onChange={(e) => setInsuranceExpiresAt(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    disabled={
                      uploadVerificationMutation.isPending || !licenseFile || !insuranceFile
                    }
                    onClick={() => uploadVerificationMutation.mutate()}
                  >
                    {uploadVerificationMutation.isPending ? "Submitting..." : "Submit for Review"}
                  </Button>
                  <div className="text-xs text-amber-100/80 flex items-center gap-2">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Staff review required.
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-amber-100">
                    Create a business profile to begin commercial verification for future work.
                  </p>
                  <Button asChild variant="outline">
                    <a href="/pre-scout-setup?mode=create">Create Business Profile</a>
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Card className="border-white/10 bg-black/30 backdrop-blur">
          <CardContent className="px-5 py-10 text-center text-sm text-white/60">
            Loading commercial jobs...
          </CardContent>
        </Card>
      ) : !error && !hasLiveProjects ? (
        <Card className="border-white/10 bg-black/30 backdrop-blur">
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center px-5 py-10 text-center">
            <Building2 className="h-9 w-9 text-cyan-200" />
            <h2 className="mt-4 text-xl font-semibold">No commercial jobs are open right now</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">
              There is nothing to apply for or bid on. Businesses can still complete commercial
              verification above so they are ready when a real project is published.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {!canSubmitCommercialBid && (
            <Card className="border-cyan-500/35 bg-cyan-500/10 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-cyan-200" />
                  Browse Now, Verify Before You Bid
                </CardTitle>
                <CardDescription>
                  You can inspect every live package below right now. Verification is only required
                  when you move to bid submission.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-cyan-50">
                  Review the project requirements first, then complete contractor verification when
                  you decide to pursue a specific opportunity.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 md:gap-6">
            <Card className="border-white/10 bg-black/30 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-cyan-200" />
                  Opportunities
                </CardTitle>
                <CardDescription>
                  Live projects stay visible before verification so you can review each opportunity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <Label>Search</Label>
                    <Input
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Project title or keyword"
                    />
                  </div>
                  <div>
                    <Label>Area</Label>
                    <Input value="Your service area" disabled />
                  </div>
                </div>

                {isLoading && <p>Loading board...</p>}
                {error && (
                  <p className="text-sm text-red-400">
                    {(error as Error)?.message || "Failed to load board."}
                  </p>
                )}
                {!isLoading && !boardRows.length && <p>No live opportunities found.</p>}

                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {boardRows.map((row) => (
                    <button
                      key={row.project.id}
                      type="button"
                      onClick={() => setSelectedProjectId(row.project.id)}
                      className={`w-full text-left rounded-xl border p-3 transition ${
                        selectedProjectId === row.project.id
                          ? "border-cyan-300 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.22)]"
                          : "border-white/10 bg-tsCard/95 hover:border-cyan-500/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm leading-snug">
                          {row.project.title}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-white/70">
                          {row.project.stateCode}
                        </div>
                      </div>
                      <p className="text-xs text-white/60 mt-1 line-clamp-2">
                        {row.project.summary}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="rounded-full border border-white/15 bg-white/[0.03] px-2 py-1 text-white/70">
                          bids {row.bidsCount}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/[0.03] px-2 py-1 text-white/70">
                          docs {row.docsCount}
                        </span>
                        {row.project.bidDueAt && (
                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                            due {new Date(row.project.bidDueAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs uppercase tracking-wide text-white/60">Bid Count</div>
                  <div className="text-lg font-semibold">{details?.bidsCount ?? 0}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs uppercase tracking-wide text-white/60">Budget</div>
                  <div className="text-sm font-medium">{budgetLabel}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs uppercase tracking-wide text-white/60">Bid Due</div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-cyan-200" />
                    {details?.project?.bidDueAt
                      ? new Date(details.project.bidDueAt).toLocaleDateString()
                      : "TBD"}
                  </div>
                </div>
              </div>

              <Card className="border-white/10 bg-black/30 backdrop-blur">
                <CardHeader>
                  <CardTitle>Project Package</CardTitle>
                  <CardDescription>
                    {selectedProjectId ? `Project ID: ${selectedProjectId}` : "Select a project."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {detailsLoading && <p>Loading package...</p>}
                  {!detailsLoading && !details?.project && <p>No project selected.</p>}
                  {details?.project && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-white/10 p-3 md:p-4 bg-white/[0.03]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="text-xl font-semibold">{details.project.title}</h2>
                          <div className="text-xs uppercase tracking-wide text-blue-200">
                            {details.project.status}
                          </div>
                        </div>
                        <p className="text-sm text-white/70 mt-2">{details.project.summary}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
                          <div>
                            <div className="text-white/60 text-xs">Budget</div>
                            <div>{budgetLabel}</div>
                          </div>
                          <div>
                            <div className="text-white/60 text-xs">Bid Due</div>
                            <div>
                              {details.project.bidDueAt
                                ? new Date(details.project.bidDueAt).toLocaleString()
                                : "Not specified"}
                            </div>
                          </div>
                          <div>
                            <div className="text-white/60 text-xs">Submitted Bids</div>
                            <div>{details.bidsCount}</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <div className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
                          <h3 className="text-sm uppercase tracking-wide text-white/70">
                            Scope of Work
                          </h3>
                          <p className="text-sm text-white/70 mt-2 whitespace-pre-wrap">
                            {details.project.scopeOfWork}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
                          <h3 className="text-sm uppercase tracking-wide text-white/70">
                            Requirements
                          </h3>
                          <p className="text-sm text-white/70 mt-2 whitespace-pre-wrap">
                            {details.project.requirements}
                          </p>
                        </div>
                      </div>

                      {!!details.documents.length && (
                        <div className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
                          <h3 className="text-sm uppercase tracking-wide text-white/70">
                            Bid Package Documents
                          </h3>
                          <ul className="mt-2 space-y-1">
                            {details.documents.map((doc) => (
                              <li key={doc.id}>
                                <a
                                  className="underline text-sm text-blue-200"
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {doc.fileName}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-black/30 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-cyan-200" />
                    Submit Bid
                  </CardTitle>
                  <CardDescription>
                    {details?.submissionAccess?.canBid
                      ? details?.myBid
                        ? `Current status: ${details.myBid.status}.`
                        : "Send your proposal for this project."
                      : details?.submissionAccess?.message ||
                        "Review the opportunity now, then complete verification before submitting a bid."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 md:space-y-4">
                  {details?.submissionAccess && !details.submissionAccess.canBid && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                      <div className="text-sm text-amber-100">
                        This opportunity is visible now, but bid submission is still locked.
                      </div>
                      <div className="text-xs text-amber-100/80">
                        {details.submissionAccess.message}
                      </div>
                      {!!details.submissionAccess.requires?.length && (
                        <div className="text-xs text-amber-100/80">
                          Needed before submission:{" "}
                          {details.submissionAccess.requires
                            .map((item) => item.replace(/_/g, " "))
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <Label>Bid Amount (USD)</Label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Timeline (days)</Label>
                      <Input
                        type="number"
                        value={timelineDays}
                        onChange={(e) => setTimelineDays(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Technical / Execution Proposal</Label>
                    <Textarea
                      value={proposal}
                      onChange={(e) => setProposal(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => bidMutation.mutate()}
                      disabled={
                        bidMutation.isPending ||
                        !selectedProjectId ||
                        !details?.submissionAccess?.canBid ||
                        !amount ||
                        Number(amount) <= 0 ||
                        proposal.trim().length < 20
                      }
                    >
                      {bidMutation.isPending ? "Submitting..." : "Submit Bid"}
                    </Button>
                    {details?.project && (
                      <a
                        className="inline-flex items-center text-sm underline text-blue-200"
                        href={`/commercial/p/${details.project.slug}`}
                      >
                        Open Campaign Landing
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
