import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Building2, CalendarClock, FileCheck2, Landmark, Sparkles } from "lucide-react";

type LandingPayload = {
  project: {
    title: string;
    summary: string;
    scopeOfWork: string;
    requirements: string;
    stateCode: string;
    countyFips: string;
    budgetMin?: string | null;
    budgetMax?: string | null;
    bidDueAt?: string | null;
    campaignHeadline?: string | null;
    campaignBody?: string | null;
    heroImageUrl?: string | null;
  };
  documents: Array<{ id: string; fileName: string; fileUrl: string; mimeType?: string | null }>;
  bidsCount: number;
};

export default function CommercialProjectLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery<LandingPayload>({
    queryKey: ["/api/commercial-directory/landing", slug],
    queryFn: () => apiRequest("GET", `/api/commercial-directory/landing/${slug}`),
    enabled: Boolean(slug),
  });

  const budget = useMemo(() => {
    if (!data?.project) return "";
    const min = data.project.budgetMin ? Number(data.project.budgetMin).toLocaleString() : null;
    const max = data.project.budgetMax ? Number(data.project.budgetMax).toLocaleString() : null;
    if (min && max) return `$${min} - $${max}`;
    if (min) return `From $${min}`;
    if (max) return `Up to $${max}`;
    return "Budget on request";
  }, [data]);

  if (isLoading) return <div className="max-w-6xl mx-auto p-6">Loading campaign page...</div>;
  if (error || !data) return <div className="max-w-6xl mx-auto p-6">Campaign page not found.</div>;

  return (
    <div className="relative max-w-6xl mx-auto p-6 space-y-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(6,182,212,0.14),transparent_38%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.12),transparent_30%)]" />

      <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 p-7 shadow-[0_25px_80px_rgba(2,6,23,0.55)]">
        <p className="text-xs tracking-[0.2em] uppercase text-cyan-200">
          Official Commercial Solicitation
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold mt-3 leading-tight">
          {data.project.campaignHeadline || data.project.title}
        </h1>
        <p className="text-sm text-slate-300 mt-3 max-w-3xl">
          {data.project.campaignBody || data.project.summary}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1">
            <Building2 className="h-3.5 w-3.5 text-cyan-200" /> Regional procurement brief
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-200" /> Verified contractor access only
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-blue-200" /> Campaign-ready package
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
            <div className="text-slate-400 text-xs">County / State</div>
            <div>
              {data.project.countyFips} / {data.project.stateCode}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
            <div className="text-slate-400 text-xs">Budget Band</div>
            <div>{budget}</div>
          </div>
          <div className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
            <div className="text-slate-400 text-xs">Bid Count</div>
            <div>{data.bidsCount}</div>
          </div>
          <div className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
            <div className="text-slate-400 text-xs">Bid Due</div>
            <div className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 text-cyan-200" />
              {data.project.bidDueAt ? new Date(data.project.bidDueAt).toLocaleString() : "TBD"}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/commercial-directory">Enter Contractor Portal</Link>
          </Button>
          <Button asChild variant="outline">
            <a href="/create-account">Create Account</a>
          </Button>
        </div>
      </section>

      {data.project.heroImageUrl && (
        <div className="relative">
          <img
            src={data.project.heroImageUrl}
            alt={data.project.title}
            className="w-full max-h-[360px] object-cover rounded-2xl border border-white/10"
          />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-slate-950/45 to-transparent" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-white/10 bg-slate-950/75 backdrop-blur">
          <CardHeader>
            <CardTitle>Scope of Work</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-slate-200">{data.project.scopeOfWork}</p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/75 backdrop-blur">
          <CardHeader>
            <CardTitle>Requirements and Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-slate-200">{data.project.requirements}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-slate-950/75 backdrop-blur">
        <CardHeader>
          <CardTitle>Submission Process</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-white/10 p-3 bg-white/[0.02]">
              1. Review project package and addenda.
            </div>
            <div className="rounded-xl border border-white/10 p-3 bg-white/[0.02]">
              2. Enter the verified contractor portal and submit formal bid details.
            </div>
            <div className="rounded-xl border border-white/10 p-3 bg-white/[0.02]">
              3. Await shortlist or award notification in platform workflow.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-slate-950/75 backdrop-blur">
        <CardHeader>
          <CardTitle>Procurement Positioning</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-white/10 p-3 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="h-4 w-4 text-cyan-200" />
                <span className="font-medium">Formal Process</span>
              </div>
              Structured packages, review steps, and transparent adjudication.
            </div>
            <div className="rounded-xl border border-white/10 p-3 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-1">
                <FileCheck2 className="h-4 w-4 text-emerald-200" />
                <span className="font-medium">Verified Access</span>
              </div>
              License and insurance approval required before commercial participation.
            </div>
            <div className="rounded-xl border border-white/10 p-3 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-1">
                <BadgeCheck className="h-4 w-4 text-blue-200" />
                <span className="font-medium">Campaign Ready</span>
              </div>
              Public-facing project brief aligned with contractor portal workflow.
            </div>
          </div>
        </CardContent>
      </Card>

      {!!data.documents.length && (
        <Card className="border-white/10 bg-slate-950/75 backdrop-blur">
          <CardHeader>
            <CardTitle>Procurement Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-slate-700 p-3 hover:border-cyan-400 transition"
                >
                  <div className="font-medium">{doc.fileName}</div>
                  <div className="text-xs text-slate-400 mt-1">{doc.mimeType || "document"}</div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
