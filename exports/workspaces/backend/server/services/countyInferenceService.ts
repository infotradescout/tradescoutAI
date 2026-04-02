export interface CountyInferenceInput {
  city: string;
  stateCode: string;
  zipCode?: string;
}

export interface CountyInferenceCandidate {
  countyFips: string;
  countyName?: string;
  stateCode: string;
  cityMatch: boolean;
  matchedAddress?: string;
}

export interface CountyInferenceResult {
  query: {
    city: string;
    stateCode: string;
    zipCode?: string;
  };
  inferred: CountyInferenceCandidate | null;
  candidates: CountyInferenceCandidate[];
  ambiguous: boolean;
  confidence: "high" | "medium" | "low";
  source: "us_census_geocoder";
  cached: boolean;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const CACHE_TTL_MS = 15 * 60 * 1000;
const inferenceCache = new Map<string, { expiresAt: number; value: CountyInferenceResult }>();

function normalizeToken(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function cacheKey(input: CountyInferenceInput): string {
  return [
    normalizeToken(input.city),
    normalizeToken(input.stateCode).toUpperCase(),
    normalizeToken(input.zipCode || ""),
  ].join("|");
}

function dedupeCandidates(candidates: CountyInferenceCandidate[]): CountyInferenceCandidate[] {
  const byFips = new Map<string, CountyInferenceCandidate>();
  for (const candidate of candidates) {
    const existing = byFips.get(candidate.countyFips);
    if (!existing) {
      byFips.set(candidate.countyFips, candidate);
      continue;
    }
    // Prefer candidate rows with cityMatch and county name.
    const keep =
      candidate.cityMatch && !existing.cityMatch
        ? candidate
        : candidate.countyName && !existing.countyName
          ? candidate
          : existing;
    byFips.set(candidate.countyFips, keep);
  }
  return Array.from(byFips.values());
}

function determineInference(
  candidates: CountyInferenceCandidate[]
): Pick<CountyInferenceResult, "inferred" | "ambiguous" | "confidence"> {
  if (candidates.length === 0) {
    return { inferred: null, ambiguous: false, confidence: "low" };
  }

  if (candidates.length === 1) {
    return {
      inferred: candidates[0],
      ambiguous: false,
      confidence: candidates[0].cityMatch ? "high" : "medium",
    };
  }

  const cityMatches = candidates.filter((candidate) => candidate.cityMatch);
  if (cityMatches.length === 1) {
    return {
      inferred: cityMatches[0],
      ambiguous: false,
      confidence: "medium",
    };
  }

  return { inferred: null, ambiguous: true, confidence: "low" };
}

function toResult(
  query: CountyInferenceResult["query"],
  candidates: CountyInferenceCandidate[],
  cached: boolean
): CountyInferenceResult {
  const sorted = [...candidates].sort((left, right) => {
    if (left.cityMatch !== right.cityMatch) {
      return left.cityMatch ? -1 : 1;
    }
    return left.countyFips.localeCompare(right.countyFips);
  });
  const inference = determineInference(sorted);

  return {
    query,
    inferred: inference.inferred,
    candidates: sorted,
    ambiguous: inference.ambiguous,
    confidence: inference.confidence,
    source: "us_census_geocoder",
    cached,
  };
}

/**
 * Infer county from city + state using the U.S. Census geocoder.
 * Returns deterministic candidate ranking and an inferred county when unambiguous.
 */
export async function inferCountyFromCityState(
  input: CountyInferenceInput,
  fetchImpl: FetchLike = fetch
): Promise<CountyInferenceResult> {
  const city = String(input.city || "").trim();
  const stateCode = String(input.stateCode || "")
    .trim()
    .toUpperCase();
  const zipCode = String(input.zipCode || "").trim();

  if (!city || city.length < 2) throw new Error("city is required");
  if (!/^[A-Z]{2}$/.test(stateCode)) throw new Error("valid stateCode is required");

  const query = { city, stateCode, zipCode: zipCode || undefined };
  const key = cacheKey({ city, stateCode, zipCode });
  const now = Date.now();
  const cached = inferenceCache.get(key);
  if (cached && cached.expiresAt > now) {
    return { ...cached.value, cached: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress");
    const queryAddress = [city, stateCode, zipCode].filter(Boolean).join(", ");
    url.searchParams.set("address", queryAddress);
    url.searchParams.set("benchmark", "2020");
    url.searchParams.set("vintage", "2020");
    url.searchParams.set("format", "json");

    const response = await fetchImpl(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      const result = toResult(query, [], false);
      inferenceCache.set(key, {
        expiresAt: now + Math.min(CACHE_TTL_MS, 2 * 60 * 1000),
        value: result,
      });
      return result;
    }

    const payload: any = await response.json();
    const matches: any[] = Array.isArray(payload?.result?.addressMatches)
      ? payload.result.addressMatches
      : [];
    const normalizedCity = normalizeToken(city);
    const candidates: CountyInferenceCandidate[] = [];

    for (const match of matches.slice(0, 25)) {
      const county = match?.geographies?.Counties?.[0];
      const countyFips = String(county?.GEOID || "").trim();
      if (!/^\d{5}$/.test(countyFips)) continue;

      const countyName =
        typeof county?.NAME === "string" && county.NAME.trim() ? county.NAME.trim() : undefined;
      const matchedCity = normalizeToken(String(match?.addressComponents?.city || ""));
      const cityMatch = Boolean(normalizedCity) && matchedCity === normalizedCity;

      candidates.push({
        countyFips,
        countyName,
        stateCode,
        cityMatch,
        matchedAddress:
          typeof match?.matchedAddress === "string" ? String(match.matchedAddress).trim() : "",
      });
    }

    const deduped = dedupeCandidates(candidates);
    const result = toResult(query, deduped, false);
    inferenceCache.set(key, { expiresAt: now + CACHE_TTL_MS, value: result });
    return result;
  } catch {
    const result = toResult(query, [], false);
    inferenceCache.set(key, {
      expiresAt: now + Math.min(CACHE_TTL_MS, 2 * 60 * 1000),
      value: result,
    });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export function clearCountyInferenceCache() {
  inferenceCache.clear();
}
