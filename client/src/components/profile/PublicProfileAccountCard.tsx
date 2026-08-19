import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import { cn } from "@/lib/utils";
import {
  buildProfileAccountReturnPath,
  type ProfileAccountPolicy,
} from "@shared/profileAccount";

type ViewerBusinessProfile = Readonly<{
  id: string;
  name: string;
  verificationStatus: "pending" | "approved" | "rejected";
}>;

type ProfileAccountRecord = Readonly<{
  id: string;
  profileSlug: string;
  profileName: string;
  businessProfileId: string;
  businessName: string;
  status: "active" | "suspended" | "closed";
  verificationStatus: "pending" | "approved" | "rejected";
  resumePath: string;
  lastSeenAt: string | null;
  bidRockIncluded: boolean;
}>;

type ProfileAccountEntitlement = Readonly<{
  productKey: string;
  status: "pending_verification" | "active" | "suspended" | "revoked";
}>;

type ProfileAccountResponse = Readonly<{
  policy: ProfileAccountPolicy;
  viewerBusiness: ViewerBusinessProfile | null;
  requiresBusinessSetup: boolean;
  account: ProfileAccountRecord | null;
  entitlements: readonly ProfileAccountEntitlement[];
  message?: string;
}>;

type PublicProfileAccountCardProps = {
  profileSlug: string;
  profileName: string;
  tone?: "light" | "dark";
  compact?: boolean;
  className?: string;
};

async function readJson(response: Response): Promise<Partial<ProfileAccountResponse>> {
  return response.json().catch(() => ({}));
}

function currentProfilePath(profileSlug: string): string {
  if (typeof window !== "undefined") {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current.startsWith(`/u/${profileSlug}`)) return current.slice(0, 500);
  }
  return `/u/${profileSlug}`;
}

function clearResumeQuery(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("profileAccount");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export function PublicProfileAccountCard({
  profileSlug,
  profileName,
  tone = "light",
  compact = false,
  className,
}: PublicProfileAccountCardProps) {
  const { user, isAuthenticated } = useAuth();
  const hasViewerSession = isAuthenticated || Boolean((user as { id?: string } | undefined)?.id);
  const [data, setData] = useState<ProfileAccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const resumedRef = useRef(false);
  const isDark = tone === "dark";

  const loadState = async () => {
    const response = await fetch(`/api/u/${encodeURIComponent(profileSlug)}/account`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(String(payload.message || "Profile account is temporarily unavailable."));
    }
    const next = payload as ProfileAccountResponse;
    setData(next);
    return next;
  };

  useEffect(() => {
    let current = true;
    setLoading(true);
    loadState()
      .catch((nextError) => {
        if (current) {
          setError(nextError instanceof Error ? nextError.message : "Account unavailable.");
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [profileSlug]);

  const continueThroughBusinessSetup = () => {
    if (typeof window === "undefined") return;
    const destination = new URL("/pre-scout-setup", getCanonicalAppOrigin());
    destination.searchParams.set("mode", "create");
    destination.searchParams.set("presence", "business");
    destination.searchParams.set("next", buildProfileAccountReturnPath(profileSlug));
    window.location.assign(destination.toString());
  };

  const createAccount = async () => {
    if (!hasViewerSession || data?.requiresBusinessSetup) {
      continueThroughBusinessSetup();
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/u/${encodeURIComponent(profileSlug)}/account`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourcePath: currentProfilePath(profileSlug),
        }),
      });
      const payload = await readJson(response);
      if (response.status === 401 || payload.requiresBusinessSetup === true) {
        continueThroughBusinessSetup();
        return;
      }
      if (!response.ok) {
        throw new Error(String(payload.message || "Profile account could not be created."));
      }
      setData(payload as ProfileAccountResponse);
      clearResumeQuery();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Profile account could not be created."
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (
      resumedRef.current ||
      !data ||
      !hasViewerSession ||
      typeof window === "undefined"
    ) {
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get("profileAccount") !== "1") return;
    resumedRef.current = true;
    if (data.account) {
      clearResumeQuery();
      return;
    }
    if (data.viewerBusiness && !data.requiresBusinessSetup) {
      void createAccount();
    }
  }, [data, hasViewerSession]);

  const connected = data?.account?.status === "active";
  const pendingVerification = data?.account?.verificationStatus === "pending";

  return (
    <section
      data-testid="public-profile-account-card"
      className={cn(
        "rounded-[1.5rem] border p-5 shadow-[0_18px_55px_rgba(42,39,36,0.08)] sm:p-6",
        isDark
          ? "border-white/10 bg-stone-950 text-white"
          : "border-stone-200 bg-white text-stone-950",
        compact && "p-5 sm:p-5",
        className
      )}
      aria-label={`Account with ${profileName}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            connected
              ? isDark
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-emerald-50 text-emerald-700"
              : isDark
                ? "bg-white/10 text-white"
                : "bg-stone-100 text-stone-800"
          )}
        >
          {connected ? (
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          ) : (
            <UserPlus className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.18em]",
              isDark ? "text-amber-300" : "text-stone-500"
            )}
          >
            {connected ? "Account created" : "Account"}
          </p>
          <h3 className="mt-2 font-editorial text-3xl leading-none">
            {connected ? `Your account with ${profileName}` : "Create an account"}
          </h3>
        </div>
      </div>

      {loading ? (
        <div
          className={cn(
            "mt-5 flex min-h-12 items-center gap-2 text-sm",
            isDark ? "text-white/65" : "text-stone-600"
          )}
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking your account…
        </div>
      ) : data ? (
        <>
          <p className={cn("mt-4 text-sm leading-6", isDark ? "text-white/70" : "text-stone-600")}>
            {connected
              ? `${data.account?.businessName || "Your business"} is connected to ${profileName}.`
              : `Businesses can create an account with ${profileName} using their TradeScout business identity.`}
          </p>

          {connected ? (
            <div className="mt-5 space-y-3" data-testid="profile-account-connected-state">
              {pendingVerification ? (
                <p
                  className={cn(
                    "flex items-start gap-2 text-sm leading-6",
                    isDark ? "text-amber-200" : "text-amber-800"
                  )}
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Business verification is still pending.
                </p>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              data-testid="profile-account-create"
              onClick={() => void createAccount()}
              disabled={submitting}
              className={cn(
                "mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-black transition disabled:cursor-wait disabled:opacity-60",
                isDark
                  ? "bg-amber-500 text-stone-950 hover:bg-amber-400"
                  : "bg-stone-950 text-white hover:bg-stone-800"
              )}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              )}
              Create an account
            </button>
          )}
        </>
      ) : null}

      {error ? (
        <p
          className={cn(
            "mt-4 rounded-xl px-3 py-2 text-sm font-semibold",
            isDark ? "bg-red-400/10 text-red-200" : "bg-red-50 text-red-800"
          )}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
