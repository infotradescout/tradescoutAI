import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Loader2, LogIn, RefreshCw, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { cn } from "@/lib/utils";
import {
  buildProfileAccountResumePath,
  createProfileAccount,
  currentProfileAccountSourcePath,
  loadProfileAccountState,
  readProfileAccountJson,
  registerProfileAccount,
  type ProfileAccountMode,
  type ProfileAccountResponse,
} from "./profileAccountClient";

type PublicProfileAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileSlug: string;
  profileName: string;
  tone?: "light" | "dark";
  initialMode?: ProfileAccountMode;
};

type RequestError = Error & { status?: number; code?: string };

function requestedMode(fallback: ProfileAccountMode): ProfileAccountMode {
  if (typeof window === "undefined") return fallback;
  try {
    return new URL(window.location.href).searchParams.get("profileAccountMode") === "signin"
      ? "signin"
      : fallback;
  } catch {
    return fallback;
  }
}

function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Add at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Add at least one number.";
  return null;
}

async function signIn(email: string, password: string): Promise<void> {
  const response = await fetch(buildApiUrl("/api/auth/login"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const payload = await readProfileAccountJson(response);
  if (!response.ok) {
    const error = new Error(String(payload.message || "Sign-in failed.")) as RequestError;
    error.status = response.status;
    error.code = typeof payload.code === "string" ? payload.code : undefined;
    throw error;
  }
}

export function PublicProfileAccountDialog({
  open,
  onOpenChange,
  profileSlug,
  profileName,
  tone = "light",
  initialMode = "create",
}: PublicProfileAccountDialogProps) {
  const { user, isAuthenticated, refetch } = useAuth();
  const hasSession = isAuthenticated || Boolean(user?.id);
  const [mode, setMode] = useState<ProfileAccountMode>(initialMode);
  const [state, setState] = useState<ProfileAccountResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const isDark = tone === "dark";

  useEffect(() => {
    if (!open) return;
    let active = true;
    setMode(requestedMode(initialMode));
    setLoading(true);
    setLoadError("");
    setError("");
    setNotice("");
    loadProfileAccountState(profileSlug)
      .then((next) => {
        if (!active) return;
        setState(next);
        if (next.viewerBusiness?.name) setBusinessName(next.viewerBusiness.name);
      })
      .catch((nextError) => {
        if (!active) return;
        setLoadError(
          nextError instanceof Error ? nextError.message : "Account is temporarily unavailable."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, profileSlug, initialMode, loadAttempt]);

  const connected = state?.account?.status === "active";
  const requiresBusiness = state?.policy.requiredIdentity === "business";
  const normalizedBusinessName = businessName.trim();
  const resumePath = buildProfileAccountResumePath(profileSlug, "signin");

  const description = useMemo(() => {
    if (connected) return `Your account with ${profileName} is ready.`;
    if (requiresBusiness) {
      return `Any business can create an account directly with ${profileName}. Your business details remain private unless you choose to publish them later.`;
    }
    return `Create an account directly with ${profileName}.`;
  }, [connected, profileName, requiresBusiness]);

  const finishExistingSession = async () => {
    const current = await loadProfileAccountState(profileSlug);
    setState(current);
    if (current.account?.status === "active") return;
    if (
      current.policy.requiredIdentity === "business" &&
      !current.viewerBusiness &&
      normalizedBusinessName.length < 2
    ) {
      throw new Error("Enter your business name.");
    }
    const created = await createProfileAccount({
      profileSlug,
      businessName:
        current.policy.requiredIdentity === "business" ? normalizedBusinessName : null,
      sourcePath: currentProfileAccountSourcePath(profileSlug),
    });
    setState(created);
  };

  const createNewAccount = async () => {
    if (!state) throw new Error("Account details have not finished loading.");
    if (requiresBusiness && normalizedBusinessName.length < 2) {
      throw new Error("Enter your business name.");
    }
    if (!firstName.trim()) throw new Error("Enter your first name.");
    if (!lastName.trim()) throw new Error("Enter your last name.");
    if (!email.trim() || !email.includes("@")) throw new Error("Enter a valid email address.");
    if (phone.replace(/\D/g, "").length < 10) throw new Error("Enter a valid phone number.");
    const passwordMessage = passwordProblem(password);
    if (passwordMessage) throw new Error(passwordMessage);
    if (password !== confirmPassword) throw new Error("The passwords do not match.");
    if (!acceptTerms) throw new Error("Accept the Terms of Service and Privacy Policy.");

    try {
      const created = await registerProfileAccount({
        profileSlug,
        businessName: normalizedBusinessName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        acceptTerms: true,
        sourcePath: currentProfileAccountSourcePath(profileSlug),
        next: resumePath,
      });
      setState(created);
      if (created.emailVerificationRequired) {
        setNotice(
          created.emailVerificationSent
            ? `Check ${email.trim()} for the verification link. Your account is already connected to ${profileName}.`
            : `Your account is connected to ${profileName}. Email verification can be completed later.`
        );
      }
      await refetch().catch(() => undefined);
    } catch (nextError) {
      const requestError = nextError as RequestError;
      if (requestError.status === 409 || requestError.code === "AUTH_ACCOUNT_EXISTS") {
        setMode("signin");
        throw new Error(`An account already exists for ${email.trim()}. Sign in to continue.`);
      }
      throw nextError;
    }
  };

  const submit = async () => {
    if (submitting || !state) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      if (hasSession) {
        await finishExistingSession();
      } else if (mode === "signin") {
        if (!email.trim() || !password) throw new Error("Enter your email and password.");
        await signIn(email, password);
        await refetch().catch(() => undefined);
        await finishExistingSession();
      } else {
        await createNewAccount();
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Account could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = cn(
    "min-h-11 w-full rounded-xl border px-3 text-sm outline-none transition focus:ring-2",
    isDark
      ? "border-white/15 bg-white/5 text-white placeholder:text-white/40 focus:ring-amber-400/70"
      : "border-stone-300 bg-white text-stone-950 placeholder:text-stone-400 focus:ring-stone-900/25"
  );
  const labelClass = cn("space-y-1.5 text-sm font-bold", isDark ? "text-white" : "text-stone-800");
  const mutedClass = isDark ? "text-white/65" : "text-stone-600";
  const primaryClass = isDark
    ? "bg-amber-500 text-stone-950 hover:bg-amber-400"
    : "bg-stone-950 text-white hover:bg-stone-800";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="profile-account-dialog"
        className={cn(
          "max-h-[92vh] overflow-y-auto sm:max-w-xl",
          isDark ? "border-white/10 bg-stone-950 text-white" : "border-stone-200 bg-white"
        )}
      >
        <DialogHeader>
          <div
            className={cn(
              "mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full",
              connected
                ? "bg-emerald-100 text-emerald-700"
                : isDark
                  ? "bg-white/10 text-amber-300"
                  : "bg-stone-100 text-stone-800"
            )}
          >
            {connected ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : requiresBusiness ? (
              <Building2 className="h-5 w-5" />
            ) : (
              <UserPlus className="h-5 w-5" />
            )}
          </div>
          <DialogTitle className="text-2xl">
            {connected
              ? `Your ${profileName} account`
              : hasSession
                ? `Create your account with ${profileName}`
                : mode === "signin"
                  ? `Sign in to ${profileName}`
                  : `Create an account with ${profileName}`}
          </DialogTitle>
          <DialogDescription className={mutedClass}>{description}</DialogDescription>
        </DialogHeader>

        {loading && !state ? (
          <div className={cn("flex min-h-32 items-center justify-center gap-2 text-sm", mutedClass)}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening your account…
          </div>
        ) : loadError && !state ? (
          <div className="space-y-4" data-testid="profile-account-load-error">
            <p className="rounded-xl bg-red-50 px-3 py-3 text-sm font-bold text-red-800" role="alert">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => setLoadAttempt((value) => value + 1)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 text-sm font-black text-stone-900"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : connected ? (
          <div className="space-y-4" data-testid="profile-account-dialog-connected">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-stone-900">
              <p className="font-black">
                {state?.account?.businessName || "Your account"} is connected to {profileName}.
              </p>
              {state?.account?.verificationStatus === "pending" ? (
                <p className="mt-1 text-stone-600">
                  Business verification is pending. Protected pricing and business-only features remain locked until approval.
                </p>
              ) : null}
              {notice ? <p className="mt-2 font-semibold text-stone-600">{notice}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(
                "inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-sm font-black transition",
                primaryClass
              )}
            >
              Continue browsing
            </button>
          </div>
        ) : state ? (
          <div className="space-y-4">
            {requiresBusiness && (!state.viewerBusiness || !hasSession) ? (
              <label className={labelClass}>
                <span>Business name</span>
                <input
                  data-testid="profile-account-business-name"
                  className={inputClass}
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  autoComplete="organization"
                />
              </label>
            ) : null}

            {!hasSession && mode === "create" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  <span>First name</span>
                  <input
                    data-testid="profile-account-first-name"
                    className={inputClass}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    autoComplete="given-name"
                  />
                </label>
                <label className={labelClass}>
                  <span>Last name</span>
                  <input
                    data-testid="profile-account-last-name"
                    className={inputClass}
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    autoComplete="family-name"
                  />
                </label>
              </div>
            ) : null}

            {!hasSession ? (
              <>
                <label className={labelClass}>
                  <span>Email</span>
                  <input
                    data-testid="profile-account-email"
                    className={inputClass}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                  />
                </label>
                {mode === "create" ? (
                  <label className={labelClass}>
                    <span>Phone</span>
                    <input
                      data-testid="profile-account-phone"
                      className={inputClass}
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                    />
                  </label>
                ) : null}
                <label className={labelClass}>
                  <span>Password</span>
                  <input
                    data-testid="profile-account-password"
                    className={inputClass}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === "create" ? "new-password" : "current-password"}
                  />
                </label>
                {mode === "create" ? (
                  <>
                    <label className={labelClass}>
                      <span>Confirm password</span>
                      <input
                        data-testid="profile-account-confirm-password"
                        className={inputClass}
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                    <label className={cn("flex items-start gap-3 text-sm leading-6", mutedClass)}>
                      <input
                        data-testid="profile-account-terms"
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(event) => setAcceptTerms(event.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0"
                      />
                      <span>
                        I agree to the <a className="font-bold underline" href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> and acknowledge the <a className="font-bold underline" href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
                      </span>
                    </label>
                  </>
                ) : null}
              </>
            ) : null}

            {error ? (
              <p data-testid="profile-account-error" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              data-testid="profile-account-submit"
              onClick={() => void submit()}
              disabled={submitting || !state}
              className={cn(
                "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-black transition disabled:cursor-wait disabled:opacity-60",
                primaryClass
              )}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "signin" && !hasSession ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {mode === "signin" && !hasSession ? "Sign in and continue" : `Create account with ${profileName}`}
            </button>

            {!hasSession ? (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setMode((current) => (current === "create" ? "signin" : "create"));
                }}
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center text-sm font-bold underline-offset-4 hover:underline",
                  mutedClass
                )}
              >
                {mode === "create" ? "Already have an account? Sign in" : "New here? Create an account"}
              </button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
