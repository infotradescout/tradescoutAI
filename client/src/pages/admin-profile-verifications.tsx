import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  RefreshCw,
  Search,
  ShieldCheck,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type RequirementFieldKey = "license" | "insurance" | "tax_id" | "business_registration";
type ReviewState = "not_required" | "not_submitted" | "pending" | "approved" | "rejected";
type UnknownRecord = Record<string, unknown>;

type BusinessFieldView = Readonly<{
  key: RequirementFieldKey;
  label: string;
  description: string;
  required: boolean;
  status: ReviewState;
  rejectionReason: string;
  documentUrl: string;
  hasEvidence: boolean;
  canReview: boolean;
}>;

export const REQUIREMENT_FIELDS: readonly Readonly<{
  key: RequirementFieldKey;
  label: string;
  description: string;
}>[] = [
  {
    key: "business_registration",
    label: "Business registration",
    description: "Registration evidence for the legal business record.",
  },
  {
    key: "license",
    label: "Business or trade license",
    description: "License number or supporting license document.",
  },
  {
    key: "insurance",
    label: "Insurance certificate",
    description: "Current coverage evidence submitted by the owner.",
  },
  {
    key: "tax_id",
    label: "Tax ID",
    description: "Masked tax identifier or supporting tax document.",
  },
];

const FILTER_STATUSES = ["pending", "under_review", "approved", "rejected"] as const;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function rowsFrom(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.map(asRecord);
  const record = asRecord(value);
  for (const key of ["verifications", "items", "results"]) {
    if (Array.isArray(record[key])) return (record[key] as unknown[]).map(asRecord);
  }
  return [];
}

function readable(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeState(value: unknown, required: boolean): ReviewState {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "approved" || normalized === "verified" || normalized === "complete") {
    return "approved";
  }
  if (normalized === "rejected" || normalized === "denied" || normalized === "changes_required") {
    return "rejected";
  }
  if (normalized === "pending" || normalized === "submitted" || normalized === "under_review") {
    return "pending";
  }
  return required ? "not_submitted" : "not_required";
}

function statusLabel(status: ReviewState): string {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "pending") return "Pending review";
  if (status === "not_required") return "Not required";
  return "Not submitted";
}

function statusClasses(status: ReviewState): string {
  if (status === "approved") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "rejected") return "border-red-400/30 bg-red-400/10 text-red-200";
  if (status === "pending") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-white/12 bg-white/[0.035] text-white/50";
}

function formatDate(value: unknown): string {
  if (!value) return "Not recorded";
  const parsed = new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) return "Not recorded";
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function verifiedField(profile: UnknownRecord, key: RequirementFieldKey): boolean {
  const property: Record<RequirementFieldKey, string> = {
    license: "license_verified",
    insurance: "insurance_verified",
    tax_id: "tax_id_verified",
    business_registration: "business_registration_verified",
  };
  return profile[property[key]] === true;
}

export function businessFieldsFor(profile: UnknownRecord): BusinessFieldView[] {
  const requirements = asRecord(profile.verificationRequirements);
  const fieldReview = asRecord(profile.fieldReview);
  const documentUrls = asRecord(profile.documentUrls);
  const submissions = asRecord(profile.verificationSubmissions);

  return REQUIREMENT_FIELDS.map((config) => {
    const review = asRecord(fieldReview[config.key]);
    const required = review.required === true || requirements[config.key] === true;
    const documentUrl = stringValue(documentUrls[config.key]);
    const scalarEvidence =
      (config.key === "license" && Boolean(stringValue(submissions.licenseNumber))) ||
      (config.key === "tax_id" && Boolean(stringValue(submissions.taxId)));
    const hasEvidence = Boolean(documentUrl) || scalarEvidence;
    const status = verifiedField(profile, config.key)
      ? "approved"
      : normalizeState(review.status || review.reviewStatus, required);
    const rejectionReason = stringValue(review.rejectionReason);

    return {
      ...config,
      required,
      status,
      rejectionReason,
      documentUrl,
      hasEvidence,
      canReview: hasEvidence || status === "approved" || status === "rejected",
    };
  }).filter(
    (field) =>
      field.required ||
      field.hasEvidence ||
      field.status === "approved" ||
      field.status === "rejected"
  );
}

function evidenceHref(documentUrl: string): string {
  return /^https?:\/\//i.test(documentUrl) ? documentUrl : buildApiUrl(documentUrl);
}

export default function AdminProfileVerificationsPage() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const endpoint = `/api/admin/profile-verifications?status=${encodeURIComponent(statusFilter)}`;

  const verificationsQuery = useQuery<unknown>({
    queryKey: ["/api/admin/profile-verifications", statusFilter],
    queryFn: () => apiRequest("GET", endpoint),
    retry: false,
  });

  const businessDecision = useMutation({
    mutationFn: ({
      profileId,
      field,
      decision,
      rejectionReason,
    }: {
      profileId: string;
      field: RequirementFieldKey;
      decision: "approved" | "rejected";
      rejectionReason?: string;
    }) =>
      apiRequest("PUT", `/api/admin/profile-verifications/${profileId}`, {
        field,
        ...(decision === "approved"
          ? { decision: "approved" }
          : { decision: "rejected", rejectionReason }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/profile-verifications"] });
      toast({
        title: "Business verification decision saved",
        description: "The selected requirement was updated independently.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Business verification decision was not saved",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const submitBusinessDecision = (
    profileId: string,
    field: RequirementFieldKey,
    decision: "approved" | "rejected"
  ) => {
    const reasonKey = `${profileId}:${field}`;
    const rejectionReason = stringValue(rejectionReasons[reasonKey]);
    if (decision === "rejected" && (rejectionReason.length < 12 || rejectionReason.length > 1000)) {
      toast({
        title: "Valid rejection reason required",
        description: "Use 12 to 1000 characters and explain what the owner must correct.",
        variant: "destructive",
      });
      return;
    }
    businessDecision.mutate({
      profileId,
      field,
      decision,
      ...(decision === "rejected" ? { rejectionReason } : {}),
    });
  };

  const businesses = useMemo(() => rowsFrom(verificationsQuery.data), [verificationsQuery.data]);
  const profileRows = useMemo(
    () =>
      businesses.map((item) => {
        const profile = asRecord(item.profile);
        const user = asRecord(item.user);
        return { profile, user, fields: businessFieldsFor(profile) };
      }),
    [businesses]
  );
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return profileRows;
    return profileRows.filter(({ profile, user }) =>
      [
        profile.displayName,
        profile.name,
        profile.businessType,
        user.email,
        user.firstName,
        user.lastName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [profileRows, search]);
  const allFields = profileRows.flatMap((row) => row.fields);
  const counts = {
    profiles: profileRows.length,
    reviewable: allFields.filter((field) => field.status === "pending" && field.canReview).length,
    approved: allFields.filter((field) => field.status === "approved").length,
    rejected: allFields.filter((field) => field.status === "rejected").length,
  };

  if (verificationsQuery.isLoading) {
    return (
      <AdminWorkspace data-testid="admin-business-verifications-v2">
        <div className="flex min-h-64 items-center justify-center border-y border-white/10 text-sm text-white/50">
          <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
          Loading business verifications…
        </div>
      </AdminWorkspace>
    );
  }

  if (verificationsQuery.isError) {
    return (
      <AdminWorkspace data-testid="admin-business-verifications-v2">
        <AdminEmptyState
          title="Business verification queue unavailable"
          description="The queue could not be read. No verification state was changed."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => verificationsQuery.refetch()}
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
        description="Approve or reject each required field independently. Evidence links stay authenticated, and every rejection must explain what the owner needs to correct."
        className="pt-0"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => verificationsQuery.refetch()}
              disabled={verificationsQuery.isFetching}
              className="border-white/12 bg-white/[0.025] text-white/65 hover:bg-white/[0.06] hover:text-white"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${verificationsQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/12 bg-transparent text-white/65"
            >
              <Link href="/admin/address-verifications">Address &amp; identity queue</Link>
            </Button>
          </>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Profiles",
              value: counts.profiles,
              detail: "Businesses in the current server filter",
            },
            {
              label: "Ready to review",
              value: counts.reviewable,
              detail: "Submitted fields with reviewable evidence",
              tone: counts.reviewable > 0 ? "warning" : "good",
            },
            {
              label: "Approved fields",
              value: counts.approved,
              detail: "Requirements approved independently",
              tone: "good",
            },
            {
              label: "Rejected fields",
              value: counts.rejected,
              detail: "Requirements waiting for correction",
              tone: counts.rejected > 0 ? "danger" : "neutral",
            },
          ]}
        />

        <AdminToolbar className="mt-4">
          <div className="relative min-w-0 flex-1 md:max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search business, owner, email, or business type"
              className="border-white/10 bg-black/20 pl-9 text-white placeholder:text-white/30"
            />
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[12rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {FILTER_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {readable(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="hidden text-xs text-white/35 xl:inline">
              {filteredRows.length} shown
            </span>
          </div>
        </AdminToolbar>

        {filteredRows.length ? (
          <AdminList className="mt-4">
            {filteredRows.map(({ profile, user, fields }) => {
              const profileId = stringValue(profile.id);
              const submissions = asRecord(profile.verificationSubmissions);
              const maskedTaxId = stringValue(submissions.taxId);
              const licenseNumber = stringValue(submissions.licenseNumber);
              const overallStatus =
                stringValue(profile.verificationStatus || profile.status) || "pending";
              return (
                <div key={profileId} className="px-3 py-5 sm:px-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(12rem,0.65fr)_auto] lg:items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-orange-300" />
                        <h3 className="truncate font-semibold text-white">
                          {stringValue(profile.displayName || profile.name) || "Business"}
                        </h3>
                      </div>
                      <p className="mt-1 truncate text-xs text-white/40">
                        Owner: {stringValue(user.email) || "Not provided"}
                      </p>
                      <p className="mt-1 text-xs text-white/35">
                        Updated {formatDate(profile.updatedAt)}
                      </p>
                    </div>
                    <div className="text-sm text-white/55">
                      <p>License: {licenseNumber || "Not provided"}</p>
                      <p className="mt-1">Tax ID: {maskedTaxId || "Not provided"}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={statusClasses(normalizeState(overallStatus, true))}
                    >
                      {readable(overallStatus)}
                    </Badge>
                  </div>

                  {fields.length ? (
                    <div className="mt-5 grid gap-3 xl:grid-cols-2">
                      {fields.map((field) => {
                        const reasonKey = `${profileId}:${field.key}`;
                        const draftReason = rejectionReasons[reasonKey] ?? field.rejectionReason;
                        const validReason =
                          draftReason.trim().length >= 12 && draftReason.trim().length <= 1000;
                        return (
                          <section
                            key={field.key}
                            className="border border-white/10 bg-white/[0.022] p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="font-medium text-white">{field.label}</h4>
                                <p className="mt-1 text-xs leading-5 text-white/42">
                                  {field.description}
                                </p>
                              </div>
                              <Badge variant="outline" className={statusClasses(field.status)}>
                                {statusLabel(field.status)}
                              </Badge>
                            </div>

                            <div className="mt-3 flex min-h-9 items-center">
                              {field.documentUrl ? (
                                <a
                                  href={evidenceHref(field.documentUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex min-h-9 items-center gap-2 border border-white/12 px-3 text-sm font-medium text-white/65 transition hover:bg-white/[0.05] hover:text-white"
                                >
                                  <FileCheck2 className="h-4 w-4" />
                                  View secure evidence
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : field.hasEvidence ? (
                                <span className="inline-flex items-center gap-2 text-sm text-white/55">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                                  Submitted value available above
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2 text-sm text-white/38">
                                  <AlertTriangle className="h-4 w-4" />
                                  No evidence submitted
                                </span>
                              )}
                            </div>

                            {field.rejectionReason ? (
                              <p className="mt-3 border-l-2 border-red-300/35 bg-red-300/[0.055] px-3 py-2 text-sm leading-6 text-red-100/75">
                                Previous reason: {field.rejectionReason}
                              </p>
                            ) : null}

                            <div className="mt-3 space-y-2">
                              <Label
                                htmlFor={`rejection-${profileId}-${field.key}`}
                                className="text-xs text-white/45"
                              >
                                Seller-facing rejection reason
                              </Label>
                              <Textarea
                                id={`rejection-${profileId}-${field.key}`}
                                value={draftReason}
                                maxLength={1000}
                                placeholder="Required when rejecting: explain exactly what must be corrected"
                                onChange={(event) =>
                                  setRejectionReasons((current) => ({
                                    ...current,
                                    [reasonKey]: event.target.value,
                                  }))
                                }
                                className="min-h-24 border-white/10 bg-black/20 text-white placeholder:text-white/28"
                              />
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={!field.canReview || businessDecision.isPending}
                                onClick={() =>
                                  submitBusinessDecision(profileId, field.key, "approved")
                                }
                                className="bg-emerald-500 text-black hover:bg-emerald-400"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={
                                  !field.canReview || businessDecision.isPending || !validReason
                                }
                                onClick={() =>
                                  submitBusinessDecision(profileId, field.key, "rejected")
                                }
                                className="border-red-300/20 bg-transparent text-red-100 hover:bg-red-300/10"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-5 text-sm text-white/42">
                      No required business evidence is available for review.
                    </div>
                  )}
                </div>
              );
            })}
          </AdminList>
        ) : (
          <AdminEmptyState
            title="No business verification records"
            description="No businesses match the current server status and search filters."
          />
        )}
      </AdminSection>
    </AdminWorkspace>
  );
}
