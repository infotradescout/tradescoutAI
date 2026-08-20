import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicProfileAccountDialog } from "./PublicProfileAccountDialog";
import {
  loadProfileAccountState,
  type ProfileAccountResponse,
} from "./profileAccountClient";

type PublicProfileAccountCardProps = {
  profileSlug: string;
  profileName: string;
  tone?: "light" | "dark";
  compact?: boolean;
  className?: string;
};

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
  const [data, setData] = useState<ProfileAccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const resumedRef = useRef(false);
  const isDark = tone === "dark";

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    loadProfileAccountState(profileSlug)
      .then((next) => {
        if (current) setData(next);
      })
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

  useEffect(() => {
    if (resumedRef.current || !data || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("profileAccount") !== "1") return;
    resumedRef.current = true;
    if (data.account?.status === "active") {
      clearResumeQuery();
      return;
    }
    setDialogOpen(true);
  }, [data]);

  const connected = data?.account?.status === "active";
  const pendingVerification =
    data?.account?.identityKind === "business" &&
    data.account.verificationStatus === "pending";
  const connectedDescription = data?.account?.businessName
    ? `${data.account.businessName} is connected to ${profileName}.`
    : `Your account is connected to ${profileName}.`;

  return (
    <>
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
              {connected ? connectedDescription : data.policy.description}
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
                    Your account is active. Protected business features remain limited until verification is complete.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  className={cn(
                    "inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-sm font-black transition",
                    isDark
                      ? "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                      : "border border-stone-300 bg-white text-stone-900 hover:bg-stone-50"
                  )}
                >
                  View account
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="profile-account-create"
                onClick={() => setDialogOpen(true)}
                className={cn(
                  "mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-black transition",
                  isDark
                    ? "bg-amber-500 text-stone-950 hover:bg-amber-400"
                    : "bg-stone-950 text-white hover:bg-stone-800"
                )}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
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

      <PublicProfileAccountDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen);
          if (!nextOpen && data?.account?.status === "active") clearResumeQuery();
        }}
        profileSlug={profileSlug}
        profileName={profileName}
        tone={tone}
        initialState={data}
        onStateChange={setData}
      />
    </>
  );
}
