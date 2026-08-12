import { useCallback, useEffect, useRef, useState } from "react";
import { confirmJwExpressVerification, confirmJwExpressPasswordReset } from "./api";

export type JwExpressFragmentAction = Readonly<{
  kind: "verify" | "reset";
  token: string;
}>;

export type JwExpressAccountActionState =
  | Readonly<{ kind: "verify" | "reset"; status: "processing" }>
  | Readonly<{ kind: "verify"; status: "complete" }>
  | Readonly<{ kind: "reset"; status: "ready"; token: string }>
  | Readonly<{ kind: "reset"; status: "complete" }>
  | Readonly<{ kind: "verify"; status: "error"; message: string }>
  | Readonly<{ kind: "reset"; status: "error"; message: string; token?: string }>;

let capturedFragmentAction: JwExpressFragmentAction | null | undefined;

function validFragmentToken(value: string | null): string | null {
  if (!value) return null;
  const token = value.trim();
  if (token.length < 8 || token.length > 4096 || /[\u0000-\u001f\u007f]/.test(token)) return null;
  return token;
}

export function parseJwExpressActionFragment(hash: string): JwExpressFragmentAction | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);

  const canonicalKind = params.get("jw-express-action");
  if (canonicalKind === "verify" || canonicalKind === "reset") {
    const token = validFragmentToken(params.get("token"));
    return token ? { kind: canonicalKind, token } : null;
  }

  const candidates = [
    ["jw-express-verify", "verify"],
    ["verify", "verify"],
    ["jw-express-reset", "reset"],
    ["reset", "reset"],
  ] as const;
  for (const [key, kind] of candidates) {
    if (!params.has(key)) continue;
    const token = validFragmentToken(params.get(key));
    return token ? { kind, token } : null;
  }
  return null;
}

function hashContainsJwExpressAction(hash: string): boolean {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return false;
  const params = new URLSearchParams(raw);
  return (
    params.has("jw-express-action") ||
    params.has("jw-express-verify") ||
    params.has("verify") ||
    params.has("jw-express-reset") ||
    params.has("reset")
  );
}

function captureActionFromWindow(): JwExpressFragmentAction | null {
  if (typeof window === "undefined") return null;
  if (capturedFragmentAction !== undefined) return capturedFragmentAction;

  const hash = window.location.hash;
  const parsed = parseJwExpressActionFragment(hash);
  capturedFragmentAction = parsed;

  // Recognized account-action fragments are removed before any marketplace URL
  // canonicalization runs. Ordinary section anchors remain untouched.
  if (hashContainsJwExpressAction(hash)) {
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`
    );
  }

  return parsed;
}

export function useJwExpressAccountAction() {
  const actionRef = useRef<JwExpressFragmentAction | null>(null);
  const [state, setState] = useState<JwExpressAccountActionState | null>(() => {
    const action = captureActionFromWindow();
    actionRef.current = action;
    return action ? { kind: action.kind, status: "processing" } : null;
  });

  useEffect(() => {
    const action = actionRef.current;
    actionRef.current = null;
    // Keep the cache only through initial render (including Strict Mode's double
    // render), then allow a later navigation/mount to capture a new fragment.
    capturedFragmentAction = undefined;
    if (!action) return;

    let active = true;
    if (action.kind === "reset") {
      setState({ kind: "reset", status: "ready", token: action.token });
      return;
    }

    void confirmJwExpressVerification(action.token)
      .then(() => {
        if (!active) return;
        setState({ kind: "verify", status: "complete" });
      })
      .catch(() => {
        if (!active) return;
        setState({
          kind: action.kind,
          status: "error",
          message:
            "This verification link could not be completed. It may have expired or already been used.",
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => setState(null), []);

  const completeReset = useCallback(
    async (password: string, passwordConfirmation: string) => {
      const token =
        state?.kind === "reset" && (state.status === "ready" || state.status === "error")
          ? (state.token ?? null)
          : null;
      if (!token) return;
      setState({ kind: "reset", status: "processing" });
      try {
        await confirmJwExpressPasswordReset({ token, password, passwordConfirmation });
        setState({ kind: "reset", status: "complete" });
      } catch {
        setState({
          kind: "reset",
          status: "error",
          token,
          message: "Your password could not be changed. Request a new reset link and try again.",
        });
      }
    },
    [state]
  );

  return { state, dismiss, completeReset } as const;
}
