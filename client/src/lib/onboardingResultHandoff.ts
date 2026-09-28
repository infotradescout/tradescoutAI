const ONBOARDING_RESULT_PROMPT_KEY = "ts_onboarding_result_prompt";
const MAX_ONBOARDING_RESULT_PROMPT_LENGTH = 2_000;
type PendingOnboardingPrompt = { owner: string; prompt: string };
let inMemoryOnboardingResultPrompt: PendingOnboardingPrompt | null = null;

export function storeOnboardingResultPrompt(prompt: string, owner: string | null): void {
  const value = String(prompt || "")
    .trim()
    .slice(0, MAX_ONBOARDING_RESULT_PROMPT_LENGTH);
  if (!value || !owner) return;
  const pending = { owner, prompt: value };
  inMemoryOnboardingResultPrompt = pending;
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(ONBOARDING_RESULT_PROMPT_KEY, JSON.stringify(pending));
  } catch {
    // The account-bound module handoff remains available for this SPA navigation.
  }
}

export function readOnboardingResultPrompt(owner: string | null): string {
  if (typeof window === "undefined" || !owner) return "";

  try {
    const raw = window.sessionStorage.getItem(ONBOARDING_RESULT_PROMPT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PendingOnboardingPrompt | null;
      if (parsed?.owner === owner && typeof parsed.prompt === "string") {
        return parsed.prompt.trim().slice(0, MAX_ONBOARDING_RESULT_PROMPT_LENGTH);
      }
      clearOnboardingResultPrompt();
      return "";
    }
  } catch {
    // If storage is denied, use only the account-bound in-memory handoff.
  }
  if (inMemoryOnboardingResultPrompt && inMemoryOnboardingResultPrompt.owner !== owner) {
    clearOnboardingResultPrompt();
    return "";
  }
  return inMemoryOnboardingResultPrompt?.owner === owner
    ? inMemoryOnboardingResultPrompt.prompt
    : "";
}

export function clearOnboardingResultPrompt(): void {
  inMemoryOnboardingResultPrompt = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ONBOARDING_RESULT_PROMPT_KEY);
  } catch {
    // fail-soft: the in-memory send guard still prevents a duplicate in this mount
  }
}

export function consumeOnboardingResultPrompt(owner: string | null): string {
  const value = readOnboardingResultPrompt(owner);
  clearOnboardingResultPrompt();
  return value;
}

export { ONBOARDING_RESULT_PROMPT_KEY };
