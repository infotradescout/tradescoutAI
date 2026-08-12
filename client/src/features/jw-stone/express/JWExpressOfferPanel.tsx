import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { JW_STONE_BRAND_STYLE, jw } from "../brand";
import type { JwStoneCatalogItem } from "../types";
import {
  JwExpressApiError,
  closeJwExpressAccount,
  displayUsdAmount,
  getJwExpressSession,
  getOwnJwExpressOffers,
  normalizeUsdOfferAmount,
  registerJwExpressAccountAndOffer,
  requestJwExpressPasswordReset,
  resendJwExpressVerification,
  resolveJwStoneOfferTarget,
  reviseJwExpressOffer,
  signInJwExpress,
  signOutJwExpress,
  submitJwExpressOffer,
  withdrawJwExpressOffer,
} from "./api";
import type {
  JwExpressOffer,
  JwExpressOfferStatus,
  JwExpressOfferTarget,
  JwExpressSession,
} from "./types";

type Entry =
  | Readonly<{ kind: "account" }>
  | Readonly<{ kind: "stone"; stone: JwStoneCatalogItem }>
  | Readonly<{ kind: "target"; target: JwExpressOfferTarget }>;

type PanelMode = "signin" | "signup" | "reset";

const EMPTY_SESSION: JwExpressSession = Object.freeze({ account: null, csrfToken: null });

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof JwExpressApiError && error.message ? error.message : fallback;
}

function passwordError(password: string, confirmation: string): string | null {
  const byteLength = new TextEncoder().encode(password).length;
  if (byteLength < 10 || byteLength > 72) {
    return "Password must be between 10 and 72 UTF-8 bytes.";
  }
  return password === confirmation ? null : "Passwords do not match.";
}

function offerStatusLabel(status: JwExpressOfferStatus): string {
  return {
    pending_verification: "Pending email verification",
    submitted: "Submitted",
    under_review: "Under review",
    accepted: "Accepted",
    declined: "Declined",
    withdrawn: "Withdrawn",
    expired: "Expired",
  }[status];
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function JWExpressOfferPanel({
  entry,
  onClose,
}: {
  entry: Entry | null;
  onClose: () => void;
}) {
  const [session, setSession] = useState<JwExpressSession>(EMPTY_SESSION);
  const [offers, setOffers] = useState<readonly JwExpressOffer[]>([]);
  const [target, setTarget] = useState<JwExpressOfferTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [targetLoading, setTargetLoading] = useState(false);
  const [mode, setMode] = useState<PanelMode>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [isBusiness, setIsBusiness] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const nextSession = await getJwExpressSession(signal);
    setSession(nextSession);
    if (nextSession.account) {
      setOffers(await getOwnJwExpressOffers(signal));
    } else {
      setOffers([]);
    }
    return nextSession;
  }, []);

  useEffect(() => {
    if (!entry) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setNotice(null);
    setPendingEmail(null);
    setIsBusiness(false);
    setMode(entry.kind === "account" ? "signin" : "signup");
    void refresh(controller.signal)
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(errorMessage(loadError, "JW Express could not be loaded."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [entry, refresh]);

  useEffect(() => {
    if (!entry) return;
    if (entry.kind === "target") {
      setTarget(entry.target);
      setTargetLoading(false);
      return;
    }
    if (entry.kind === "account") {
      setTarget(null);
      setTargetLoading(false);
      return;
    }
    const controller = new AbortController();
    setTarget(null);
    setTargetLoading(true);
    setError(null);
    void resolveJwStoneOfferTarget(entry.stone, controller.signal)
      .then(setTarget)
      .catch((resolveError: unknown) => {
        if (resolveError instanceof DOMException && resolveError.name === "AbortError") return;
        setError(errorMessage(resolveError, "This stone could not be prepared for an offer."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setTargetLoading(false);
      });
    return () => controller.abort();
  }, [entry]);

  const selectedOffer = useMemo(
    () => (target ? (offers.find((offer) => offer.targetRef === target.ref) ?? null) : null),
    [offers, target]
  );

  const run = async (
    action: () => Promise<void>,
    success: string,
    refreshAfter = true
  ): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (refreshAfter) await refresh();
      setNotice(success);
      return true;
    } catch (actionError) {
      setError(errorMessage(actionError, "JW Express could not complete that request."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "");
    const invalidPassword = passwordError(password, passwordConfirmation);
    if (invalidPassword) {
      setError(invalidPassword);
      return;
    }
    let amount: string;
    try {
      amount = normalizeUsdOfferAmount(String(form.get("amount") ?? ""));
    } catch (amountError) {
      setError(amountError instanceof Error ? amountError.message : "Enter a valid offer amount.");
      return;
    }
    const email = String(form.get("email") ?? "").trim();
    const businessName = String(form.get("businessName") ?? "").trim();
    void run(
      () =>
        registerJwExpressAccountAndOffer({
          legalName: String(form.get("legalName") ?? "").trim(),
          email,
          phone: String(form.get("phone") ?? "").trim(),
          isBusiness,
          businessName: isBusiness ? businessName : null,
          password,
          passwordConfirmation,
          offer: { target: { kind: target.kind, ref: target.ref }, amount },
        }),
      "Your private offer is saved pending email verification. Check your email to activate it."
    ).then((completed) => {
      if (completed) setPendingEmail(email);
    });
  };

  const submitSignin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () =>
        signInJwExpress({
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
        }),
      "Signed in to JW Express."
    );
  };

  const submitResetRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () => requestJwExpressPasswordReset(String(form.get("email") ?? "").trim()),
      "If that email belongs to a JW Express account, a reset link is on its way.",
      false
    );
  };

  const submitOffer = (event: FormEvent<HTMLFormElement>, offer?: JwExpressOffer) => {
    event.preventDefault();
    if (!target || !session.csrfToken) return;
    let amount: string;
    try {
      amount = normalizeUsdOfferAmount(
        String(new FormData(event.currentTarget).get("amount") ?? "")
      );
    } catch (amountError) {
      setError(amountError instanceof Error ? amountError.message : "Enter a valid offer amount.");
      return;
    }
    void run(
      () =>
        offer
          ? reviseJwExpressOffer({ offerId: offer.id, amount, csrfToken: session.csrfToken! })
          : submitJwExpressOffer({
              target: { kind: target.kind, ref: target.ref },
              amount,
              csrfToken: session.csrfToken!,
            }),
      offer ? "Your private offer was revised." : "Your private offer was submitted."
    );
  };

  const submitCloseAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session.csrfToken) return;
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    void run(
      () => closeJwExpressAccount({ password, csrfToken: session.csrfToken! }),
      "Your JW Express account has been closed.",
      false
    ).then((completed) => {
      if (!completed) return;
      setSession(EMPTY_SESSION);
      setOffers([]);
      setMode(target ? "signup" : "signin");
    });
  };

  const account = session.account;
  const verificationEmail = account?.email ?? pendingEmail;

  return (
    <Dialog open={Boolean(entry)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        style={JW_STONE_BRAND_STYLE}
        className="z-[1150] max-h-[94dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto rounded-none border border-[var(--jw-border)] bg-[var(--jw-bg)] p-0 text-[var(--jw-ink)] sm:w-full sm:rounded-none"
        data-testid="jw-express-offer-panel"
      >
        <div className="px-5 pb-7 pt-8 sm:px-8 sm:pb-9">
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${jw.muted}`}>
            JW Stone Express
          </p>
          <DialogTitle className="mt-2 font-editorial text-3xl font-normal leading-tight text-[var(--jw-ink)] sm:text-4xl">
            {target ? `Private offer for ${target.label}` : "Your private offers"}
          </DialogTitle>
          <DialogDescription className={`mt-3 max-w-xl text-sm leading-6 ${jw.muted}`}>
            Offers are visible only to you and JW Stone. Other customers cannot see your amount, and
            submitting an offer does not reserve inventory or create a sale. JW Express is a JW
            Stone account, separate from any TradeScout account.
          </DialogDescription>

          {target ? <TargetSummary target={target} /> : null}
          {targetLoading ? (
            <p className={`mt-6 text-sm ${jw.muted}`} role="status">
              Preparing this listing for a private offer…
            </p>
          ) : null}
          {loading ? (
            <p className={`mt-6 text-sm ${jw.muted}`} role="status">
              Loading JW Express…
            </p>
          ) : null}

          {error ? (
            <div
              className="mt-5 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className={`mt-5 border px-4 py-3 text-sm ${jw.border}`} role="status">
              {notice}
            </div>
          ) : null}

          {!loading && !account ? (
            <GuestViews
              mode={mode}
              setMode={setMode}
              target={target}
              targetLoading={targetLoading}
              busy={busy}
              isBusiness={isBusiness}
              setIsBusiness={setIsBusiness}
              onSignup={submitSignup}
              onSignin={submitSignin}
              onReset={submitResetRequest}
              verificationEmail={verificationEmail}
              onResend={() => {
                if (!verificationEmail) return;
                void run(
                  () => resendJwExpressVerification(verificationEmail),
                  "If verification is still needed, a new email is on its way.",
                  false
                );
              }}
            />
          ) : null}

          {!loading && account ? (
            <AccountViews
              account={account}
              offers={offers}
              target={target}
              selectedOffer={selectedOffer}
              busy={busy}
              hasCsrf={Boolean(session.csrfToken)}
              onSubmitOffer={submitOffer}
              onResend={() =>
                void run(
                  () => resendJwExpressVerification(account.email),
                  "If verification is still needed, a new email is on its way.",
                  false
                )
              }
              onWithdraw={(offer) => {
                if (!session.csrfToken) return;
                void run(
                  () =>
                    withdrawJwExpressOffer({
                      offerId: offer.id,
                      csrfToken: session.csrfToken!,
                    }),
                  "Your private offer was withdrawn."
                );
              }}
              onSignOut={() => {
                if (!session.csrfToken) return;
                void run(
                  () => signOutJwExpress(session.csrfToken!),
                  "Signed out of JW Express.",
                  false
                ).then((completed) => {
                  if (!completed) return;
                  setSession(EMPTY_SESSION);
                  setOffers([]);
                  setMode(target ? "signup" : "signin");
                });
              }}
              onCloseAccount={submitCloseAccount}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TargetSummary({ target }: { target: JwExpressOfferTarget }) {
  const minimum = displayUsdAmount(target.minimumOffer);
  return (
    <div className={`mt-6 flex gap-4 border-y py-4 ${jw.border}`} data-testid="jw-express-target">
      {target.imageUrl ? (
        <img
          src={target.imageUrl}
          alt=""
          className="h-20 w-24 shrink-0 bg-[var(--jw-dark)] object-cover"
        />
      ) : null}
      <div className="min-w-0">
        <p className="font-medium">{target.label}</p>
        <p className={`mt-1 text-sm ${jw.muted}`}>
          {minimum ? `Posted minimum: ${minimum}` : "No minimum is posted."}
        </p>
        {!target.acceptingOffers ? (
          <p className="mt-1 text-sm font-medium text-red-800">
            Offers are closed for this listing.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function GuestViews({
  mode,
  setMode,
  target,
  targetLoading,
  busy,
  isBusiness,
  setIsBusiness,
  onSignup,
  onSignin,
  onReset,
  verificationEmail,
  onResend,
}: {
  mode: PanelMode;
  setMode: (mode: PanelMode) => void;
  target: JwExpressOfferTarget | null;
  targetLoading: boolean;
  busy: boolean;
  isBusiness: boolean;
  setIsBusiness: (value: boolean) => void;
  onSignup: (event: FormEvent<HTMLFormElement>) => void;
  onSignin: (event: FormEvent<HTMLFormElement>) => void;
  onReset: (event: FormEvent<HTMLFormElement>) => void;
  verificationEmail: string | null;
  onResend: () => void;
}) {
  if (verificationEmail) {
    return (
      <section className="mt-6" aria-labelledby="jw-express-verify-heading">
        <h3 id="jw-express-verify-heading" className="font-editorial text-2xl">
          Check your email
        </h3>
        <p className={`mt-2 text-sm leading-6 ${jw.muted}`}>
          Your first offer stays pending and private until you verify {verificationEmail}.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={onResend}
          className={`mt-4 min-h-11 px-4 ${jw.ghostOnLight}`}
        >
          Resend verification email
        </button>
      </section>
    );
  }

  return (
    <div className="mt-7">
      <div className="flex flex-wrap gap-2" aria-label="JW Express account options">
        {target ? (
          <ModeButton active={mode === "signup"} onClick={() => setMode("signup")}>
            Create Express account
          </ModeButton>
        ) : null}
        <ModeButton active={mode === "signin"} onClick={() => setMode("signin")}>
          Sign in
        </ModeButton>
        <ModeButton active={mode === "reset"} onClick={() => setMode("reset")}>
          Reset password
        </ModeButton>
      </div>

      {mode === "signup" && target ? (
        <form className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={onSignup}>
          <Field label="Legal name" htmlFor="jw-express-legal-name">
            <input
              id="jw-express-legal-name"
              name="legalName"
              autoComplete="name"
              required
              className={`min-h-12 w-full px-3 ${jw.field}`}
            />
          </Field>
          <Field label="Email" htmlFor="jw-express-signup-email">
            <input
              id="jw-express-signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={`min-h-12 w-full px-3 ${jw.field}`}
            />
          </Field>
          <Field label="Phone" htmlFor="jw-express-phone">
            <input
              id="jw-express-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              className={`min-h-12 w-full px-3 ${jw.field}`}
            />
          </Field>
          <label className="flex min-h-12 items-center gap-3 border border-[var(--jw-border)] px-3 text-sm font-medium">
            <input
              type="checkbox"
              name="isBusiness"
              checked={isBusiness}
              onChange={(event) => setIsBusiness(event.currentTarget.checked)}
              className="h-5 w-5"
            />
            This offer is for a business
          </label>
          {isBusiness ? (
            <div className="sm:col-span-2">
              <Field label="Business name" htmlFor="jw-express-business-name">
                <input
                  id="jw-express-business-name"
                  name="businessName"
                  autoComplete="organization"
                  required
                  className={`min-h-12 w-full px-3 ${jw.field}`}
                />
              </Field>
            </div>
          ) : null}
          <Field label="Password" htmlFor="jw-express-signup-password">
            <input
              id="jw-express-signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              className={`min-h-12 w-full px-3 ${jw.field}`}
            />
          </Field>
          <Field label="Confirm password" htmlFor="jw-express-signup-password-confirmation">
            <input
              id="jw-express-signup-password-confirmation"
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              className={`min-h-12 w-full px-3 ${jw.field}`}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Your private offer (USD)" htmlFor="jw-express-signup-amount">
              <input
                id="jw-express-signup-amount"
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                required
                className={`min-h-12 w-full px-3 ${jw.field}`}
              />
            </Field>
          </div>
          <p className={`text-xs leading-5 sm:col-span-2 ${jw.muted}`}>
            Creating this account saves one pending offer. Verify your email before JW Stone can
            review it.
          </p>
          <button
            type="submit"
            disabled={busy || targetLoading || !target.acceptingOffers}
            className={`min-h-12 w-full px-5 font-semibold sm:col-span-2 ${jw.accentCta}`}
          >
            {busy ? "Saving…" : "Create account and save private offer"}
          </button>
        </form>
      ) : null}

      {mode === "signup" && !target && !targetLoading ? (
        <p className={`mt-6 text-sm leading-6 ${jw.muted}`}>
          Choose Make An Offer on a current listing or published container to create a JW Express
          account.
        </p>
      ) : null}

      {mode === "signin" ? (
        <form className="mt-6 space-y-4" onSubmit={onSignin}>
          <Field label="Email" htmlFor="jw-express-login-email">
            <input
              id="jw-express-login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={`min-h-12 w-full px-3 ${jw.field}`}
            />
          </Field>
          <Field label="Password" htmlFor="jw-express-login-password">
            <input
              id="jw-express-login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={`min-h-12 w-full px-3 ${jw.field}`}
            />
          </Field>
          <button
            type="submit"
            disabled={busy}
            className={`min-h-12 w-full px-5 font-semibold ${jw.accentCta}`}
          >
            {busy ? "Signing in…" : "Sign in to JW Express"}
          </button>
        </form>
      ) : null}

      {mode === "reset" ? (
        <form className="mt-6 space-y-4" onSubmit={onReset}>
          <p className={`text-sm leading-6 ${jw.muted}`}>
            We will email a private reset link if the account exists.
          </p>
          <Field label="Email" htmlFor="jw-express-reset-email">
            <input
              id="jw-express-reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={`min-h-12 w-full px-3 ${jw.field}`}
            />
          </Field>
          <button
            type="submit"
            disabled={busy}
            className={`min-h-12 w-full px-5 font-semibold ${jw.accentCta}`}
          >
            Send reset link
          </button>
        </form>
      ) : null}
    </div>
  );
}

function AccountViews({
  account,
  offers,
  target,
  selectedOffer,
  busy,
  hasCsrf,
  onSubmitOffer,
  onResend,
  onWithdraw,
  onSignOut,
  onCloseAccount,
}: {
  account: NonNullable<JwExpressSession["account"]>;
  offers: readonly JwExpressOffer[];
  target: JwExpressOfferTarget | null;
  selectedOffer: JwExpressOffer | null;
  busy: boolean;
  hasCsrf: boolean;
  onSubmitOffer: (event: FormEvent<HTMLFormElement>, offer?: JwExpressOffer) => void;
  onResend: () => void;
  onWithdraw: (offer: JwExpressOffer) => void;
  onSignOut: () => void;
  onCloseAccount: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const mutableOffer =
    selectedOffer && ["submitted", "under_review"].includes(selectedOffer.status);
  const withdrawable =
    selectedOffer &&
    ["pending_verification", "submitted", "under_review"].includes(selectedOffer.status);
  return (
    <div className="mt-7 space-y-8">
      <section aria-labelledby="jw-express-account-heading">
        <div className="flex flex-col gap-3 border-b border-[var(--jw-border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="jw-express-account-heading" className="font-editorial text-2xl">
              {account.legalName}
            </h3>
            <p className={`mt-1 text-sm ${jw.muted}`}>{account.email}</p>
            {account.isBusiness && account.businessName ? (
              <p className={`mt-1 text-sm ${jw.muted}`}>{account.businessName}</p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy || !hasCsrf}
            onClick={onSignOut}
            className={`min-h-11 px-4 text-sm ${jw.ghostOnLight}`}
          >
            Sign out
          </button>
        </div>

        {!account.emailVerified ? (
          <div className={`mt-5 border px-4 py-4 ${jw.border}`}>
            <p className="font-medium">Email verification required</p>
            <p className={`mt-1 text-sm leading-6 ${jw.muted}`}>
              Your saved offer stays pending until your email is verified.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={onResend}
              className={`mt-3 min-h-11 px-4 text-sm ${jw.ghostOnLight}`}
            >
              Resend verification email
            </button>
          </div>
        ) : null}
      </section>

      {account.emailVerified && target && target.acceptingOffers ? (
        <section aria-labelledby="jw-express-offer-heading">
          <h3 id="jw-express-offer-heading" className="font-editorial text-2xl">
            {selectedOffer ? "Your offer for this listing" : "Make a private offer"}
          </h3>
          {selectedOffer ? (
            <p className={`mt-2 text-sm ${jw.muted}`}>
              Current amount: {displayUsdAmount(selectedOffer.amount)} ·{" "}
              {offerStatusLabel(selectedOffer.status)}
            </p>
          ) : null}
          {!selectedOffer || mutableOffer ? (
            <form
              className="mt-4 flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => onSubmitOffer(event, selectedOffer ?? undefined)}
            >
              <label htmlFor="jw-express-offer-amount" className="flex-1 text-sm font-medium">
                <span className="mb-1.5 block">Offer amount (USD)</span>
                <input
                  id="jw-express-offer-amount"
                  name="amount"
                  inputMode="decimal"
                  defaultValue={selectedOffer?.amount ?? ""}
                  required
                  className={`min-h-12 w-full px-3 ${jw.field}`}
                />
              </label>
              <button
                type="submit"
                disabled={busy || !hasCsrf}
                className={`min-h-12 px-6 font-semibold sm:self-end ${jw.accentCta}`}
              >
                {selectedOffer ? "Revise offer" : "Submit offer"}
              </button>
            </form>
          ) : null}
          {withdrawable ? (
            <button
              type="button"
              disabled={busy || !hasCsrf}
              onClick={() => onWithdraw(selectedOffer)}
              className={`mt-3 min-h-11 px-4 text-sm ${jw.ghostOnLight}`}
            >
              Withdraw this offer
            </button>
          ) : null}
        </section>
      ) : null}

      <OfferHistory offers={offers} />

      <details className={`border-t pt-5 ${jw.border}`}>
        <summary className="cursor-pointer text-sm font-semibold">Close JW Express account</summary>
        <p className={`mt-3 text-sm leading-6 ${jw.muted}`}>
          Closing the account withdraws active offers and permanently removes your direct contact
          details from the customer account.
        </p>
        <form className="mt-4 space-y-3" onSubmit={onCloseAccount}>
          <Field label="Confirm with your password" htmlFor="jw-express-close-password">
            <input
              id="jw-express-close-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={`min-h-12 w-full px-3 ${jw.field}`}
            />
          </Field>
          <button
            type="submit"
            disabled={busy || !hasCsrf}
            className="min-h-11 border border-red-700 px-4 text-sm font-semibold text-red-800 hover:bg-red-50"
          >
            Close account permanently
          </button>
        </form>
      </details>
    </div>
  );
}

function OfferHistory({ offers }: { offers: readonly JwExpressOffer[] }) {
  return (
    <section aria-labelledby="jw-express-history-heading">
      <h3 id="jw-express-history-heading" className="font-editorial text-2xl">
        Private offer history
      </h3>
      {offers.length === 0 ? (
        <p className={`mt-2 text-sm ${jw.muted}`}>No offers have been saved on this account.</p>
      ) : (
        <ul className="mt-4 space-y-3" data-testid="jw-express-offer-history">
          {offers.map((offer) => (
            <li key={offer.id} className={`border px-4 py-4 ${jw.border}`}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <p className="font-medium">{offer.targetLabel}</p>
                <p className="text-sm font-semibold">{displayUsdAmount(offer.amount)}</p>
              </div>
              <p className={`mt-1 text-sm ${jw.muted}`}>
                {offerStatusLabel(offer.status)}
                {formatDate(offer.updatedAt ?? offer.submittedAt)
                  ? ` · ${formatDate(offer.updatedAt ?? offer.submittedAt)}`
                  : ""}
              </p>
              {offer.versions.length > 1 ? (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium">View revisions</summary>
                  <ol className={`mt-2 space-y-1 ${jw.muted}`}>
                    {offer.versions.map((version) => (
                      <li key={version.id}>
                        {displayUsdAmount(version.amount)} · {offerStatusLabel(version.status)}
                        {formatDate(version.submittedAt)
                          ? ` · ${formatDate(version.submittedAt)}`
                          : ""}
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 px-4 text-sm font-semibold ${active ? jw.accentCta : jw.ghostOnLight}`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--jw-ink)]">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export type { Entry as JwExpressPanelEntry };
