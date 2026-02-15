import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BadgeCheck, FileClock, ShieldAlert, UserCog } from "lucide-react";

type CommercialContractorRow = {
  contractor: {
    id: string;
    companyName: string;
    slug: string;
    email?: string | null;
    phone?: string | null;
    isActive?: boolean | null;
    verifiedLicensed?: boolean | null;
    verifiedInsured?: boolean | null;
  };
  verification: {
    hasLicense: boolean;
    hasInsurance: boolean;
    hasApprovedLicenseDoc: boolean;
    hasApprovedInsuranceDoc: boolean;
    isActive: boolean;
    eligibleForCommercial: boolean;
    pendingDocs: number;
    rejectedDocs: number;
  };
  documents: Array<{
    id: string;
    type: string;
    status: string;
    fileName: string;
    fileUrl: string;
    createdAt?: string | null;
    reviewNotes?: string | null;
  }>;
};

function statusPill(eligible: boolean, isActive: boolean): { label: string; className: string } {
  if (!isActive) {
    return {
      label: "suspended",
      className: "text-rose-200 bg-rose-500/15 border border-rose-500/40",
    };
  }
  if (eligible) {
    return {
      label: "eligible",
      className: "text-emerald-200 bg-emerald-500/15 border border-emerald-500/40",
    };
  }
  return {
    label: "blocked",
    className: "text-amber-200 bg-amber-500/15 border border-amber-500/40",
  };
}

export default function AdminCommercialContractorsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContractorId, setSelectedContractorId] = useState<string>("");

  const { data, isLoading } = useQuery<CommercialContractorRow[]>({
    queryKey: ["/api/admin/commercial-directory/contractors", search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const qs = params.toString() ? `?${params.toString()}` : "";
      return apiRequest("GET", `/api/admin/commercial-directory/contractors${qs}`);
    },
  });

  const selected = useMemo(
    () => (data || []).find((row) => row.contractor.id === selectedContractorId) || null,
    [data, selectedContractorId]
  );
  const stats = useMemo(() => {
    const rows = data || [];
    return {
      total: rows.length,
      eligible: rows.filter((r) => r.verification.eligibleForCommercial).length,
      pending: rows.filter((r) => r.verification.pendingDocs > 0).length,
      suspended: rows.filter((r) => !r.verification.isActive).length,
    };
  }, [data]);

  const reviewDocMutation = useMutation({
    mutationFn: async (input: { documentId: string; approved: boolean }) => {
      return apiRequest(
        "POST",
        `/api/admin/commercial-directory/verification/documents/${input.documentId}/review`,
        { approved: input.approved }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/commercial-directory/contractors"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/commercial-directory/verification/pending"],
      });
      toast({ title: "Verification updated" });
    },
    onError: (err: any) => {
      toast({
        title: "Review failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (input: { contractorId: string; isActive: boolean }) => {
      return apiRequest(
        "PATCH",
        `/api/admin/commercial-directory/contractors/${input.contractorId}/status`,
        { isActive: input.isActive }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/commercial-directory/contractors"] });
      toast({ title: "Contractor status updated" });
    },
    onError: (err: any) => {
      toast({
        title: "Status update failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 p-7 shadow-[0_25px_80px_rgba(2,6,23,0.55)]">
        <p className="text-xs tracking-[0.2em] uppercase text-teal-200">
          Commercial Contractors Admin
        </p>
        <h1 className="text-3xl font-semibold mt-2">
          Commercial Contractor Management and Verification
        </h1>
        <p className="text-sm text-slate-300 mt-2 max-w-3xl">
          Dedicated portal for commercial contractor eligibility, document review, and activation
          controls.
        </p>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">Total</div>
          <div className="mt-1 text-xl font-semibold flex items-center gap-2">
            <UserCog className="h-4 w-4 text-teal-200" />
            {stats.total}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">Eligible</div>
          <div className="mt-1 text-xl font-semibold flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-emerald-200" />
            {stats.eligible}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">Pending</div>
          <div className="mt-1 text-xl font-semibold flex items-center gap-2">
            <FileClock className="h-4 w-4 text-amber-200" />
            {stats.pending}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">Suspended</div>
          <div className="mt-1 text-xl font-semibold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-200" />
            {stats.suspended}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <Card className="border-white/10 bg-slate-950/75 backdrop-blur">
          <CardHeader>
            <CardTitle>Commercial Contractor Roster</CardTitle>
            <CardDescription>Separate from other user-type verification queues.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Search</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Company, email, phone"
              />
            </div>
            <div>
              <Label>Status Filter</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="all">all</option>
                <option value="eligible">eligible</option>
                <option value="ineligible">ineligible</option>
                <option value="pending">pending docs</option>
                <option value="suspended">suspended</option>
              </select>
            </div>

            {isLoading && <p>Loading contractors...</p>}
            {!isLoading && !(data || []).length && <p>No commercial contractors found.</p>}

            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {(data || []).map((row) => {
                const pill = statusPill(
                  row.verification.eligibleForCommercial,
                  row.verification.isActive
                );
                return (
                  <button
                    key={row.contractor.id}
                    type="button"
                    onClick={() => setSelectedContractorId(row.contractor.id)}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      selectedContractorId === row.contractor.id
                        ? "border-teal-500 bg-teal-500/10"
                        : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{row.contractor.companyName}</div>
                      <div
                        className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ${pill.className}`}
                      >
                        {pill.label}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      pending: {row.verification.pendingDocs} | rejected:{" "}
                      {row.verification.rejectedDocs}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/75 backdrop-blur">
          <CardHeader>
            <CardTitle>Contractor Detail and Verification Controls</CardTitle>
            <CardDescription>
              {selected ? selected.contractor.companyName : "Select a contractor from the roster."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected && <p>No contractor selected.</p>}
            {selected && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded border border-slate-700 p-3">
                    License gate:{" "}
                    {selected.verification.hasApprovedLicenseDoc
                      ? "approved doc"
                      : "missing approved doc"}
                  </div>
                  <div className="rounded border border-slate-700 p-3">
                    Insurance gate:{" "}
                    {selected.verification.hasApprovedInsuranceDoc
                      ? "approved doc"
                      : "missing approved doc"}
                  </div>
                  <div className="rounded border border-slate-700 p-3">
                    Access: {selected.verification.eligibleForCommercial ? "eligible" : "blocked"}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={statusMutation.isPending || selected.verification.isActive}
                    onClick={() =>
                      statusMutation.mutate({
                        contractorId: selected.contractor.id,
                        isActive: true,
                      })
                    }
                  >
                    Activate Contractor
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={statusMutation.isPending || !selected.verification.isActive}
                    onClick={() =>
                      statusMutation.mutate({
                        contractorId: selected.contractor.id,
                        isActive: false,
                      })
                    }
                  >
                    Suspend Contractor
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm uppercase tracking-wide text-slate-300">
                    License and Insurance Documents
                  </h3>
                  {!selected.documents.length && <p>No verification documents yet.</p>}
                  {selected.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded border border-slate-700 p-3 bg-slate-900/60"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-sm">
                            {doc.type} - {doc.status}
                          </div>
                          <div className="text-xs text-slate-400">{doc.fileName}</div>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-sm underline text-teal-200"
                          >
                            Open
                          </a>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reviewDocMutation.isPending}
                            onClick={() =>
                              reviewDocMutation.mutate({ documentId: doc.id, approved: false })
                            }
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={reviewDocMutation.isPending}
                            onClick={() =>
                              reviewDocMutation.mutate({ documentId: doc.id, approved: true })
                            }
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                      {doc.reviewNotes && (
                        <p className="text-xs text-slate-400 mt-2">Notes: {doc.reviewNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
