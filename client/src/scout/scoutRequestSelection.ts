/** One pending continuation per mounted work list. No request data is retained. */
export interface ScoutRequestSelection {
  select(controller: AbortController): boolean;
  isCurrent(controller: AbortController): boolean;
  finish(controller: AbortController): void;
  cancel(): void;
}

export function createScoutRequestSelection(): ScoutRequestSelection {
  let active: AbortController | null = null;
  return {
    select(controller) {
      if (controller.signal.aborted) return false;
      const previous = active;
      active = controller;
      if (previous !== controller) previous?.abort();
      // An abort listener may itself cancel or replace this selection.
      return active === controller && !controller.signal.aborted;
    },
    isCurrent(controller) {
      return active === controller && !controller.signal.aborted;
    },
    finish(controller) {
      // A late completion must never clear a newer selection.
      if (active === controller) active = null;
    },
    cancel() {
      const previous = active;
      active = null;
      previous?.abort();
    },
  };
}
