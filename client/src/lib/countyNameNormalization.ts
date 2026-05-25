import { US_STATES_COUNTIES } from "@shared/states-counties";

type CanonicalCountyMatch = {
  countyFips: string;
  countyName: string;
  stateCode: string;
};

function normalizeCountyToken(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^parroquia\s+de\s+/i, "")
    .replace(/^parish\s+of\s+/i, "")
    .replace(/^county\s+of\s+/i, "")
    .replace(/\s+(county|parish|borough|census area|municipality|district)\s*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveCanonicalCountyForState(
  countyLike: string | null | undefined,
  stateCode: string | null | undefined
): CanonicalCountyMatch | null {
  const normalizedState = String(stateCode || "")
    .trim()
    .toUpperCase();
  const normalizedCounty = normalizeCountyToken(String(countyLike || ""));
  if (!/^[A-Z]{2}$/.test(normalizedState) || !normalizedCounty) return null;

  const stateRecord = US_STATES_COUNTIES.find((state) => state.code === normalizedState);
  if (!stateRecord) return null;

  const direct = stateRecord.counties.find((county) => {
    const token = normalizeCountyToken(county.name);
    return token === normalizedCounty;
  });
  if (direct) {
    return {
      countyFips: direct.fipsCode,
      countyName: direct.name,
      stateCode: normalizedState,
    };
  }

  const partial = stateRecord.counties.find((county) => {
    const token = normalizeCountyToken(county.name);
    return token.includes(normalizedCounty) || normalizedCounty.includes(token);
  });
  if (!partial) return null;

  return {
    countyFips: partial.fipsCode,
    countyName: partial.name,
    stateCode: normalizedState,
  };
}
