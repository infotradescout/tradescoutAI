import { useCallback, useEffect, useState } from "react";

// External Scout handoffs and the active composer use this one-time draft slot.
export const SCOUT_MAIN_INPUT_DRAFT_KEY = "scout:prefill:scout-main";
export const SCOUT_MAIN_INPUT_OWNER_KEY = "scout:draft-owner:scout-main";
const SCOUT_MAIN_INPUT_HANDOFF_KEY = "scout:external-handoff-owner:scout-main";
export const SCOUT_HELP_INTENT_KEY = "scout:help-intent";

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

/** A URL prompt belongs to the account that first accepts this launch. */
export function useScoutAccountBoundLaunchPrompt(
  signature: string,
  prompt: string | undefined,
  owner: string | null
): string | undefined {
  const [accepted, setAccepted] = useState<{ signature: string; owner: string } | null>(null);
  useEffect(() => {
    if (!prompt || !owner) return;
    setAccepted((current) =>
      current?.signature === signature ? current : { signature, owner }
    );
  }, [signature, prompt, owner]);
  return accepted?.signature === signature && accepted.owner === owner ? prompt : undefined;
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
