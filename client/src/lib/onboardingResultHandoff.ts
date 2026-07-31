const ONBOARDING_RESULT_PROMPT_KEY = "ts_onboarding_result_prompt";
const MAX_ONBOARDING_RESULT_PROMPT_LENGTH = 2_000;
let inMemoryOnboardingResultPrompt = "";

export function storeOnboardingResultPrompt(prompt: string): void {
  const value = String(prompt || "")
    .trim()
    .slice(0, MAX_ONBOARDING_RESULT_PROMPT_LENGTH);
  if (!value) return;
  inMemoryOnboardingResultPrompt = value;
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(ONBOARDING_RESULT_PROMPT_KEY, value);
  } catch {
    // The module-scoped handoff remains available for this SPA navigation.
  }
}

export function readOnboardingResultPrompt(): string {
  if (typeof window === "undefined") return "";

  try {
    const stored = String(window.sessionStorage.getItem(ONBOARDING_RESULT_PROMPT_KEY) || "")
      .trim()
      .slice(0, MAX_ONBOARDING_RESULT_PROMPT_LENGTH);
    return stored || inMemoryOnboardingResultPrompt;
  } catch {
    return inMemoryOnboardingResultPrompt;
  }
}

export function clearOnboardingResultPrompt(): void {
  inMemoryOnboardingResultPrompt = "";
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ONBOARDING_RESULT_PROMPT_KEY);
  } catch {
    // fail-soft: the in-memory send guard still prevents a duplicate in this mount
  }
}

export function consumeOnboardingResultPrompt(): string {
  const value = readOnboardingResultPrompt();
  clearOnboardingResultPrompt();
  return value;
}

export { ONBOARDING_RESULT_PROMPT_KEY };
