export type ExplicitOnboardingCompletionRecord = {
  onboardingCompleted?: boolean | null;
};

export function isOutcomeOnboardingComplete(
  record: ExplicitOnboardingCompletionRecord | null | undefined
): boolean {
  return record?.onboardingCompleted === true;
}
