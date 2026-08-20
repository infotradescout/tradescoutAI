import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Loader2, LogIn, RefreshCw, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  buildProfileAccountResumePath,
  createProfileAccount,
  currentProfileAccountSourcePath,
  loadProfileAccountState,
  rememberProfileAccountReturnPath,
  readResponseJson,
  type ProfileAccountMode,
  type ProfileAccountResponse,
} from "./profileAccountClient";

type AccountMode = ProfileAccountMode;

type PublicProfileAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileSlug: string;
  profileName: string;
  tone?: "light" | "dark";
  initialMode?: AccountMode;
  initialState?: ProfileAccountResponse | null;
  onStateChange?: (state: ProfileAccountResponse) => void;
};

type AuthError = Error & {
  status?: number;
  code?: string;
};

function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Add at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Add at least one number.";
  return null;
}

function requestedAccountMode(fallback: AccountMode): AccountMode {
  if (typeof window === "undefined") return fallback;
  try {
    return new URL(window.location.href).searchParams.get("profileAccountMode") === "signin"
      ? "signin"
      : fallback;
  } catch {
    return fallback;
  }
}

async function submitAuth(path: "/api/auth/register" | "/api/auth/login", body: object) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await readResponseJson(response);
  if (!response.ok) {
    const error = new Error(String(payload.message || "Account access failed.")) as AuthError;
    error.status = response.status;
    error.code = typeof payload.code === "string" ? payload.code : undefined;
    throw error;
  }
  return payload;
}

export function PublicProfileAccountDialog({
  open,
  onOpenChange,
  profileSlug,
  profileName,
  tone = "light",
  initialMode = "create",
  initialState = null,
  onStateChange,
}: PublicProfileAccountDialogProps) {
  const { user, isAuthenticated, refetch } = useAuth();
  const hasViewerSession = isAuthenticated || Boolean((user as { id?: string } | null)?.id);
  const [data, setData] = useState<ProfileAccountResponse | null>(initialState);
  const [mode, setMode] = useState<AccountMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const isDark = tone === "dark";

  useEffect(() => {
    setData(initialState);
  }, [initialState, profileSlug]);

  useEffect(() => {
    if (!open) return;
    setMode(requestedAccountMode(initialMode));
    let current = true;
    setLoading(true);
    setLoadError("");
    setError("");
    loadProfileAccountState(profileSlug)
      .then((next) => {
        if (!current) return;
        setData(next);
        onStateChange?.(next);
        if (next.viewerBusiness?.name) setBusinessName(next.viewerBusiness.name);
      })
      .catch((nextError) => {
        if (current) {
          setLoadError(
            nextError instanceof Error ? nextError.message : "Account is temporarily unavailable."
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [open, profileSlug, initialMode, loadAttempt]);

  const requiresBusiness = data?.policy.requiredIdentity === "business";
  const connected = data?.account?.status === "active";
  const needsBusinessName = requiresBusiness && !data?.viewerBusiness;
  const normalizedBusinessName = businessName.trim();
  const profileSigninReturnPath = buildProfileAccountResumePath(profileSlug, "signin");

  const description = useMemo(() => {
    if (connected) {
      return `Your account with ${profileName} is ready.`;
    }
    if (requiresBusiness) {
      return `Any business can create an account directly with ${profileName}. Your business details stay private unless you later choose to publish them.`;
    }
    return `Create an account directly with ${profileName} and continue where you left off.`;
  }, [connected, profileName, requiresBusiness]);

  const publishState = (next: ProfileAccountResponse) => {
    setData(next);
    onStateChange?.(next);
  };

  const signIn = async () => {
    if (!email.trim() || !password) {
      throw new Error("Enter your email and password.");
    }
    await submitAuth("/api/auth/login", {
      email: email.trim().toLowerCase(),
      password,
    });
    await refetch().catch(() => undefined);
  };

  const finishProfileAccount = async (allowLoginRetry: boolean) => {
    let current = await loadProfileAccountState(profileSlug);
    publishState(current);
    if (current.account?.status === "active") return current;

    const businessRequired = current.policy.requiredIdentity === "business";
    if (businessRequired && !current.viewerBusiness && normalizedBusinessName.length < 2) {
      throw new Error("Enter the name of your business.");
    }

    try {
      const created = await createProfileAccount({
        profileSlug,
        businessName: businessRequired ? normalizedBusinessName : null,
        sourcePath: currentProfileAccountSourcePath(profileSlug),
      });
      publishState(created);
      return created;
    } catch (nextError) {
      const authError = nextError as AuthError;
      if (allowLoginRetry && authError.status === 401 && email.trim() && password) {
        await signIn();
        current = await createProfileAccount({
          profileSlug,
          businessName: businessRequired ? normalizedBusinessName : null,
          sourcePath: currentProfileAccountSourcePath(profileSlug),
        });
        publishState(current);
        return current;
      }
      throw nextError;
    }
  };

  const createNewIdentityAndAccount = async () => {
    if (!data) throw new Error("Account details must load before registration can continue.");
    if (!firstName.trim()) throw new Error("Enter your first name.");
    if (!lastName.trim()) throw new Error("Enter your last name.");
    if (!email.trim() || !email.includes("@")) throw new Error("Enter a valid email address.");
    if (phone.replace(/\D/g, "").length < 10) throw new Error("Enter a valid phone number.");
    if (requiresBusiness && normalizedBusinessName.length < 2) {
      throw new Error("Enter the name of your business.");
    }
    const passwordMessage = passwordProblem(password);
    if (passwordMessage) throw new Error(passwordMessage);
    if (password !== confirmPassword) throw new Error("The passwords do not match.");
    if (!acceptTerms) throw new Error("Accept the Terms of Service and Privacy Policy.");

    const returnPath = rememberProfileAccountReturnPath(profileSlug, "signin");
    try {
      await submitAuth("/api/auth/register", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        acceptTerms: true,
        allowPhoneCalls: false,
        userTypes: [],
        userIntent: "profile_account",
        source: "profile_account",
        next: returnPath,
      });
    } catch (nextError) {
      const authError = nextError as AuthError;
      if (authError.status === 409 || authError.code === "AUTH_ACCOUNT_EXISTS") {
        setMode("signin");
        throw new Error(
          `An account already exists for ${email.trim()}. Sign in to continue with ${profileName}.`
        );
      }
      throw nextError;
    }

    await refetch().catch(() => undefined);
    await finishProfileAccount(true);
  };

  const submit = async () => {
    if (submitting || !data) return;
    setSubmitting(true);
    setError("");
    try {
      if (hasViewerSession) {
        await finishProfileAccount(false);
      } else if (mode === "signin") {
        await signIn();
        await finishProfileAccount(false);
      } else {
        await createNewIdentityAndAccount();
      }
    } catch (nextError) {
      const authError = nextError as AuthError;
      if (authError.code === "AUTH_SOCIAL_ONLY") {
        setMode("signin");
        setError("Set a password for this email below, then sign in here.");
      } else {
        setError(nextError instanceof Error ? nextError.message : "Account could not be created.");
      }
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
  const secondaryClass = isDark
    ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
    : "border-stone-300 bg-white text-stone-900 hover:bg-stone-50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="profile-account-dialog"
        className={cn(
          "max-h-[92vh] overflow-y-auto sm:max-w-xl",
          isDark
            ? "border-white/10 bg-stone-950 text-white"
            : "border-stone-200 bg-white text-stone-950"
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
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            ) : requiresBusiness ? (
              <Building2 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <DialogTitle className={cn("text-2xl", isDark ? "text-white" : "text-stone-950")}>
            {connected
              ? `Your ${profileName} account`
              : hasViewerSession
                ? `Create your account with ${profileName}`
                : mode === "signin"
                  ? `Sign in to ${profileName}`
                  : `Create an account with ${profileName}`}
          </DialogTitle>
          <DialogDescription className={mutedClass}>{description}</DialogDescription>
        </DialogHeader>

        {loading && !data ? (
          <div
            className={cn("flex min-h-32 items-center justify-center gap-2 text-sm", mutedClass)}
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Opening your account…
          </div>
        ) : loadError && !data ? (
          <div className="space-y-4" data-testid="profile-account-load-error">
            <p
              className={cn(
                "rounded-xl px-3 py-3 text-sm font-bold",
                isDark ? "bg-red-400/10 text-red-200" : "bg-red-50 text-red-800"
              )}
              role="alert"
            >
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => setLoadAttempt((current) => current + 1)}
              className={cn(
                "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-5 text-sm font-black transition",
                secondaryClass
              )}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : connected ? (
          <div className="space-y-4" data-testid="profile-account-dialog-connected">
            <div
              className={cn(
                "rounded-2xl border p-4 text-sm leading-6",
                isDark
                  ? "border-emerald-400/20 bg-emerald-400/10"
                  : "border-emerald-200 bg-emerald-50"
              )}
            >
              <p className="font-black">
                {data?.account?.businessName || "Your account"} is connected to {profileName}.
              </p>
              {data?.account?.verificationStatus === "pending" ? (
                <p className={cn("mt-1", mutedClass)}>
                  Your account is active. Protected business features remain limited until
                  verification is complete.
                </p>
              ) : null}
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
        ) : data ? (
          <div className="space-y-4">
            {requiresBusiness && (needsBusinessName || !hasViewerSession) ? (
              <label className={labelClass}>
                <span>Business name</span>
                <input
                  data-testid="profile-account-business-name"
                  className={inputClass}
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  autoComplete="organization"
                  placeholder="Your business name"
                />
              </label>
            ) : requiresBusiness && data.viewerBusiness ? (
              <div
                className={cn(
                  "rounded-2xl border p-4 text-sm",
                  isDark ? "border-white/10 bg-white/5" : "border-stone-200 bg-stone-50"
                )}
              >
                <p className={cn("text-xs font-black uppercase tracking-[0.15em]", mutedClass)}>
                  Business
                </p>
                <p className="mt-1 font-black">{data.viewerBusiness.name}</p>
              </div>
            ) : null}

            {!hasViewerSession && mode === "create" ? (
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

            {!hasViewerSession ? (
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
                    inputMode="email"
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
                      inputMode="tel"
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
                        I agree to the{" "}
                        <a
                          className="font-bold underline"
                          href="/terms"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Terms of Service
                        </a>{" "}
                        and acknowledge the{" "}
                        <a
                          className="font-bold underline"
                          href="/privacy"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Privacy Policy
                        </a>
                        .
                      </span>
                    </label>
                  </>
                ) : null}
              </>
            ) : null}

            {error ? (
              <p
                data-testid="profile-account-error"
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-bold",
                  isDark ? "bg-red-400/10 text-red-200" : "bg-red-50 text-red-800"
                )}
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="button"
              data-testid="profile-account-submit"
              onClick={() => void submit()}
              disabled={submitting || !data}
              className={cn(
                "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-black transition disabled:cursor-wait disabled:opacity-60",
                primaryClass
              )}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : mode === "signin" && !hasViewerSession ? (
                <LogIn className="h-4 w-4" aria-hidden="true" />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              )}
              {hasViewerSession
                ? `Create account with ${profileName}`
                : mode === "signin"
                  ? "Sign in and continue"
                  : `Create account with ${profileName}`}
            </button>

            {!hasViewerSession && mode === "signin" ? (
              <a
                href={`/reset-password?next=${encodeURIComponent(profileSigninReturnPath)}`}
                onClick={() => rememberProfileAccountReturnPath(profileSlug, "signin")}
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center border-t border-current/10 pt-4 text-sm font-bold underline-offset-4 hover:underline",
                  mutedClass
                )}
              >
                Forgot or need to set your password?
              </a>
            ) : null}

            {!hasViewerSession ? (
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
                {mode === "create"
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
