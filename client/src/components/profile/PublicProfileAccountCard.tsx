import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, CheckCircle2, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import { cn } from "@/lib/utils";
import {
  PROFILE_ACCOUNT_ROLE_LABELS,
  buildProfileAccountReturnPath,
  isProfileAccountRole,
  type ProfileAccountPolicy,
  type ProfileAccountRole,
} from "@shared/profileAccount";

type ProfileAccountRecord = Readonly<{
  id: string;
  profileSlug: string;
  profileName: string;
  roles: readonly ProfileAccountRole[];
  status: "active" | "suspended" | "closed";
  verificationStatus: "not_required" | "pending" | "approved" | "rejected";
  resumePath: string;
  lastSeenAt: string | null;
  bidRockEligible: boolean;
}>;

type ProfileAccountEntitlement = Readonly<{
  productKey: string;
  status: "pending_verification" | "active" | "suspended" | "revoked";
}>;

type ProfileAccountResponse = Readonly<{
  policy: ProfileAccountPolicy;
  account: ProfileAccountRecord | null;
  entitlements: readonly ProfileAccountEntitlement[];
  message?: string;
}>;

type PublicProfileAccountCardProps = {
  profileSlug: string;
  profileName: string;
  preferredRole?: ProfileAccountRole;
  tone?: "light" | "dark";
  compact?: boolean;
  className?: string;
};

async function readJson(response: Response): Promise<Partial<ProfileAccountResponse>> {
  return response.json().catch(() => ({}));
}

function canonicalSourcePath(profileSlug: string): string {
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
  url.searchParams.delete("role");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export function PublicProfileAccountCard({
  profileSlug,
  profileName,
  preferredRole,
  tone = "light",
  compact = false,
  className,
}: PublicProfileAccountCardProps) {
  const { user, isAuthenticated } = useAuth();
  const hasViewerSession = isAuthenticated || Boolean((user as { id?: string } | undefined)?.id);
  const [data, setData] = useState<ProfileAccountResponse | null>(null);
  const [selectedRole, setSelectedRole] = useState<ProfileAccountRole | null>(preferredRole || null);
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
    setSelectedRole((current) => {
      if (current && next.policy.roles.includes(current)) return current;
      if (preferredRole && next.policy.roles.includes(preferredRole)) return preferredRole;
      return next.policy.defaultRole;
    });
    return next;
  };

  useEffect(() => {
    let current = true;
    setLoading(true);
    loadState()
      .catch((nextError) => {
        if (current) setError(nextError instanceof Error ? nextError.message : "Account unavailable.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [profileSlug]);

  const redirectToTradeScoutAccount = (role: ProfileAccountRole) => {
    if (typeof window === "undefined") return;
    const next = buildProfileAccountReturnPath({ profileSlug, role });
    const destination = new URL("/pre-scout-setup", getCanonicalAppOrigin());
    destination.searchParams.set("mode", "create");
    destination.searchParams.set("next", next);
    window.location.assign(destination.toString());
  };

  const createAccount = async (role: ProfileAccountRole) => {
    if (!hasViewerSession) {
      redirectToTradeScoutAccount(role);
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
          role,
          sourcePath: canonicalSourcePath(profileSlug),
        }),
      });
      const payload = await readJson(response);
      if (response.status === 401) {
        redirectToTradeScoutAccount(role);
        return;
      }
      if (!response.ok) {
        throw new Error(String(payload.message || "Profile account could not be created."));
      }
      setData(payload as ProfileAccountResponse);
      clearResumeQuery();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Profile account could not be created.");
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
    const requestedRole = url.searchParams.get("role");
    const role =
      requestedRole && isProfileAccountRole(requestedRole) && data.policy.roles.includes(requestedRole)
        ? requestedRole
        : selectedRole || data.policy.defaultRole;
    resumedRef.current = true;
    if (data.account?.roles.includes(role)) {
      clearResumeQuery();
      return;
    }
    void createAccount(role);
  }, [data, hasViewerSession, selectedRole]);

  const remainingRoles = useMemo(
    () => data?.policy.roles.filter((role) => !data.account?.roles.includes(role)) || [],
    [data]
  );
  const activeRole =
    selectedRole && remainingRoles.includes(selectedRole)
      ? selectedRole
      : remainingRoles[0] || data?.policy.defaultRole || preferredRole || "customer";
  const bidRockEntitlement = data?.entitlements.find((entry) => entry.productKey === "bidrock");
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
            {connected ? "Profile account connected" : `${profileName} account`}
          </p>
          <h3 className="mt-2 font-editorial text-3xl leading-none">
            {connected ? `Your account with ${profileName}` : `Create an account with ${profileName}`}
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
              ? "This relationship uses your existing TradeScout sign-in."
              : data.policy.description}
          </p>

          {connected ? (
            <div className="mt-5 space-y-3" data-testid="profile-account-connected-state">
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3",
                  isDark ? "border-white/10 bg-white/[0.05]" : "border-stone-200 bg-stone-50"
                )}
              >
                <p className={cn("text-xs font-bold uppercase tracking-[0.14em]", isDark ? "text-white/45" : "text-stone-500")}>
                  Account types
                </p>
                <p className="mt-2 text-sm font-bold">
                  {data.account?.roles.map((role) => PROFILE_ACCOUNT_ROLE_LABELS[role]).join(" · ")}
                </p>
              </div>

              {pendingVerification ? (
                <p className={cn("flex items-start gap-2 text-sm leading-6", isDark ? "text-amber-200" : "text-amber-800")}>
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Business access is connected and remains pending until verification is complete.
                </p>
              ) : null}

              {bidRockEntitlement ? (
                <p className={cn("flex items-start gap-2 text-sm leading-6", isDark ? "text-white/70" : "text-stone-600")}>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {bidRockEntitlement.status === "active"
                    ? "BidRock business access is included with this account."
                    : "BidRock business access is included and will activate after business verification."}
                </p>
              ) : null}
            </div>
          ) : null}

          {remainingRoles.length > 0 ? (
            <div className={cn("mt-5", compact && "mt-4")}>
              <label
                htmlFor={`profile-account-role-${profileSlug}`}
                className={cn(
                  "block text-[10px] font-black uppercase tracking-[0.16em]",
                  isDark ? "text-white/50" : "text-stone-500"
                )}
              >
                {connected ? "Add another account type" : "I am a"}
              </label>
              <select
                id={`profile-account-role-${profileSlug}`}
                data-testid="profile-account-role"
                value={activeRole}
                onChange={(event) => {
                  const nextRole = event.currentTarget.value;
                  if (isProfileAccountRole(nextRole)) setSelectedRole(nextRole);
                }}
                className={cn(
                  "mt-2 min-h-11 w-full rounded-xl border px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400",
                  isDark
                    ? "border-white/15 bg-white/10 text-white"
                    : "border-stone-300 bg-white text-stone-950"
                )}
              >
                {remainingRoles.map((role) => (
                  <option key={role} value={role} className="text-stone-950">
                    {PROFILE_ACCOUNT_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid="profile-account-create"
                onClick={() => void createAccount(activeRole)}
                disabled={submitting}
                className={cn(
                  "mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-black transition disabled:cursor-wait disabled:opacity-60",
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
                {connected ? "Add account type" : "Create account"}
              </button>
            </div>
          ) : null}
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
