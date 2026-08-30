import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  RefreshCw,
  Search,
  UserCheck,
  XCircle,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type RequirementField = "license" | "insurance" | "tax_id" | "business_registration";
type FieldDecision = "approved" | "rejected";

type VerificationSubmissions = {
  licenseNumber?: string;
  licenseDocObjectKey?: string;
  taxId?: string;
  insuranceDocObjectKey?: string;
  businessRegistrationDocObjectKey?: string;
  businessRegistrationReviewRequestedAt?: string;
  businessRegistrationReviewSource?: string;
  submittedAt?: string;
};

interface ProfileVerificationRow {
  profile: {
    id: string;
    userId: string;
    userIntent: "person" | "business";
    businessType?: "service_provider" | "seller" | null;
    displayName?: string | null;
    verificationRequirements?: Partial<Record<RequirementField, boolean>>;
    license_verified?: boolean;
    insurance_verified?: boolean;
    tax_id_verified?: boolean;
    business_registration_verified?: boolean;
    verificationSubmissions?: VerificationSubmissions;
    verificationStatus?: string;
  };
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

const REQUIREMENT_FIELDS = [
  "license",
  "insurance",
  "tax_id",
  "business_registration",
] as const satisfies readonly RequirementField[];

const FIELD_LABELS: Record<RequirementField, string> = {
  license: "License",
  insurance: "Insurance",
  tax_id: "Tax ID",
  business_registration: "Business registration",
};

function readable(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayName(row: ProfileVerificationRow): string {
  const profileName = String(row.profile.displayName || "").trim();
  if (profileName) return profileName;
  const userName = `${row.user.firstName || ""} ${row.user.lastName || ""}`.trim();
  return userName || row.user.email || "Unknown user";
}

function activeFields(profile: ProfileVerificationRow["profile"]): RequirementField[] {
  const requirements = profile.verificationRequirements || {};
  return REQUIREMENT_FIELDS.filter((field) => Boolean(requirements[field]));
}

function isFieldVerified(
  profile: ProfileVerificationRow["profile"],
  field: RequirementField
): boolean {
  if (field === "license") return Boolean(profile.license_verified);
  if (field === "insurance") return Boolean(profile.insurance_verified);
  if (field === "tax_id") return Boolean(profile.tax_id_verified);
  return Boolean(profile.business_registration_verified);
}

function submissionSummary(
  profile: ProfileVerificationRow["profile"],
  field: RequirementField
): string | null {
  const submissions = profile.verificationSubmissions || {};
  if (field === "license") {
    return (
      submissions.licenseNumber ||
      (submissions.licenseDocObjectKey ? "License document uploaded" : null)
    );
  }
  if (field === "tax_id") return submissions.taxId || null;
  if (field === "insurance") {
    return submissions.insuranceDocObjectKey ? "Insurance document uploaded" : null;
  }
  if (submissions.businessRegistrationDocObjectKey) {
    return "Business registration document uploaded";
  }
  if (submissions.businessRegistrationReviewRequestedAt) {
    return "Manual business review requested from a profile account";
  }
  return null;
}

function overallStatus(profile: ProfileVerificationRow["profile"]): string {
  return (
    String(profile.verificationStatus || "pending")
      .trim()
      .toLowerCase() || "pending"
  );
}

function fieldState(
  profile: ProfileVerificationRow["profile"],
  field: RequirementField
): "approved" | "submitted" | "missing" {
  if (isFieldVerified(profile, field)) return "approved";
  return submissionSummary(profile, field) ? "submitted" : "missing";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Approved</Badge>
    );
  }
  if (status === "rejected") {
    return <Badge className="border-red-400/30 bg-red-400/10 text-red-200">Rejected</Badge>;
  }
  return (
    <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100">{readable(status)}</Badge>
  );
}

function FieldIcon({ state }: { state: ReturnType<typeof fieldState> }) {
  if (state === "approved") return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  if (state === "submitted") return <Clock className="h-4 w-4 text-amber-200" />;
  return <XCircle className="h-4 w-4 text-white/25" />;
}

export default function AdminProfileVerifications() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const rowsQuery = useQuery<ProfileVerificationRow[]>({
    queryKey: ["/api/admin/profile-verifications", statusFilter],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/admin/profile-verifications?status=${encodeURIComponent(statusFilter)}`
      );
      return Array.isArray(response) ? (response as ProfileVerificationRow[]) : [];
    },
  });

  const decisionMutation = useMutation({
    mutationFn: (args: { profileId: string; field: RequirementField; decision: FieldDecision }) =>
      apiRequest("PUT", `/api/admin/profile-verifications/${args.profileId}`, {
        field: args.field,
        decision: args.decision,
      }),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/profile-verifications"] });
      toast({
        title: variables.decision === "approved" ? "Requirement approved" : "Requirement rejected",
        description: `${FIELD_LABELS[variables.field]} was updated.`,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Verification was not updated",
        description: formatUserFacingErrorMessage(error, "Failed to update the requirement."),
        variant: "destructive",
      });
    },
  });

  const rows = rowsQuery.data || [];
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (!query) return true;
        return [
          displayName(row),
          row.user.email,
          row.profile.userIntent,
          row.profile.businessType,
          row.profile.verificationStatus,
          ...activeFields(row.profile).map((field) => FIELD_LABELS[field]),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const leftReady = activeFields(left.profile).filter(
          (field) => fieldState(left.profile, field) === "submitted"
        ).length;
        const rightReady = activeFields(right.profile).filter(
          (field) => fieldState(right.profile, field) === "submitted"
        ).length;
        if (leftReady !== rightReady) return rightReady - leftReady;
        return displayName(left).localeCompare(displayName(right));
      });
  }, [rows, search]);

  const counts = useMemo(() => {
    let submitted = 0;
    let approved = 0;
    let missing = 0;
    for (const row of rows) {
      for (const field of activeFields(row.profile)) {
        const state = fieldState(row.profile, field);
        if (state === "submitted") submitted += 1;
        else if (state === "approved") approved += 1;
        else missing += 1;
      }
    }
    return { profiles: rows.length, submitted, approved, missing };
  }, [rows]);

  if (rowsQuery.isLoading) {
    return (
      <AdminWorkspace>
        <div className="flex min-h-64 items-center justify-center border-y border-white/10 text-sm text-white/50">
          <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
          Loading business verification submissions…
        </div>
      </AdminWorkspace>
    );
  }

  if (rowsQuery.isError) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Business verification queue unavailable"
          description="The submission queue could not be read. No decision was changed."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => rowsQuery.refetch()}
              className="border-white/15 bg-transparent text-white"
            >
              Retry
            </Button>
          }
        />
      </AdminWorkspace>
    );
  }

  return (
    <AdminWorkspace data-testid="admin-business-verifications-v2">
      <AdminSection
        title="Business verification queue"
        description="Approve or reject each required field independently. Review required business evidence and manual profile-account review requests. Approval controls protected business features; it does not publish the business profile."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => rowsQuery.refetch()}
            disabled={rowsQuery.isFetching}
            className="border-white/12 bg-white/[0.025] text-white/65 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${rowsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            { label: "Profiles", value: counts.profiles, detail: "Businesses in this result set" },
            {
              label: "Ready for review",
              value: counts.submitted,
              detail: "Submitted fields awaiting a decision",
              tone: counts.submitted > 0 ? "warning" : "good",
            },
            {
              label: "Approved fields",
              value: counts.approved,
              detail: "Completed requirement decisions",
              tone: "good",
            },
            {
              label: "Missing evidence",
              value: counts.missing,
              detail: "Required fields with no submission",
              tone: counts.missing > 0 ? "warning" : "good",
            },
          ]}
        />

        <AdminToolbar className="mt-4">
          <div className="relative min-w-0 flex-1 md:max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search business, person, email, status, or requirement"
              className="border-white/10 bg-black/20 pl-9 text-white placeholder:text-white/30"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[13rem] border-white/10 bg-black/20 text-white">
              <SelectValue placeholder="Overall status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All with submissions</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </AdminToolbar>

        {filteredRows.length ? (
          <AdminList className="mt-4">
            {filteredRows.map((row) => {
              const fields = activeFields(row.profile);
              const submittedCount = fields.filter(
                (field) => fieldState(row.profile, field) === "submitted"
              ).length;
              const approvedCount = fields.filter(
                (field) => fieldState(row.profile, field) === "approved"
              ).length;
              const status = overallStatus(row.profile);

              return (
                <details key={row.profile.id} className="group">
                  <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(14rem,1fr)_minmax(11rem,0.75fr)_minmax(12rem,0.85fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {row.profile.userIntent === "business" ? (
                          <Building2 className="h-4 w-4 shrink-0 text-orange-300" />
                        ) : (
                          <UserCheck className="h-4 w-4 shrink-0 text-orange-300" />
                        )}
                        <p className="truncate font-semibold text-white">{displayName(row)}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-white/38">{row.user.email}</p>
                    </div>
                    <div className="text-sm text-white/58">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                        Requirements
                      </p>
                      <p className="mt-1">
                        {approvedCount} approved · {submittedCount} ready
                      </p>
                    </div>
                    <StatusBadge status={status} />
                    <div className="flex items-center justify-between gap-3 lg:justify-end">
                      <span className="text-xs text-white/35">
                        {submittedCount > 0
                          ? `${submittedCount} decision${submittedCount === 1 ? "" : "s"}`
                          : "Review"}
                      </span>
                      <ChevronDown className="h-4 w-4 text-white/35 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>

                  <div className="border-t border-white/10 bg-white/[0.018] px-3 py-5 sm:px-4">
                    {fields.length ? (
                      <div className="divide-y divide-white/10 border-y border-white/10">
                        {fields.map((field) => {
                          const state = fieldState(row.profile, field);
                          const summary = submissionSummary(row.profile, field);
                          return (
                            <div
                              key={field}
                              className="grid gap-3 px-3 py-4 sm:grid-cols-[2.5rem_minmax(10rem,0.8fr)_minmax(0,1fr)_auto] sm:items-center sm:px-4"
                            >
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.035]">
                                <FieldIcon state={state} />
                              </span>
                              <div>
                                <p className="font-semibold text-white">{FIELD_LABELS[field]}</p>
                                <p className="mt-1 text-xs text-white/35">{readable(state)}</p>
                              </div>
                              <p className="min-w-0 text-sm text-white/55">
                                {summary || "Not submitted"}
                              </p>
                              {state === "submitted" ? (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      decisionMutation.mutate({
                                        profileId: row.profile.id,
                                        field,
                                        decision: "approved",
                                      })
                                    }
                                    disabled={decisionMutation.isPending}
                                    className="bg-emerald-400 text-black hover:bg-emerald-300"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      decisionMutation.mutate({
                                        profileId: row.profile.id,
                                        field,
                                        decision: "rejected",
                                      })
                                    }
                                    disabled={decisionMutation.isPending}
                                    className="border-red-300/25 bg-transparent text-red-100 hover:bg-red-400/10"
                                  >
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-white/32">
                                  {state === "approved"
                                    ? "Decision complete"
                                    : "Waiting for evidence"}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="border-y border-white/10 px-3 py-5 text-sm text-white/48">
                        This profile declares no required verification fields.
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </AdminList>
        ) : (
          <AdminEmptyState
            title="No business verification submissions match these filters"
            description="Change the search or overall-status filter to inspect another part of the queue."
          />
        )}
      </AdminSection>
    </AdminWorkspace>
  );
}
