import { US_STATES_COUNTIES } from "@shared/states-counties";

type CountyLookupValue = {
  countyName: string;
  stateCode: string;
};

function normalizeFips(fips: string): string {
  const trimmed = fips.trim();
  if (!trimmed) return "";
  return /^\d+$/.test(trimmed) ? trimmed.padStart(5, "0") : trimmed;
}

function normalizeStateCode(stateCode: string | null | undefined): string {
  if (!stateCode) return "";
  const value = String(stateCode).trim().toUpperCase();
  return value.length === 2 ? value : "";
}

const COUNTY_FIPS_LOOKUP: Map<string, CountyLookupValue> = (() => {
  const map = new Map<string, CountyLookupValue>();
  for (const state of US_STATES_COUNTIES) {
    for (const county of state.counties) {
      map.set(county.fipsCode, {
        countyName: county.name,
        stateCode: state.code,
      });
    }
  }
  return map;
})();

export function countyFipsToName(fips: string | null | undefined): string {
  if (!fips) return "";
  const normalized = normalizeFips(String(fips));
  if (!normalized) return "";
  const county = COUNTY_FIPS_LOOKUP.get(normalized);
  if (!county) return "";
  return `${county.countyName}, ${county.stateCode}`;
}

export function getCountyStateCode(fips: string | null | undefined): string {
  if (!fips) return "";
  const normalized = normalizeFips(String(fips));
  if (!normalized) return "";
  return COUNTY_FIPS_LOOKUP.get(normalized)?.stateCode || "";
}

export function formatCountyLabel(
  countyFips: string | null | undefined,
  stateCode?: string | null
): string {
  const resolved = countyFipsToName(countyFips);
  if (resolved) return resolved;

  const normalizedState = normalizeStateCode(stateCode);
  if (normalizedState) return `Local county, ${normalizedState}`;

  return "Local area";
}
