export interface CountyInferenceCandidate {
  countyFips: string;
  countyName: string;
  stateCode: string;
  cityMatch?: boolean;
}

export interface CountyInferenceResponse {
  inferred: CountyInferenceCandidate | null;
  candidates: CountyInferenceCandidate[];
  ambiguous: boolean;
  confidence: "high" | "medium" | "low";
  source?: string;
  cached?: boolean;
}

export async function inferCountyForCityState(params: {
  city: string;
  stateCode: string;
  zipCode?: string;
  signal?: AbortSignal;
}): Promise<CountyInferenceResponse | null> {
  const city = String(params.city || "").trim();
  const stateCode = String(params.stateCode || "")
    .trim()
    .toUpperCase();
  const zipCode = String(params.zipCode || "").trim();

  if (!city || city.length < 2) return null;
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;

  const url = new URL("/api/counties/infer", window.location.origin);
  url.searchParams.set("city", city);
  url.searchParams.set("state", stateCode);
  if (zipCode) url.searchParams.set("zip", zipCode);

  const response = await fetch(url.toString(), {
    credentials: "include",
    signal: params.signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as CountyInferenceResponse;
  if (!payload || !Array.isArray(payload.candidates)) return null;
  return payload;
}
