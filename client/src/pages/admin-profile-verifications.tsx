import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileCheck2, Loader2, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ReviewState = "not_submitted" | "pending" | "approved" | "rejected";
type BusinessFieldKey = "businessRegistration" | "license" | "insurance" | "taxDocument";
type UnknownRecord = Record<string, unknown>;

type AddressVerificationItem = Readonly<{
  id: string;
  fullAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  verificationMethod?: string;
  status?: string;
  adminNotes?: string | null;
  createdAt?: string;
  user?: Readonly<{
    email?: string;
    firstName?: string;
    lastName?: string;
  }>;
}>;

type BusinessFieldView = Readonly<{
  key: BusinessFieldKey;
  label: string;
  required: boolean;
  status: ReviewState;
  rejectionReason: string;
  hasEvidence: boolean;
  documentUrl: string;
}>;

const BUSINESS_FIELDS: readonly Readonly<{
  key: BusinessFieldKey;
  label: string;
}>[] = [
  {
    key: "businessRegistration",
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
    key: "taxDocument",
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
  if (status === "approved") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
  if (status === "rejected") return "border-red-500/40 bg-red-500/10 text-red-700";
  if (status === "pending") return "border-amber-500/40 bg-amber-500/10 text-amber-700";
  return "border-stone-300 bg-stone-100 text-stone-700";
}

function rowsFrom(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.map(asRecord);
  const record = asRecord(value);
  for (const key of ["verifications", "items", "results"]) {
    if (Array.isArray(record[key])) return (record[key] as unknown[]).map(asRecord);
  }
  return [];
}

function businessFieldsFor(profile: UnknownRecord): BusinessFieldView[] {
  const fieldReview = asRecord(profile.fieldReview);
  const documentUrls = asRecord(profile.documentUrls);

  return BUSINESS_FIELDS.map((config) => {
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
  const [businessStatusFilter, setBusinessStatusFilter] = useState("pending");
  const [addressNotes, setAddressNotes] = useState<Record<string, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const addressEndpoint = `/api/admin/address-verifications?status=${encodeURIComponent(statusFilter)}`;
  const businessEndpoint = `/api/admin/profile-verifications?status=${encodeURIComponent(businessStatusFilter)}`;

  const {
    data: addressData,
    isLoading: loadingAddresses,
    error: addressError,
  } = useQuery<unknown>({
    queryKey: [addressEndpoint],
    queryFn: () => apiRequest("GET", addressEndpoint),
    retry: false,
  });

  const {
    data: businessData,
    isLoading: loadingBusinesses,
    error: businessError,
  } = useQuery<unknown>({
    queryKey: [businessEndpoint],
    queryFn: () => apiRequest("GET", businessEndpoint),
    retry: false,
  });

  const addressDecision = useMutation({
    mutationFn: ({
      id,
      status,
      adminNotes,
    }: {
      id: string;
      status: "approved" | "rejected";
      adminNotes: string;
    }) =>
      apiRequest("PUT", `/api/admin/address-verifications/${id}`, {
        status,
        adminNotes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [addressEndpoint] });
      toast({ title: "Address decision saved" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Could not save address decision",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const businessDecision = useMutation({
    mutationFn: ({
      id,
      fieldKey,
      status,
      rejectionReason,
    }: {
      id: string;
      fieldKey: BusinessFieldKey;
      status: "approved" | "rejected";
      rejectionReason: string;
    }) =>
      apiRequest("PUT", `/api/admin/profile-verifications/${id}`, {
        field: fieldKey,
        decision: status,
        ...(status === "rejected" ? { rejectionReason } : {}),
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
    id: string,
    fieldKey: BusinessFieldKey,
    status: "approved" | "rejected"
  ) => {
    const reasonKey = `${id}:${fieldKey}`;
    const rejectionReason = stringValue(rejectionReasons[reasonKey]);
    if (status === "rejected" && (rejectionReason.length < 12 || rejectionReason.length > 1000)) {
      toast({
        title: "Valid rejection reason required",
        description: "Use 12 to 1000 characters and explain what the owner must correct.",
        variant: "destructive",
      });
      return;
    }
    businessDecision.mutate({
      id,
      fieldKey,
      status,
      rejectionReason: status === "rejected" ? rejectionReason : "",
    });
  };

  const addresses = rowsFrom(addressData) as AddressVerificationItem[];
  const businesses = Array.isArray(businessData) ? businessData.map(asRecord) : [];

  return (
    <div className="space-y-8 px-4 py-5 md:px-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Profile verifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review address records and the specific business evidence submitted by owners.
        </p>
      </header>

      <section
        data-testid="admin-address-verifications-v2"
        className="space-y-4 rounded-xl border border-border bg-card/60 p-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Address and identity queue</h2>
            <p className="text-sm text-muted-foreground">
              Approve complete records or leave a clear correction note.
            </p>
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Status</span>
            <select
              className="h-10 rounded-md border border-input bg-background px-3"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        {loadingAddresses ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading address records...
          </p>
        ) : addressError ? (
          <p className="text-sm text-red-700">
            {formatUserFacingErrorMessage(addressError, "Could not load address records.")}
          </p>
        ) : addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No address records match this filter.</p>
        ) : (
          <div className="space-y-3">
            {addresses.map((item) => {
              const notes = addressNotes[item.id] ?? item.adminNotes ?? "";
              return (
                <article
                  key={item.id}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {[item.user?.firstName, item.user?.lastName].filter(Boolean).join(" ") ||
                          item.user?.email ||
                          "Account owner"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[item.fullAddress, item.city, item.state, item.zipCode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                    <Badge variant="outline">{item.status || "pending"}</Badge>
                  </div>
                  <Input
                    className="mt-3"
                    aria-label="Address decision notes"
                    placeholder="Decision notes"
                    value={notes}
                    onChange={(event) =>
                      setAddressNotes((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={addressDecision.isPending}
                      onClick={() =>
                        addressDecision.mutate({
                          id: item.id,
                          status: "approved",
                          adminNotes: notes,
                        })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={addressDecision.isPending || !notes.trim()}
                      onClick={() =>
                        addressDecision.mutate({
                          id: item.id,
                          status: "rejected",
                          adminNotes: notes,
                        })
                      }
                    >
                      Reject
                    </Button>
                    <span className="self-center text-xs text-muted-foreground">Save decision</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section
        data-testid="admin-business-verifications-v2"
        className="space-y-4 rounded-xl border border-border bg-card/60 p-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="h-5 w-5 text-ts-orange" />
              Business verification queue
            </h2>
            <p className="text-sm text-muted-foreground">
              Review each requested item separately. Documents open through authenticated links.
            </p>
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Status</span>
            <select
              className="h-10 rounded-md border border-input bg-background px-3"
              value={businessStatusFilter}
              onChange={(event) => setBusinessStatusFilter(event.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="approved">Approved</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        {loadingBusinesses ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading business records...
          </p>
        ) : businessError ? (
          <p className="text-sm text-red-700">
            {formatUserFacingErrorMessage(businessError, "Could not load business records.")}
          </p>
        ) : businesses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No business records match this filter.</p>
        ) : (
          <div className="space-y-4">
            {businesses.map((item) => {
              const profile = asRecord(item.profile);
              const user = asRecord(item.user);
              const id = stringValue(profile.id);
              const submissions = asRecord(profile.verificationSubmissions);
              const maskedTaxId = stringValue(submissions.taxId);
              const fields = businessFieldsFor(profile);
              return (
                <article key={id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {stringValue(profile.displayName || profile.name) || "Business"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Owner: {stringValue(user.email) || "Not provided"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Tax ID: {maskedTaxId || "Not provided"}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {stringValue(
                        profile.overallStatus || profile.verificationStatus || profile.status
                      ) || "pending"}
                    </Badge>
                  </div>

                  {fields.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No reviewable evidence is attached.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {fields.map((field) => {
                        const reasonKey = `${id}:${field.key}`;
                        const draftReason =
                          rejectionReasons[reasonKey] ?? field.rejectionReason ?? "";
                        return (
                          <div
                            key={field.key}
                            className="rounded-md border border-border bg-muted/20 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h4 className="font-medium">{field.label}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {field.required ? "Required evidence" : "Additional evidence"}
                                </p>
                              </div>
                              <Badge variant="outline" className={statusClasses(field.status)}>
                                {statusLabel(field.status)}
                              </Badge>
                            </div>

                            {field.rejectionReason ? (
                              <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">
                                Previous reason: {field.rejectionReason}
                              </p>
                            ) : null}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {field.hasEvidence ? (
                                <a
                                  href={evidenceHref(id, field.key, field.documentUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex min-h-9 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted"
                                >
                                  <FileCheck2 className="h-4 w-4" />
                                  View secure evidence
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  No document submitted
                                </span>
                              )}
                            </div>

                            <Textarea
                              className="mt-3"
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
                                size="sm"
                                disabled={!field.hasEvidence || businessDecision.isPending}
                                onClick={() => submitBusinessDecision(id, field.key, "approved")}
                              >
                                Approve item
                              </Button>
                              <Button
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
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
