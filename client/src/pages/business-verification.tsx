import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, FileCheck2, Loader2, UploadCloud } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import { isSafeNextPath } from "@/lib/postOnboardingRoute";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EvidenceKey = "businessRegistration" | "license" | "insurance" | "taxDocument";
type ReviewState = "not_submitted" | "pending" | "approved" | "rejected";

type FieldReview = Readonly<{
  required?: boolean;
  status?: string;
  reviewStatus?: string;
  rejectionReason?: string | null;
  objectKey?: string | null;
}>;

type ProfileVerificationResponse = Readonly<{
  profileId?: string;
  displayName?: string;
  verificationBypassActive?: boolean;
  verificationStatus?: string;
  overallStatus?: string;
  status?: string | Record<string, boolean | string | undefined>;
  fieldReview?: Partial<Record<EvidenceKey, FieldReview>>;
  rejectionReason?: string | null;
  rejectionReasons?: Partial<Record<EvidenceKey, string | null>>;
}>;

type EvidenceSpec = Readonly<{
  key: EvidenceKey;
  label: string;
  help: string;
  payloadKey: string;
}>;

const EVIDENCE: readonly EvidenceSpec[] = [
  {
    key: "businessRegistration",
    label: "Business registration",
    help: "Upload the current registration or formation document for the business.",
    payloadKey: "businessRegistrationDocObjectKey",
  },
  {
    key: "license",
    label: "Business or trade license",
    help: "Upload the active license requested for this business.",
    payloadKey: "licenseDocObjectKey",
  },
  {
    key: "insurance",
    label: "Insurance certificate",
    help: "Upload the current certificate requested for this business.",
    payloadKey: "insuranceDocObjectKey",
  },
  {
    key: "taxDocument",
    label: "Tax document",
    help: "Upload the requested tax document. Enter only the last four digits of the Tax ID.",
    payloadKey: "taxDocumentObjectKey",
  },
];

function normalizeState(value: unknown): ReviewState {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
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

function sanitizeLastFour(value: unknown): string {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(-4);
}

function parsePageQuery(location: string): URLSearchParams {
  const index = location.indexOf("?");
  return new URLSearchParams(index >= 0 ? location.slice(index + 1) : "");
}

function requiredFor(data: ProfileVerificationResponse | undefined, spec: EvidenceSpec): boolean {
  return data?.fieldReview?.[spec.key]?.required === true;
}

function stateFor(data: ProfileVerificationResponse | undefined, spec: EvidenceSpec): ReviewState {
  const field = data?.fieldReview?.[spec.key];
  return normalizeState(field?.reviewStatus || field?.status);
}

function reasonFor(data: ProfileVerificationResponse | undefined, spec: EvidenceSpec): string {
  return String(
    data?.fieldReview?.[spec.key]?.rejectionReason || data?.rejectionReasons?.[spec.key] || ""
  ).trim();
}

function stateLabel(state: ReviewState): string {
  if (state === "approved") return "Approved";
  if (state === "rejected") return "Changes needed";
  if (state === "pending") return "Submitted";
  return "Required";
}

function stateClasses(state: ReviewState): string {
  if (state === "approved") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
  if (state === "rejected") return "border-red-500/40 bg-red-500/10 text-red-700";
  if (state === "pending") return "border-amber-500/40 bg-amber-500/10 text-amber-700";
  return "border-stone-300 bg-stone-100 text-stone-700";
}

export default function BusinessVerificationPage() {
  const [location, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useMemo(() => parsePageQuery(location), [location]);
  const requestedBusinessProfileId = String(params.get("businessProfileId") || "").trim();
  const requestedNext = String(params.get("next") || "").trim();
  const safeNext = isSafeNextPath(requestedNext) ? requestedNext : "";
  const endpoint = requestedBusinessProfileId
    ? `/api/profile/verification?businessProfileId=${encodeURIComponent(requestedBusinessProfileId)}`
    : "/api/profile/verification";

  const [licenseNumber, setLicenseNumber] = useState("");
  const [taxIdLast4, setTaxIdLast4] = useState("");
  const [uploading, setUploading] = useState<EvidenceKey | null>(null);

  const { data, isLoading, error } = useQuery<ProfileVerificationResponse>({
    queryKey: [endpoint],
    queryFn: () => apiRequest("GET", endpoint),
    enabled: isAuthenticated,
    retry: false,
  });

  const effectiveBusinessProfileId = String(
    data?.profileId || requestedBusinessProfileId || ""
  ).trim();
  const requiredEvidence = useMemo(
    () => EVIDENCE.filter((spec) => requiredFor(data, spec)),
    [data]
  );
  const bypassActive = data?.verificationBypassActive === true;
  const overallState = normalizeState(
    data?.overallStatus ||
      data?.verificationStatus ||
      (typeof data?.status === "string" ? data.status : "")
  );

  const patchMutation = useMutation({
    mutationFn: (payload: Record<string, string>) =>
      apiRequest("PATCH", "/api/profile/verification", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  const basePayload = (): Record<string, string> =>
    effectiveBusinessProfileId ? { businessProfileId: effectiveBusinessProfileId } : {};

  const uploadEvidence = async (spec: EvidenceSpec, file: File) => {
    if (bypassActive) return;
    if (spec.key === "license" && !licenseNumber.trim()) {
      toast({
        title: "Enter the license number",
        description: "Enter the license number before uploading the license document.",
        variant: "destructive",
      });
      return;
    }
    if (spec.key === "taxDocument" && taxIdLast4.length !== 4) {
      toast({
        title: "Enter the last four digits",
        description: "Enter exactly four digits before uploading the tax document.",
        variant: "destructive",
      });
      return;
    }

    setUploading(spec.key);
    try {
      const uploaded = await uploadPrivateObject(file);
      await patchMutation.mutateAsync({
        ...basePayload(),
        [spec.payloadKey]: uploaded.objectKey,
        ...(spec.key === "license" ? { licenseNumber: licenseNumber.trim() } : {}),
        ...(spec.key === "taxDocument" ? { taxIdLast4 } : {}),
      });
      toast({ title: `${spec.label} submitted for review` });
    } catch (uploadError) {
      toast({
        title: "Upload failed",
        description: formatUserFacingErrorMessage(uploadError, "Could not submit this document."),
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const saveTaxIdLast4 = async () => {
    if (bypassActive || taxIdLast4.length !== 4) return;
    try {
      await patchMutation.mutateAsync({ ...basePayload(), taxIdLast4 });
      toast({ title: "Tax ID last four saved" });
    } catch (saveError) {
      toast({
        title: "Could not save",
        description: formatUserFacingErrorMessage(saveError, "Please try again."),
        variant: "destructive",
      });
    }
  };

  if (!isAuthenticated) {
    const signInParams = new URLSearchParams({ mode: "signin", next: location });
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Business verification</CardTitle>
            <CardDescription>Sign in as the business owner to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(`/pre-scout-setup?${signInParams.toString()}`)}>
              Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading business verification...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle>Business verification is unavailable</CardTitle>
            <CardDescription>
              {formatUserFacingErrorMessage(error, "Please try again shortly.")}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (bypassActive) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card className="border-emerald-500/30">
          <CardHeader>
            <CardTitle>Business verification</CardTitle>
            <CardDescription>Verification is not required for this account.</CardDescription>
          </CardHeader>
          {safeNext ? (
            <CardContent>
              <Button onClick={() => navigate(safeNext)}>
                Return to {data.displayName || "profile"}
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:py-12">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Verify {data.displayName || "your business"}</CardTitle>
              <CardDescription className="mt-2">
                Submit only the items requested below. Files are private and available only to
                reviewers.
              </CardDescription>
            </div>
            <Badge variant="outline" className={stateClasses(overallState)}>
              {stateLabel(overallState)}
            </Badge>
          </div>
          {overallState === "rejected" && data.rejectionReason ? (
            <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
              {data.rejectionReason}
            </p>
          ) : null}
        </CardHeader>
      </Card>

      {requiredEvidence.length === 0 ? (
        <Card className="border-emerald-500/30">
          <CardContent className="flex items-center gap-3 p-6">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p>No additional documents are currently required.</p>
          </CardContent>
        </Card>
      ) : (
        requiredEvidence.map((spec) => {
          const reviewState = stateFor(data, spec);
          const rejectionReason = reasonFor(data, spec);
          const canReplace = reviewState !== "approved";
          return (
            <Card key={spec.key} data-testid={`business-verification-${spec.key}`}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{spec.label}</CardTitle>
                    <CardDescription className="mt-1">{spec.help}</CardDescription>
                  </div>
                  <Badge variant="outline" className={stateClasses(reviewState)}>
                    {stateLabel(reviewState)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviewState === "rejected" ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
                    <strong>Reviewer note:</strong>{" "}
                    {rejectionReason || "Please replace this document with a corrected copy."}
                  </div>
                ) : null}

                {spec.key === "license" ? (
                  <div className="max-w-sm space-y-2">
                    <Label htmlFor="business-license-number">License number</Label>
                    <Input
                      id="business-license-number"
                      value={licenseNumber}
                      onChange={(event) => setLicenseNumber(event.target.value.slice(0, 120))}
                      placeholder="Enter license number"
                      autoComplete="off"
                    />
                  </div>
                ) : null}

                {spec.key === "taxDocument" ? (
                  <div className="max-w-xs space-y-2">
                    <Label htmlFor="tax-id-last-four">Tax ID last four</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tax-id-last-four"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={4}
                        value={taxIdLast4}
                        onChange={(event) => setTaxIdLast4(sanitizeLastFour(event.target.value))}
                        placeholder="1234"
                        aria-label="Last four digits of Tax ID"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={taxIdLast4.length !== 4 || patchMutation.isPending}
                        onClick={() => void saveTaxIdLast4()}
                      >
                        Save
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Do not enter the full Tax ID.</p>
                  </div>
                ) : null}

                {canReplace ? (
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-ts-orange px-4 py-2 text-sm font-semibold text-white hover:bg-ts-orange/90">
                    {uploading === spec.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : reviewState === "rejected" ? (
                      <UploadCloud className="h-4 w-4" />
                    ) : (
                      <FileCheck2 className="h-4 w-4" />
                    )}
                    {uploading === spec.key
                      ? "Uploading..."
                      : reviewState === "not_submitted"
                        ? "Choose document"
                        : "Replace document"}
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploading !== null || patchMutation.isPending}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadEvidence(spec, file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Approved. No further action is required.
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {safeNext ? (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => navigate(safeNext)}>
            Return to profile
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
