import { memo, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StatusTone = "complete" | "pending" | "required";

type ProfileVerificationSummary = Readonly<{
  profileId?: string;
  verificationBypassActive?: boolean;
  verificationStatus?: string;
  overallStatus?: string;
  status?: string | Record<string, boolean | string | undefined>;
  fieldReview?: Record<string, { required?: boolean; status?: string; reviewStatus?: string }>;
}>;

function normalizeVerificationStatus(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toneClass(tone: StatusTone) {
  if (tone === "complete") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }
  if (tone === "pending") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }
  return "border-rose-500/40 bg-rose-500/10 text-rose-200";
}

function toneLabel(tone: StatusTone) {
  if (tone === "complete") return "Complete";
  if (tone === "pending") return "Pending";
  return "Required";
}

const Verification = memo(function Verification() {
  const { user, isAuthenticated } = useAuth();

  const { data: addressStatus, isLoading: loadingAddress } = useQuery<any>({
    queryKey: ["/api/address-verification/status"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: marketplaceStatus, isLoading: loadingMarketplace } = useQuery<any>({
    queryKey: ["/api/marketplace/verification/status"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: identityStatus, isLoading: loadingIdentity } = useQuery<any>({
    queryKey: ["/api/identity-verification/status"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: profileVerification, isLoading: loadingProfessional } =
    useQuery<ProfileVerificationSummary>({
      queryKey: ["/api/profile/verification"],
      enabled: isAuthenticated,
      retry: false,
    });

  const profileComplete = useMemo(() => {
    if (!user) return false;
    return Boolean(
      user.firstName &&
      user.lastName &&
      user.email &&
      (user.countyFips || user.countyName || user.city || user.state)
    );
  }, [user]);

  const addressTone: StatusTone = addressStatus?.isVerified
    ? "complete"
    : addressStatus?.verification
      ? "pending"
      : "required";

  const identityTone: StatusTone = identityStatus?.isVerified
    ? "complete"
    : identityStatus?.verification
      ? "pending"
      : "required";

  const proStatus = normalizeVerificationStatus(
    profileVerification?.overallStatus ||
      profileVerification?.verificationStatus ||
      (typeof profileVerification?.status === "string" ? profileVerification.status : "")
  );
  const requiredFieldStates = Object.values(profileVerification?.fieldReview || {})
    .filter((field) => field?.required === true)
    .map((field) => normalizeVerificationStatus(field.reviewStatus || field.status));
  const professionalTone: StatusTone = profileVerification?.verificationBypassActive
    ? "complete"
    : proStatus === "approved" ||
        (requiredFieldStates.length > 0 &&
          requiredFieldStates.every((state) => state === "approved"))
      ? "complete"
      : proStatus === "pending" ||
          requiredFieldStates.some((state) => state === "pending" || state === "submitted")
        ? "pending"
        : "required";
  const businessVerificationParams = new URLSearchParams({
    source: "verification_hub",
    next: "/verification",
  });
  if (profileVerification?.profileId) {
    businessVerificationParams.set("businessProfileId", profileVerification.profileId);
  }
  const businessVerificationPath = `/business-verification?${businessVerificationParams.toString()}`;

  const marketplaceTone: StatusTone = marketplaceStatus?.vendorVerification?.status
    ? String(marketplaceStatus.vendorVerification.status).toLowerCase() === "approved"
      ? "complete"
      : "pending"
    : "required";

  const loading = loadingAddress || loadingMarketplace || loadingIdentity || loadingProfessional;
  return (
    <div className="px-4 py-4 md:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Card
          style={{ backgroundColor: "var(--surface-card)" }}
          className="border-[color:var(--border-subtle)]"
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[color:var(--text-primary)]">
              <ShieldCheck className="h-5 w-5 text-ts-orange" />
              Verification & Trust
            </CardTitle>
            <CardDescription className="text-[color:var(--text-secondary)]">
              Public profile and trust checks are now powered by live account data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isAuthenticated ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
                Sign in to continue verification and publish your profile.
                <div className="mt-3 flex gap-2">
                  <Button
                    asChild
                    size="sm"
                    className="bg-ts-orange hover:bg-ts-orange-dark text-black"
                  >
                    <Link href="/pre-scout-setup?mode=signin">Sign In</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/pre-scout-setup?mode=create">Create Account</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div
                    className={`rounded-lg border p-3 ${toneClass(profileComplete ? "complete" : "required")}`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <UserRound className="h-4 w-4" />
                      Profile completion
                    </div>
                    <Badge variant="outline" className="mb-2 border-current/40 text-current">
                      {toneLabel(profileComplete ? "complete" : "required")}
                    </Badge>
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      Required for public profile and better routing.
                    </p>
                  </div>

                  <div className={`rounded-lg border p-3 ${toneClass(addressTone)}`}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Address verification
                    </div>
                    <Badge variant="outline" className="mb-2 border-current/40 text-current">
                      {toneLabel(addressTone)}
                    </Badge>
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      {addressStatus?.isVerified
                        ? "Address confirmed."
                        : addressStatus?.daysRemaining != null
                          ? `${addressStatus.daysRemaining} day(s) remaining in verification window.`
                          : "Required to unlock all messaging and routing paths."}
                    </p>
                  </div>

                  <div className={`rounded-lg border p-3 ${toneClass(identityTone)}`}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <ShieldCheck className="h-4 w-4" />
                      Identity verification
                    </div>
                    <Badge variant="outline" className="mb-2 border-current/40 text-current">
                      {toneLabel(identityTone)}
                    </Badge>
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      {identityStatus?.isVerified
                        ? "Identity verified."
                        : identityStatus?.verification
                          ? "Submission received. Pending review."
                          : "Required to initiate contact across the platform."}
                    </p>
                  </div>

                  <div className={`rounded-lg border p-3 ${toneClass(professionalTone)}`}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <ShieldCheck className="h-4 w-4" />
                      Professional status
                    </div>
                    <Badge variant="outline" className="mb-2 border-current/40 text-current">
                      {toneLabel(professionalTone)}
                    </Badge>
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      {profileVerification?.verificationBypassActive
                        ? "Verification is not required for this account."
                        : professionalTone === "complete"
                          ? "Business verification approved."
                          : proStatus === "rejected" ||
                              requiredFieldStates.some((state) => state === "rejected")
                            ? "Updates are required before verification can be approved."
                            : professionalTone === "pending"
                              ? "Submitted evidence is being reviewed."
                              : "Submit the requested business evidence."}
                    </p>
                  </div>

                  <div className={`rounded-lg border p-3 ${toneClass(marketplaceTone)}`}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Clock3 className="h-4 w-4" />
                      Marketplace verification
                    </div>
                    <Badge variant="outline" className="mb-2 border-current/40 text-current">
                      {toneLabel(marketplaceTone)}
                    </Badge>
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      {marketplaceStatus?.vendorVerification?.status
                        ? `Vendor status: ${marketplaceStatus.vendorVerification.status}`
                        : "No marketplace verification submission on file yet."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          style={{ backgroundColor: "var(--surface-card)" }}
          className="border-[color:var(--border-subtle)]"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-[color:var(--text-primary)]">Action Paths</CardTitle>
            <CardDescription className="text-[color:var(--text-secondary)]">
              These routes are wired to real endpoints and should be your core trust flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/profile-settings">Update profile details</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/address-verification">Complete address verification</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/identity-verification">Complete identity verification</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href={businessVerificationPath}>Verify your business</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/direct-connect">Open Direct Connect</Link>
            </Button>
          </CardContent>
        </Card>

        {loading && (
          <div className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-3 text-sm text-[color:var(--text-secondary)]">
            Loading live verification status...
          </div>
        )}

        {isAuthenticated && !profileComplete && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            Next step required: complete profile basics in Profile Settings so your public page can
            rank and route.
          </div>
        )}

        {isAuthenticated && profileComplete && addressTone !== "complete" && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            Next step required: finish address verification to unlock full trust eligibility.
          </div>
        )}
      </div>
    </div>
  );
});

export default Verification;
