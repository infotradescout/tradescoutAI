import { useCallback, useState } from "react";

// External Scout handoffs and the active composer use this one-time draft slot.
export const SCOUT_MAIN_INPUT_DRAFT_KEY = "scout:prefill:scout-main";

export function discardScoutDraftForTaskChange(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const previous = window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY);
    window.localStorage.removeItem(SCOUT_MAIN_INPUT_DRAFT_KEY);
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
