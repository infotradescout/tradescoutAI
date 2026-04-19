import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SEOHelmet } from "@/components/SEOHelmet";
import {
  ShieldCheck,
  FileText,
  MapPin,
  User,
  Briefcase,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  Star,
  ArrowRight,
  Eye,
  Building2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type VerificationStep = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  status: "complete" | "pending" | "not_started";
  href: string;
  priority: "required" | "recommended" | "optional";
};

type IdentityStatusResponse = { isVerified: boolean; verification: unknown | null };
type AddressStatusResponse = { isVerified: boolean; requiresVerification: boolean };

type TrustSnapshot = {
  licenseStatus?: string | null;
  insuranceStatus?: string | null;
  verificationStatus?: string | null;
  cvsScore?: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stepStatusIcon(status: VerificationStep["status"]) {
  if (status === "complete")
    return <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />;
  if (status === "pending")
    return <Clock className="h-5 w-5 text-ts-orange shrink-0" />;
  return <Circle className="h-5 w-5 text-white/30 shrink-0" />;
}

function priorityBadge(priority: VerificationStep["priority"]) {
  if (priority === "required")
    return (
      <Badge className="text-[10px] bg-red-500/20 text-red-300 border-red-500/30 px-1.5 py-0">
        Required
      </Badge>
    );
  if (priority === "recommended")
    return (
      <Badge className="text-[10px] bg-ts-orange/20 text-ts-orange border-ts-orange/30 px-1.5 py-0">
        Recommended
      </Badge>
    );
  return (
    <Badge className="text-[10px] bg-white/10 text-white/50 border-white/10 px-1.5 py-0">
      Optional
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OfferServicesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const displayName = useMemo(() => {
    if (user?.firstName) return user.firstName;
    const provisional = (user as any)?.preferences?.provisional?.profileDraft;
    if (provisional?.firstName) return provisional.firstName;
    return null;
  }, [user]);

  const businessName = useMemo(() => {
    const provisional = (user as any)?.preferences?.provisional?.profileDraft;
    return provisional?.businessName ?? (user as any)?.businessName ?? null;
  }, [user]);

  // ── Verification status queries ──────────────────────────────────────────
  const identityQuery = useQuery<IdentityStatusResponse>({
    queryKey: ["/api/identity-verification/status"],
    queryFn: () => apiRequest("GET", "/api/identity-verification/status"),
    staleTime: 60_000,
  });

  const addressQuery = useQuery<AddressStatusResponse>({
    queryKey: ["/api/address-verification/status"],
    queryFn: () => apiRequest("GET", "/api/address-verification/status"),
    staleTime: 60_000,
  });

  // ── Derive step statuses ─────────────────────────────────────────────────
  const steps: VerificationStep[] = useMemo(() => {
    const emailDone = user?.emailVerified === true;
    const addressDone = addressQuery.data?.isVerified === true;
    const identityDone = identityQuery.data?.isVerified === true;
    const addressPending =
      !addressDone && addressQuery.data?.requiresVerification === false;
    const identityPending =
      !identityDone &&
      identityQuery.data?.verification !== null &&
      identityQuery.data?.verification !== undefined;

    // License and insurance: read from user object (populated by sanitizeUserForResponse
    // via trust snapshot enrichment) with graceful fallback to trustSnapshot directly.
    const trustSnapshot = (user as any)?.trustSnapshot as TrustSnapshot | undefined;
    const licenseStatus = trustSnapshot?.licenseStatus ?? null;
    const insuranceStatus = trustSnapshot?.insuranceStatus ?? null;
    const licenseDone =
      (user as any)?.licenseVerified === true || licenseStatus === "verified";
    const licensePending =
      !licenseDone && (licenseStatus === "submitted" || licenseStatus === "pending_review");
    const insuranceDone =
      (user as any)?.insuranceVerified === true || insuranceStatus === "verified";
    const insurancePending =
      !insuranceDone &&
      (insuranceStatus === "submitted" || insuranceStatus === "pending_review");

    // Public profile: consider done if user has a profileImageUrl or a bio/description
    const profileDone =
      Boolean((user as any)?.profileImageUrl) ||
      Boolean((user as any)?.bio) ||
      Boolean((user as any)?.about);

    return [
      {
        id: "email",
        label: "Verify your email",
        description: "Confirm your email address to activate your account.",
        icon: User,
        status: emailDone ? "complete" : "not_started",
        href: "/settings",
        priority: "required",
      },
      {
        id: "identity",
        label: "Verify your identity",
        description:
          "Upload a government-issued ID so clients know you're a real person.",
        icon: ShieldCheck,
        status: identityDone
          ? "complete"
          : identityPending
          ? "pending"
          : "not_started",
        href: "/identity-verification",
        priority: "required",
      },
      {
        id: "address",
        label: "Verify your address",
        description:
          "Confirm your service area so TradeScout can route the right jobs to you.",
        icon: MapPin,
        status: addressDone
          ? "complete"
          : addressPending
          ? "pending"
          : "not_started",
        href: "/address-verification",
        priority: "recommended",
      },
      {
        id: "license",
        label: "Add your trade license",
        description:
          "Licensed contractors get a verified badge and rank higher in search results.",
        icon: FileText,
        status: licenseDone ? "complete" : licensePending ? "pending" : "not_started",
        href: "/license-verification",
        priority: "recommended",
      },
      {
        id: "insurance",
        label: "Upload proof of insurance",
        description:
          "Clients require proof of general liability before hiring. Upload yours here.",
        icon: Briefcase,
        status: insuranceDone ? "complete" : insurancePending ? "pending" : "not_started",
        href: "/insurance-verification",
        priority: "recommended",
      },
      {
        id: "profile",
        label: "Complete your public profile",
        description:
          "Add a photo, bio, and service tags so clients can find and trust you.",
        icon: Star,
        status: profileDone ? "complete" : "not_started",
        href: "/profile",
        priority: "optional",
      },
    ];
  }, [user, identityQuery.data, addressQuery.data]);

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  const isVerified = user?.verifiedBadge === true || user?.verificationStatus === "approved";

  return (
    <>
      <SEOHelmet
        title="Set Up Your Business Profile | TradeScout"
        description="Complete your verification and public profile to start receiving jobs on TradeScout."
      />

      <div className="min-h-screen bg-tsBackground">
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

          {/* ── Welcome header ─────────────────────────────────────────── */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-ts-orange" />
              <h1 className="text-2xl font-bold text-white">
                {displayName
                  ? `Welcome, ${displayName}!`
                  : "Set up your business profile"}
              </h1>
            </div>
            {businessName && (
              <p className="text-white/60 text-sm pl-8">{businessName}</p>
            )}
            <p className="text-white/60 text-sm pl-8">
              Complete the steps below to get verified and start receiving jobs.
            </p>
          </div>

          {/* ── Verified badge (shown once fully verified) ─────────────── */}
          {isVerified && (
            <Card className="border border-green-500/30 bg-green-500/10">
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-green-400 shrink-0" />
                <div>
                  <p className="text-green-300 font-semibold text-sm">
                    You're verified!
                  </p>
                  <p className="text-green-400/70 text-xs">
                    Your profile shows a verified badge to potential clients.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Progress card ───────────────────────────────────────────── */}
          <Card className="border-white/10 bg-tsCard">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base">
                  Profile completion
                </CardTitle>
                <span className="text-ts-orange font-bold text-sm">
                  {completedCount}/{steps.length} steps
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress
                value={progressPct}
                className="h-2 bg-white/10 [&>div]:bg-ts-orange"
              />
              <p className="text-white/50 text-xs">
                {progressPct < 100
                  ? `${100 - progressPct}% remaining — complete all required steps to unlock your verified badge.`
                  : "All steps complete. Your verified badge is active."}
              </p>
            </CardContent>
          </Card>

          {/* ── Verification checklist ──────────────────────────────────── */}
          <Card className="border-white/10 bg-tsCard">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-ts-orange" />
                Verification checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-white/5">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => navigate(step.href)}
                  className="w-full flex items-start gap-3 py-3 text-left group hover:bg-white/5 -mx-6 px-6 transition-colors first:-mt-2 last:-mb-2"
                >
                  {stepStatusIcon(step.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-medium ${
                          step.status === "complete"
                            ? "text-white/50 line-through"
                            : "text-white"
                        }`}
                      >
                        {step.label}
                      </span>
                      {priorityBadge(step.priority)}
                    </div>
                    <p className="text-white/40 text-xs mt-0.5 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                  {step.status !== "complete" && (
                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-white/60 shrink-0 mt-0.5 transition-colors" />
                  )}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* ── Quick actions ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="border-white/10 text-white/70 hover:text-white hover:bg-white/5 h-auto py-3 flex flex-col items-center gap-1"
              onClick={() => navigate("/profile")}
            >
              <Eye className="h-4 w-4" />
              <span className="text-xs">View public profile</span>
            </Button>
            <Button
              className="bg-ts-orange hover:bg-ts-orange/90 text-white h-auto py-3 flex flex-col items-center gap-1"
              onClick={() => navigate("/direct-connect")}
            >
              <ArrowRight className="h-4 w-4" />
              <span className="text-xs">Find jobs now</span>
            </Button>
          </div>

          {/* ── Why verification matters ─────────────────────────────────── */}
          <Card className="border-white/5 bg-white/3">
            <CardContent className="p-4 space-y-2">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                Why get verified?
              </p>
              <ul className="space-y-1.5">
                {[
                  "Verified badge shown on all job matches and your public profile",
                  "Higher ranking in TradeScout search results",
                  "Clients can hire you directly without a background check step",
                  "Access to premium Direct Connect job tiers",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-white/50 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-ts-orange shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
}
