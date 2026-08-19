import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
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

interface ProfileVerificationRow {
  profile: {
    id: string;
    userId: string;
    userIntent: "person" | "business";
    businessType?: "service_provider" | "seller" | null;
    verificationRequirements?: Partial<Record<RequirementField, boolean>>;
    license_verified?: boolean;
    insurance_verified?: boolean;
    tax_id_verified?: boolean;
    business_registration_verified?: boolean;
    verificationSubmissions?: {
      licenseNumber?: string;
      licenseDocObjectKey?: string;
      taxId?: string;
      insuranceDocObjectKey?: string;
      businessRegistrationDocObjectKey?: string;
      submittedAt?: string;
    };
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

function displayName(user: ProfileVerificationRow["user"]): string {
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || user.email || "Unknown user";
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
    return submissions.licenseNumber ||
      (submissions.licenseDocObjectKey ? "Document uploaded" : null);
  }
  if (field === "tax_id") return submissions.taxId || null;
  if (field === "insurance") {
    return submissions.insuranceDocObjectKey ? "Document uploaded" : null;
  }
  return submissions.businessRegistrationDocObjectKey ? "Document uploaded" : null;
}

function overallStatus(profile: ProfileVerificationRow["profile"]): string {
  return String(profile.verificationStatus || "pending").trim().toLowerCase() || "pending";
}

function overallStatusBadge(status: string) {
  if (status === "approved") {
    return (
      <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
        Approved
      </Badge>
    );
  }
  if (status === "rejected") {
    return <Badge className="border-red-400/30 bg-red-400/10 text-red-200">Rejected</Badge>;
  }
  return (
    <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100">
      {readable(status)}
    </Badge>
  );
}

function fieldState(
  profile: ProfileVerificationRow["profile"],
  field: RequirementField
): "approved" | "submitted" | "missing" {
  if (isFieldVerified(profile, field)) return "approved";
  return submissionSummary(profile, field) ? "submitted" : "missing";
}

function FieldStateIcon({ state }: { state: ReturnType<typeof fieldState> }) {
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
    mutationFn: ({
      profileId,
      field,
      decision,
    }: {
      profileId: string;
      field: RequirementField;
      decision: FieldDecision;
    }) =>
      apiRequest("PUT", `/api/admin/profile-verifications/${profileId}`, {
        field,
        decision,
      }),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/admin/profile-verifications"],
      });
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
    const normalizedSearch = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (!normalizedSearch) return true;
        return [
          row.user.email,
          row.user.firstName,
          row.user.lastName,
          row.profile.userIntent,
          row.profile.businessType,
          row.profile.verificationStatus,
          ...activeFields(row.profile).map((field) => FIELD_LABELS[field]),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        const aPending = activeFields(a.profile).filter(
          (field) => fieldState(a.profile, field) === "submitted"
        ).length;
        const bPending = activeFields(b.profile).filter(
          (field) => fieldState(b.profile, field) === "submitted"
        ).length;
        if (aPending !== bPending) return bPending - aPending;
        return displayName(a.user).localeCompare(displayName(b.user));
      });
  }, [rows, search]);

  const counts = useMemo(() => {
    let submittedFields = 0;
    let missingFields = 0;
    let approvedFields = 0;
    for (const row of rows) {
      for (const field of activeFields(row.profile)) {
        const state = fieldState(row.profile, field);
        if (state === "submitted") submittedFields += 1;
        else if (state === "approved") approvedFields += 1;
        else missingFields += 1;
      }
    }
    return {
      profiles: rows.length,
      submittedFields,
      approvedFields,
      missingFields,
    };
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
          description="The submission queue could not be read. No requirement decision was changed."
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
        description="Approve or reject each required field independently. Requirements remain profile-specific, so unrelated business types are not forced into contractor credentials."
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
            {
              label: "Profiles",
              value: counts.profiles,
              detail: "Profiles with verification submissions",
            },
            {
              label: "Ready for review",
              value: counts.submittedFields,
              detail: "Submitted fields not yet approved",
              tone: counts.submittedFields > 0 ? "warning" : "good",
            },
            {
              label: "Approved fields",
              value: counts.approvedFields,
              detail: "Approved requirements in this result set",
              tone: "good",
            },
            {
              label: "Missing evidence",
              value: counts.missingFields,
              detail: "Required fields with no submission",
              tone: counts.missingFields > 0 ? "warning" : "good",
            },
          ]}
        />

        <AdminToolbar className="mt-4">
          <div className="relative min-w-0 flex-1 md:max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search person, email, business type, or requirement"
              className="border-white/10 bg-black/20 pl-9 text-white placeholder:text-white/30"
            />
          </div>
          <div className="flex items-center gap-3">
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
            <span className="hidden text-xs text-white/35 xl:inline">
              {filteredRows.length} shown
            </span>
          </div>
        </AdminToolbar>

        {filteredRows.length ? (
          <AdminList className="mt-4">
            {filteredRows.map(({ profile, user }) => {
              const fields = activeFields(profile);
              const submittedCount = fields.filter(
                (field) => fieldState(profile, field) === "submitted"
              ).length;
              const approvedCount = fields.filter(
                (field) => fieldState(profile, field) === "approved"
              ).length;
              const status = overallStatus(profile);

              return (
                <details key={profile.id} className="group">
                  <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(14rem,1fr)_minmax(11rem,0.75fr)_minmax(12rem,0.85fr)_minmax(10rem,0.7fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {profile.userIntent === "business" ? (
                          <Building2 className="h-4 w-4 shrink-0 text-orange-300" />
                        ) : (
                          <UserCheck className="h-4 w-4 shrink-0 text-orange-300" />
                        )}
                        <p className="truncate font-semibold text-white">{displayName(user)}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-white/38">{user.email}</p>
                    </div>

                    <div className="min-w-0 text-sm text-white/58">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                        Profile type
                      </p>
                      <p className="mt-1 truncate">
                        {profile.userIntent === "business"
                          ? readable(profile.businessType || "business")
                          : "Person"}
                      </p>
                    </div>

                    <div className="min-w-0 text-sm text-white/58">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                        Requirements
                      </p>
                      <p className="mt-1">
                        {approvedCount} approved · {submittedCount} ready
                      </p>
                      <p className="mt-1 truncate text-xs text-white/38">
                        {fields.length ? fields.map((field) => FIELD_LABELS[field]).join(", ") : "None required"}
                      </p>
                    </div>

                    <div>{overallStatusBadge(status)}</div>

                    <div className="flex items-center justify-between gap-3 lg:justify-end">
                      <span className="text-xs text-white/35">
                        {submittedCount > 0 ? `${submittedCount} decision${submittedCount === 1 ? "" : "s"}` : "Review"}
                      </span>
                      <ChevronDown className="h-4 w-4 text-white/35 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>

                  <div className="border-t border-white/10 bg-white/[0.018] px-3 py-5 sm:px-4">
                    {fields.length ? (
                      <div className="divide-y divide-white/10 border-y border-white/10">
                        {fields.map((field) => {
                          const state = fieldState(profile, field);
                          const summary = submissionSummary(profile, field);
                          return (
                            <div
                              key={field}
                              className="grid gap-3 px-3 py-4 sm:grid-cols-[2.5rem_minmax(10rem,0.8fr)_minmax(0,1fr)_auto] sm:items-center sm:px-4"
                            >
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.035]">
                                <FieldStateIcon state={state} />
                              </span>
                              <div>
                                <p className="font-semibold text-white">{FIELD_LABELS[field]}</p>
                                <p className="mt-1 text-xs text-white/35">{readable(state)}</p>
                              </div>
                              <p className="min-w-0 truncate text-sm text-white/55">
                                {summary || "Not submitted"}
                              </p>
                              {state === "submitted" ? (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      decisionMutation.mutate({
                                        profileId: profile.id,
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
                                        profileId: profile.id,
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
                                  {state === "approved" ? "Decision complete" : "Waiting for evidence"}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 border-y border-white/10 px-3 py-5 text-sm leading-6 text-white/48">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                        This profile currently declares no required verification fields.
                      </div>
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
