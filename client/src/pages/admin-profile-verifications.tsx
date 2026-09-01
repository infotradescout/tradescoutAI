import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileCheck2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ReviewState = "not_submitted" | "pending" | "approved" | "rejected";
type BusinessFieldKey = "business_registration" | "license" | "insurance" | "tax_id";
type UnknownRecord = Record<string, unknown>;

type BusinessFieldView = Readonly<{
  key: BusinessFieldKey;
  label: string;
  required: boolean;
  status: ReviewState;
  rejectionReason: string;
  hasEvidence: boolean;
  documentUrl: string;
}>;

const REQUIREMENT_FIELDS: readonly Readonly<{
  key: BusinessFieldKey;
  label: string;
}>[] = [
  {
    key: "business_registration",
    label: "Business registration",
  },
  {
    key: "license",
    label: "Business or trade license",
  },
  {
    key: "insurance",
    label: "Insurance certificate",
  },
  {
    key: "tax_id",
    label: "Tax document",
  },
];

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}
function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeState(value: unknown): ReviewState {
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
  return "not_submitted";
}

function statusLabel(status: ReviewState): string {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "pending") return "Pending review";
  return "Not submitted";
}

function statusClasses(status: ReviewState): string {
  if (status === "approved") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "rejected") return "border-red-400/30 bg-red-400/10 text-red-200";
  if (status === "pending") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-white/15 bg-white/5 text-white/45";
}

function businessFieldsFor(profile: UnknownRecord): BusinessFieldView[] {
  const fieldReview = asRecord(profile.fieldReview);
  const documentUrls = asRecord(profile.documentUrls);

  return REQUIREMENT_FIELDS.map((config) => {
    const rawField = asRecord(fieldReview[config.key]);
    const required = rawField.required === true;
    const documentUrl = stringValue(documentUrls[config.key]);
    const explicitState = normalizeState(rawField.reviewStatus || rawField.status);
    const status: ReviewState =
      explicitState !== "not_submitted"
        ? explicitState
        : rawField.approved === true
          ? "approved"
          : documentUrl
            ? "pending"
            : "not_submitted";
    const rejectionReason = stringValue(rawField.rejectionReason);

    return {
      key: config.key,
      label: config.label,
      required,
      status,
      rejectionReason,
      hasEvidence: Boolean(documentUrl),
      documentUrl,
    };
  }).filter(
    (field) =>
      field.required ||
      field.hasEvidence ||
      field.status !== "not_submitted" ||
      Boolean(field.rejectionReason)
  );
}

function evidenceHref(profileId: string, fieldKey: BusinessFieldKey, documentUrl: string): string {
  const path =
    documentUrl ||
    `/api/admin/profile-verifications/${encodeURIComponent(profileId)}/documents/${encodeURIComponent(
      fieldKey
    )}`;
  return /^https?:\/\//i.test(path) ? path : buildApiUrl(path);
}

export default function AdminProfileVerificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const businessEndpoint = `/api/admin/profile-verifications?status=${encodeURIComponent(statusFilter)}`;

  const businessQuery = useQuery<unknown>({
    queryKey: [businessEndpoint],
    queryFn: () => apiRequest("GET", businessEndpoint),
    retry: false,
  });

  const businessDecision = useMutation({
    mutationFn: ({
      profileId,
      fieldKey,
      decision,
      rejectionReason,
    }: {
      profileId: string;
      fieldKey: BusinessFieldKey;
      decision: "approved" | "rejected";
      rejectionReason: string;
    }) =>
      apiRequest("PUT", `/api/admin/profile-verifications/${profileId}`, {
        field: fieldKey,
        decision,
        ...(decision === "rejected" ? { rejectionReason } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [businessEndpoint] });
      toast({ title: "Business verification decision saved" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Could not save business verification decision",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const submitBusinessDecision = (
    profileId: string,
    fieldKey: BusinessFieldKey,
    decision: "approved" | "rejected"
  ) => {
    const reasonKey = `${profileId}:${fieldKey}`;
    const rejectionReason = stringValue(rejectionReasons[reasonKey]);
    if (
      decision === "rejected" &&
      (rejectionReason.length < 12 || rejectionReason.length > 1000)
    ) {
      toast({
        title: "Valid rejection reason required",
        description: "Use 12 to 1000 characters and explain what the owner must correct.",
        variant: "destructive",
      });
      return;
    }
    businessDecision.mutate({
      profileId,
      fieldKey,
      decision,
      rejectionReason: decision === "rejected" ? rejectionReason : "",
    });
  };

  const businesses = Array.isArray(businessQuery.data) ? businessQuery.data.map(asRecord) : [];
  const reviewFields = businesses.flatMap((item) => businessFieldsFor(asRecord(item.profile)));

  if (businessQuery.isLoading) {
    return (
      <AdminWorkspace>
        <div className="flex min-h-64 items-center justify-center border-y border-white/10 text-sm text-white/50">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Loading business verification submissions…
        </div>
      </AdminWorkspace>
    );
  }

  if (businessQuery.isError) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Business verification queue unavailable"
          description={formatUserFacingErrorMessage(
            businessQuery.error,
            "The submission queue could not be read. No verification decision was changed."
          )}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => businessQuery.refetch()}
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
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-orange-300" />
            Business verification queue
          </span>
        }
        description="Approve or reject each required field independently. Documents open through authenticated links, and rejections require a clear correction reason."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => businessQuery.refetch()}
            disabled={businessQuery.isFetching}
            className="border-white/12 bg-white/[0.025] text-white/65 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${businessQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Profiles",
              value: businesses.length,
              detail: "Profiles in the current status view",
            },
            {
              label: "Ready for review",
              value: reviewFields.filter(
                (field) => field.status === "pending" && field.hasEvidence
              ).length,
              detail: "Submitted evidence awaiting a decision",
              tone: "warning",
            },
            {
              label: "Approved fields",
              value: reviewFields.filter((field) => field.status === "approved").length,
              detail: "Approved requirements in this result set",
              tone: "good",
            },
            {
              label: "Rejected fields",
              value: reviewFields.filter((field) => field.status === "rejected").length,
              detail: "Requirements awaiting corrected evidence",
              tone: reviewFields.some((field) => field.status === "rejected")
                ? "danger"
                : "neutral",
            },
          ]}
        />

        <AdminToolbar className="mt-4">
          <p className="text-sm text-white/48">
            Only submitted evidence can be approved or rejected. Missing evidence remains pending.
          </p>
          <label className="text-sm text-white/55">
            <span className="mr-2">Overall status</span>
            <select
              className="h-10 rounded-md border border-white/10 bg-black/20 px-3 text-white"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="approved">Approved</option>
              <option value="all">All</option>
            </select>
          </label>
        </AdminToolbar>

        {businesses.length ? (
          <AdminList className="mt-4">
            {businesses.map((item) => {
              const profile = asRecord(item.profile);
              const user = asRecord(item.user);
              const id = stringValue(profile.id);
              const submissions = asRecord(profile.verificationSubmissions);
              const maskedTaxId = stringValue(submissions.taxId);
              const fields = businessFieldsFor(profile);
              return (
                <details key={id} className="group">
                  <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(12rem,0.7fr)_minmax(9rem,0.45fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                    <div>
                      <h3 className="font-semibold text-white">
                        {stringValue(profile.displayName || profile.name) || "Business"}
                      </h3>
                      <p className="mt-1 text-sm text-white/42">
                        Owner: {stringValue(user.email) || "Not provided"}
                      </p>
                    </div>
                    <p className="text-sm text-white/48">
                      Tax ID: {maskedTaxId || "Not provided"}
                    </p>
                    <p className="text-sm text-white/48">
                      {fields.filter((field) => field.hasEvidence).length} submitted item
                      {fields.filter((field) => field.hasEvidence).length === 1 ? "" : "s"}
                    </p>
                    <Badge variant="outline" className="justify-self-start lg:justify-self-end">
                      {stringValue(
                        profile.overallStatus || profile.verificationStatus || profile.status
                      ) || "pending"}
                    </Badge>
                  </summary>

                  {fields.length === 0 ? (
                    <p className="border-t border-white/10 px-4 py-5 text-sm text-white/45">
                      No reviewable evidence is attached.
                    </p>
                  ) : (
                    <div className="divide-y divide-white/10 border-t border-white/10 bg-white/[0.015] px-3 sm:px-4">
                      {fields.map((field) => {
                        const reasonKey = `${id}:${field.key}`;
                        const draftReason =
                          rejectionReasons[reasonKey] ?? field.rejectionReason ?? "";
                        return (
                          <div key={field.key} className="py-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h4 className="font-medium text-white">{field.label}</h4>
                                <p className="text-xs text-white/38">
                                  {field.required ? "Required evidence" : "Additional evidence"}
                                </p>
                              </div>
                              <Badge variant="outline" className={statusClasses(field.status)}>
                                {statusLabel(field.status)}
                              </Badge>
                            </div>

                            {field.rejectionReason ? (
                              <p className="mt-2 border-y border-red-400/25 bg-red-400/5 px-3 py-2 text-sm text-red-100">
                                Previous reason: {field.rejectionReason}
                              </p>
                            ) : null}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {field.hasEvidence ? (
                                <a
                                  href={evidenceHref(id, field.key, field.documentUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/15 px-3 text-sm font-medium text-white/65 hover:bg-white/[0.05] hover:text-white"
                                >
                                  <FileCheck2 className="h-4 w-4" />
                                  View secure evidence
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                <span className="text-sm text-white/38">
                                  No document submitted
                                </span>
                              )}
                            </div>

                            <Textarea
                              className="mt-3 border-white/10 bg-black/20 text-white placeholder:text-white/28"
                              maxLength={1000}
                              aria-label={`Rejection reason for ${field.label}`}
                              placeholder="Required when rejecting: explain what must be corrected"
                              value={draftReason}
                              onChange={(event) =>
                                setRejectionReasons((current) => ({
                                  ...current,
                                  [reasonKey]: event.target.value,
                                }))
                              }
                            />

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={!field.hasEvidence || businessDecision.isPending}
                                onClick={() => submitBusinessDecision(id, field.key, "approved")}
                              >
                                Approve item
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={
                                  !field.hasEvidence ||
                                  businessDecision.isPending ||
                                  draftReason.trim().length < 12 ||
                                  draftReason.trim().length > 1000
                                }
                                onClick={() => submitBusinessDecision(id, field.key, "rejected")}
                              >
                                Reject item
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </details>
              );
            })}
          </AdminList>
        ) : (
          <AdminEmptyState
            title="No business verification submissions match this status"
            description="Choose another overall status to inspect a different part of the queue."
          />
        )}
      </AdminSection>
    </AdminWorkspace>
  );
}
