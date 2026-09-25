import { useCallback, useEffect, useState } from "react";

// External Scout handoffs and the active composer use this one-time draft slot.
export const SCOUT_MAIN_INPUT_DRAFT_KEY = "scout:prefill:scout-main";
export const SCOUT_MAIN_INPUT_OWNER_KEY = "scout:draft-owner:scout-main";
const SCOUT_MAIN_INPUT_HANDOFF_KEY = "scout:external-handoff-owner:scout-main";
export const SCOUT_HELP_INTENT_KEY = "scout:help-intent";
const SCOUT_LAUNCH_OWNER_KEY_PREFIX = "scout:launch-owner:scout-main:";

function launchSignatureFingerprint(signature: string): string {
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash = Math.imul(hash ^ signature.charCodeAt(index), 16777619) >>> 0;
  }
  // A collision can reject a fresh launch, but cannot admit the same launch for another owner.
  return `${signature.length}:${hash.toString(16)}`;
}

export function clearScoutInputDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SCOUT_MAIN_INPUT_DRAFT_KEY);
    window.localStorage.removeItem(SCOUT_MAIN_INPUT_OWNER_KEY);
    window.localStorage.removeItem(SCOUT_MAIN_INPUT_HANDOFF_KEY);
  } catch {
    // Storage can be unavailable; the mounted composer still resets on task change.
  }
}

/** An explicit navigation/selection handoff remains bound to its origin account. */
export function writeScoutExternalPrefill(prompt: string, owner: string | null): void {
  if (typeof window === "undefined" || !owner) return;
  clearScoutInputDraft();
  try {
    window.localStorage.setItem(SCOUT_MAIN_INPUT_HANDOFF_KEY, owner);
    window.localStorage.setItem(SCOUT_MAIN_INPUT_DRAFT_KEY, prompt);
  } catch {
    clearScoutInputDraft();
  }
}

export function writeScoutOwnedDraft(value: string, owner: string | null): void {
  if (typeof window === "undefined" || !owner) return;
  clearScoutInputDraft();
  if (!value) return;
  try {
    window.localStorage.setItem(SCOUT_MAIN_INPUT_OWNER_KEY, owner);
    window.localStorage.setItem(SCOUT_MAIN_INPUT_DRAFT_KEY, value);
  } catch {
    clearScoutInputDraft();
  }
}

/** Unmarked legacy text and another account's draft fail closed. */
export function readScoutDraftForOwner(owner: string | null): string | null {
  if (typeof window === "undefined" || !owner) return null;
  try {
    const value = window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY);
    if (!value) return null;
    if (window.localStorage.getItem(SCOUT_MAIN_INPUT_HANDOFF_KEY) === owner) return value;
    if (window.localStorage.getItem(SCOUT_MAIN_INPUT_OWNER_KEY) === owner) return value;
    clearScoutInputDraft();
  } catch {
    // No cross-account fallback when storage is unavailable.
  }
  return null;
}

/** Help intents auto-send, so an old or unowned value must never cross accounts. */
export function takeScoutHelpIntentForOwner(owner: string | null): string | null {
  if (typeof window === "undefined" || !owner) return null;
  try {
    const raw = window.localStorage.getItem(SCOUT_HELP_INTENT_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(SCOUT_HELP_INTENT_KEY);
    const parsed = JSON.parse(raw) as { owner?: unknown; prompt?: unknown } | null;
    return parsed?.owner === owner && typeof parsed.prompt === "string" && parsed.prompt.trim()
      ? parsed.prompt
      : null;
  } catch {
    return null;
  }
}

export type ScoutLaunchAcceptance = "none" | "pending" | "accepted" | "blocked";

/** A whole URL launch belongs to the first account that accepted it in this tab. */
export function useScoutAccountBoundLaunch(
  signature: string,
  hasLaunch: boolean,
  owner: string | null,
  continuationSignature?: string
): ScoutLaunchAcceptance {
  const [binding, setBinding] = useState<{
    fingerprint: string;
    owner: string;
    accepted: boolean;
  } | null>(null);
  const fingerprint = launchSignatureFingerprint(signature);
  const continuationFingerprint = continuationSignature
    ? launchSignatureFingerprint(continuationSignature)
    : null;
  useEffect(() => {
    if (!hasLaunch || !owner) return;
    try {
      const launchKey = `${SCOUT_LAUNCH_OWNER_KEY_PREFIX}${fingerprint}`;
      const existingOwner = window.sessionStorage.getItem(launchKey);
      if (existingOwner && existingOwner !== owner) {
        setBinding({ fingerprint, owner, accepted: false });
        return;
      }
      // Consuming a URL prompt leaves its context in place. Reserve that exact
      // context-only continuation before the prompt disappears from the URL.
      if (continuationFingerprint && continuationFingerprint !== fingerprint) {
        const continuationKey = `${SCOUT_LAUNCH_OWNER_KEY_PREFIX}${continuationFingerprint}`;
        if (!window.sessionStorage.getItem(continuationKey)) {
          window.sessionStorage.setItem(continuationKey, owner);
        }
      }
      window.sessionStorage.setItem(launchKey, owner);
      setBinding({ fingerprint, owner, accepted: true });
    } catch {
      // Without tab-scoped ownership, reloading under another account must fail closed.
      setBinding({ fingerprint, owner, accepted: false });
    }
  }, [continuationFingerprint, fingerprint, hasLaunch, owner]);
  if (!hasLaunch) return "none";
  if (!owner || binding?.fingerprint !== fingerprint || binding.owner !== owner) return "pending";
  return binding.accepted ? "accepted" : "blocked";
}

/** Kept for callers that only need the prompt part of an accepted launch. */
export function useScoutAccountBoundLaunchPrompt(
  signature: string,
  prompt: string | undefined,
  owner: string | null
): string | undefined {
  const acceptance = useScoutAccountBoundLaunch(signature, Boolean(prompt), owner);
  return acceptance === "accepted" ? prompt : undefined;
}

export function discardScoutDraftForTaskChange(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const previous = window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY);
    clearScoutInputDraft();
    return Boolean(previous?.trim() && previous !== "__SCOUT_ONBOARDING__");
  } catch {
    return false;
  }
}

/** An explicit task change drops the old draft and remounts the composer. */
export function useScoutTaskDraftBoundary(onDiscarded?: () => void) {
  const [version, setVersion] = useState(0);
  const changeTask = useCallback(() => {
    const hadDraft = discardScoutDraftForTaskChange();
    setVersion((current) => current + 1);
    if (hadDraft) onDiscarded?.();
  }, [onDiscarded]);
  return { version, changeTask };
}
