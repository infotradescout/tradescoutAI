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
  if (!county) return normalized;
  return `${county.countyName}, ${county.stateCode}`;
}
