// countyFipsToName.ts
// Utility to map county FIPS codes to user-friendly county/city/state names

// Example: You should replace this with a real, complete mapping or dynamic fetch from your backend or a static JSON file.
const COUNTY_FIPS_MAP: Record<string, string> = {
  "12033": "Escambia County, FL",
  "70401": "Tangipahoa Parish, LA",
  // ... add more as needed ...
};

export function countyFipsToName(fips: string | null | undefined): string {
  if (!fips) return "";
  return COUNTY_FIPS_MAP[fips] || fips;
}
