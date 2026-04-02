export function shouldInjectSponsored(args: {
  userId?: string;
  historyLength: number;
  rolesLength: number;
  countyCode?: string;
  stateCode?: string;
  shownAdIdsLength: number;
}): boolean {
  // Trust window: never inject sponsored on the first real Scout answer.
  // The client may send 0 or 1 history items on the first prompt depending on timing,
  // so we conservatively treat <= 1 as "first answer".
  if (args.historyLength <= 1) return false;

  // Session frequency cap (enforced client-side too, but server should respect it).
  if (args.shownAdIdsLength >= 2) return false;

  // Safety invariant: never inject sponsored during guest first-run onboarding.
  // That flow is client-driven, but this prevents edge-cases (or future changes)
  // from accidentally monetizing onboarding.
  const isLikelyFirstRunOnboarding =
    !args.userId &&
    args.historyLength === 0 &&
    args.rolesLength === 0 &&
    !args.countyCode &&
    !args.stateCode;

  if (isLikelyFirstRunOnboarding) return false;

  return true;
}
