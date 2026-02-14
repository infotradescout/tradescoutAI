import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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
};

export default function CommercialDirectoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [countyFilter, setCountyFilter] = useState("");
  const [amount, setAmount] = useState("");
  const [timelineDays, setTimelineDays] = useState("");
  const [proposal, setProposal] = useState("");

  const { data, isLoading, error } = useQuery<BoardProject[]>({
    queryKey: ["/api/commercial-directory/projects", countyFilter],
    queryFn: () => {
      const qs = countyFilter.trim().length === 5 ? `?countyFips=${countyFilter.trim()}` : "";
      return apiRequest("GET", `/api/commercial-directory/projects${qs}`);
    },
  });

  const { data: details, isLoading: detailsLoading } = useQuery<ProjectDetails>({
    queryKey: ["/api/commercial-directory/projects/detail", selectedProjectId],
    queryFn: () => apiRequest("GET", `/api/commercial-directory/projects/${selectedProjectId}`),
    enabled: Boolean(selectedProjectId),
  });

  useEffect(() => {
    if (!selectedProjectId && data && data.length > 0) {
      setSelectedProjectId(data[0].project.id);
    }
  }, [data, selectedProjectId]);

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
    onError: (err: any) => {
      toast({
        title: "Bid failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-gradient-to-r from-slate-900 to-blue-950 p-6">
        <p className="text-xs tracking-[0.18em] uppercase text-blue-200">
          Commercial Opportunity Exchange
        </p>
        <h1 className="text-3xl font-semibold mt-2">Verified Contractor Bidding Portal</h1>
        <p className="text-sm text-slate-300 mt-2 max-w-3xl">
          Formal commercial job requests, full scope packages, and documented bid submissions in one
          official workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <Card className="border-slate-700 bg-slate-950/70">
          <CardHeader>
            <CardTitle>Open Opportunities</CardTitle>
            <CardDescription>Filter by county FIPS and select a project package.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>County Filter (FIPS)</Label>
              <Input
                value={countyFilter}
                onChange={(e) => setCountyFilter(e.target.value.slice(0, 5))}
                placeholder="22105"
              />
            </div>

            {isLoading && <p>Loading board...</p>}
            {error && (
              <p className="text-sm text-red-400">
                {(error as Error)?.message || "Failed to load board."}
              </p>
            )}
            {!isLoading && !data?.length && <p>No open projects right now.</p>}

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {(data || []).map((row) => (
                <button
                  key={row.project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(row.project.id)}
                  className={`w-full text-left rounded-xl border p-3 transition ${
                    selectedProjectId === row.project.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">{row.project.title}</div>
                    <div className="text-[11px] text-slate-300">
                      {row.project.stateCode}-{row.project.countyFips}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{row.project.summary}</p>
                  <div className="text-[11px] text-slate-400 mt-2">
                    bids: {row.bidsCount} | docs: {row.docsCount}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-700 bg-slate-950/70">
            <CardHeader>
              <CardTitle>Project Package</CardTitle>
              <CardDescription>
                {selectedProjectId
                  ? `Project ID: ${selectedProjectId}`
                  : "Select an opportunity to review scope."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detailsLoading && <p>Loading package...</p>}
              {!detailsLoading && !details?.project && <p>No project selected.</p>}
              {details?.project && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-700 p-3 bg-slate-900/70">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-xl font-semibold">{details.project.title}</h2>
                      <div className="text-xs uppercase tracking-wide text-blue-200">
                        {details.project.status}
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 mt-2">{details.project.summary}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
                      <div>
                        <div className="text-slate-400 text-xs">Budget</div>
                        <div>{budgetLabel}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs">Bid Due</div>
                        <div>
                          {details.project.bidDueAt
                            ? new Date(details.project.bidDueAt).toLocaleString()
                            : "Not specified"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs">Submitted Bids</div>
                        <div>{details.bidsCount}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-700 p-3 bg-slate-900/60">
                      <h3 className="text-sm uppercase tracking-wide text-slate-300">
                        Scope of Work
                      </h3>
                      <p className="text-sm text-slate-200 mt-2 whitespace-pre-wrap">
                        {details.project.scopeOfWork}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 p-3 bg-slate-900/60">
                      <h3 className="text-sm uppercase tracking-wide text-slate-300">
                        Requirements
                      </h3>
                      <p className="text-sm text-slate-200 mt-2 whitespace-pre-wrap">
                        {details.project.requirements}
                      </p>
                    </div>
                  </div>

                  {!!details.documents.length && (
                    <div className="rounded-lg border border-slate-700 p-3 bg-slate-900/60">
                      <h3 className="text-sm uppercase tracking-wide text-slate-300">
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

          <Card className="border-slate-700 bg-slate-950/70">
            <CardHeader>
              <CardTitle>Submit Formal Bid</CardTitle>
              <CardDescription>
                {details?.myBid
                  ? `Existing bid status: ${details.myBid.status}. Update and resubmit if needed.`
                  : "Submit your proposal package for this project."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Bid Amount (USD)</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
                <Textarea value={proposal} onChange={(e) => setProposal(e.target.value)} rows={7} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => bidMutation.mutate()}
                  disabled={
                    bidMutation.isPending ||
                    !selectedProjectId ||
                    !amount ||
                    Number(amount) <= 0 ||
                    proposal.trim().length < 20
                  }
                >
                  {bidMutation.isPending ? "Submitting..." : "Submit Bid Package"}
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
    </div>
  );
}
