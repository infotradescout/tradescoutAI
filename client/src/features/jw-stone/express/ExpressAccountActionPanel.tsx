import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { JW_STONE_BRAND_STYLE, jw } from "../brand";
import type { JwExpressAccountActionState } from "./useJwExpressAccountAction";

export function ExpressAccountActionPanel({
  state,
  onDismiss,
  onCompleteReset,
}: {
  state: JwExpressAccountActionState | null;
  onDismiss: () => void;
  onCompleteReset: (password: string, passwordConfirmation: string) => Promise<void>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  if (!state) return null;
  const canEnterResetPassword =
    state.kind === "reset" &&
    (state.status === "ready" || (state.status === "error" && Boolean(state.token)));

  const submitReset = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "");
    const byteLength = new TextEncoder().encode(password).length;
    if (byteLength < 10 || byteLength > 72) {
      setFormError("Password must be between 10 and 72 UTF-8 bytes.");
      return;
    }
    if (password !== passwordConfirmation) {
      setFormError("Passwords do not match.");
      return;
    }
    void onCompleteReset(password, passwordConfirmation);
  };

  const title =
    state.kind === "verify"
      ? state.status === "complete"
        ? "Email verified"
        : "Verifying your email"
      : canEnterResetPassword
        ? "Choose a new password"
        : state.status === "complete"
          ? "Password changed"
          : "Resetting your password";

  return (
    <Dialog open onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent
        style={JW_STONE_BRAND_STYLE}
        className="z-[1100] max-h-[92dvh] max-w-lg overflow-y-auto rounded-none border border-[var(--jw-border)] bg-[var(--jw-bg)] p-0 text-[var(--jw-ink)] sm:rounded-none"
        data-testid="jw-express-account-action"
      >
        <div className="px-5 pb-6 pt-8 sm:px-8 sm:pb-8">
          <DialogTitle className="font-editorial text-3xl font-normal leading-tight">
            {title}
          </DialogTitle>
          <DialogDescription className={`mt-2 text-sm leading-6 ${jw.muted}`}>
            This JW Express action is separate from any TradeScout account.
          </DialogDescription>

          {state.status === "processing" ? (
            <p className={`mt-6 text-sm ${jw.muted}`} role="status">
              Completing the secure account action…
            </p>
          ) : null}

          {state.status === "error" ? (
            <div className={`mt-6 border px-4 py-4 text-sm ${jw.border}`} role="alert">
              {state.message}
            </div>
          ) : null}

          {state.kind === "verify" && state.status === "complete" ? (
            <p className="mt-6 text-sm leading-6">
              Your email is verified. You can now sign in to JW Express and manage your private
              offers.
            </p>
          ) : null}

          {canEnterResetPassword ? (
            <form className="mt-6 space-y-4" onSubmit={submitReset}>
              <Field label="New password" htmlFor="jw-action-password">
                <input
                  id="jw-action-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  className={`min-h-12 w-full px-3 ${jw.field}`}
                />
              </Field>
              <Field label="Confirm new password" htmlFor="jw-action-password-confirmation">
                <input
                  id="jw-action-password-confirmation"
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  className={`min-h-12 w-full px-3 ${jw.field}`}
                />
              </Field>
              {formError ? (
                <p className="text-sm text-red-800" role="alert">
                  {formError}
                </p>
              ) : null}
              <button type="submit" className={`min-h-12 w-full px-5 ${jw.accentCta}`}>
                Change password
              </button>
            </form>
          ) : null}

          {state.kind === "reset" && state.status === "complete" ? (
            <p className="mt-6 text-sm leading-6">
              Your password has been changed and prior JW Express sessions have been signed out.
            </p>
          ) : null}

          {state.status !== "ready" && state.status !== "processing" ? (
            <button
              type="button"
              onClick={onDismiss}
              className={`mt-6 min-h-11 w-full px-5 ${jw.ghostOnLight}`}
            >
              Close
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--jw-ink)]">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
