type ExternalImportProvider = "google_maps_places" | "facebook_graph_pages";

type ExternalImportRow = {
  email: string;
  business_name: string;
  county_fips: string;
  state_code: string;
  phone: string;
  website: string;
  category: string;
  services: string;
  address_line1: string;
  city: string;
  postal_code: string;
  latitude: string;
  longitude: string;
  external_source: string;
  external_id: string;
};

export type ExternalBusinessSearchInput = {
  provider: ExternalImportProvider;
  query: string;
  limit?: number;
  location?: string;
  defaultCountyFips?: string;
  defaultStateCode?: string;
  facebookAccessToken?: string;
};

export type ExternalBusinessSearchResult = {
  provider: ExternalImportProvider;
  headers: Array<keyof ExternalImportRow>;
  rows: ExternalImportRow[];
  warnings: string[];
  generatedCsv: string;
};

const DEFAULT_HEADERS: Array<keyof ExternalImportRow> = [
  "email",
  "business_name",
  "county_fips",
  "state_code",
  "phone",
  "website",
  "category",
  "services",
  "address_line1",
  "city",
  "postal_code",
  "latitude",
  "longitude",
  "external_source",
  "external_id",
];

function clampLimit(limit: unknown): number {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function toCsvCell(value: unknown): string {
  const raw = String(value ?? "");
  if (!raw.includes(",") && !raw.includes("\n") && !raw.includes('"')) {
    return raw;
  }
  return `"${raw.replace(/"/g, '""')}"`;
}

function toCsv(headers: Array<keyof ExternalImportRow>, rows: ExternalImportRow[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => toCsvCell(row[header])).join(","));
  }
  return lines.join("\n");
}

function parseLatLng(input: string): { lat: number; lng: number } | null {
  const parts = clean(input)
    .split(",")
    .map((part) => Number(part.trim()));

  if (parts.length !== 2) return null;
  const [lat, lng] = parts;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

async function fetchGooglePlacesRows(
  input: ExternalBusinessSearchInput
): Promise<{ rows: ExternalImportRow[]; warnings: string[] }> {
  const apiKey = clean(process.env.TRADESCOUT_GOOGLE_MAPS_API_KEY);
  if (!apiKey) {
    throw new Error(
      "TRADESCOUT_GOOGLE_MAPS_API_KEY is required for google_maps_places external import"
    );
  }

  const limit = clampLimit(input.limit);
  const query = clean(input.query);
  if (!query) {
    throw new Error("query is required for google_maps_places external import");
  }

  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: limit,
    languageCode: "en",
  };

  const locationBias = parseLatLng(clean(input.location));
  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.lat, longitude: locationBias.lng },
        radius: 25000,
      },
    };
  }

  const stateCode = clean(input.defaultStateCode).toUpperCase();
  if (stateCode && /^[A-Z]{2}$/.test(stateCode)) {
    body.regionCode = stateCode;
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.types,places.addressComponents",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Places request failed (${res.status}): ${errText || "unknown error"}`);
  }

  const payload = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      nationalPhoneNumber?: string;
      websiteUri?: string;
      primaryTypeDisplayName?: { text?: string };
      types?: string[];
      addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
    }>;
  };

  const rows: ExternalImportRow[] = [];

  for (const place of payload.places || []) {
    const addressComponents = Array.isArray(place.addressComponents) ? place.addressComponents : [];
    const city =
      addressComponents.find((component) => (component.types || []).includes("locality"))
        ?.longText || "";
    const postalCode =
      addressComponents.find((component) => (component.types || []).includes("postal_code"))
        ?.longText || "";

    rows.push({
      email: "",
      business_name: clean(place.displayName?.text),
      county_fips: clean(input.defaultCountyFips),
      state_code: clean(input.defaultStateCode).toUpperCase(),
      phone: clean(place.nationalPhoneNumber),
      website: clean(place.websiteUri),
      category: clean(place.primaryTypeDisplayName?.text || (place.types || [])[0]),
      services: clean((place.types || []).join("|")),
      address_line1: clean(place.formattedAddress),
      city: clean(city),
      postal_code: clean(postalCode),
      latitude: typeof place.location?.latitude === "number" ? String(place.location.latitude) : "",
      longitude:
        typeof place.location?.longitude === "number" ? String(place.location.longitude) : "",
      external_source: "google_maps_places",
      external_id: clean(place.id),
    });
  }

  const warnings: string[] = [];
  if (!rows.length) {
    warnings.push("Google Places returned zero candidates for this query.");
  }

  return { rows, warnings };
}

async function fetchFacebookPagesRows(
  input: ExternalBusinessSearchInput
): Promise<{ rows: ExternalImportRow[]; warnings: string[] }> {
  const query = clean(input.query);
  if (!query) {
    throw new Error("query is required for facebook_graph_pages external import");
  }

  const token =
    clean(input.facebookAccessToken) || clean(process.env.TRADESCOUT_FACEBOOK_GRAPH_TOKEN);
  if (!token) {
    throw new Error(
      "facebookAccessToken is required (or set TRADESCOUT_FACEBOOK_GRAPH_TOKEN) for facebook_graph_pages external import"
    );
  }

  const limit = clampLimit(input.limit);
  const params = new URLSearchParams({
    type: "page",
    q: query,
    limit: String(limit),
    fields:
      "id,name,category,about,phone,website,emails,single_line_address,location{city,state,street,zip,latitude,longitude}",
    access_token: token,
  });

  const res = await fetch(`https://graph.facebook.com/v19.0/search?${params.toString()}`);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Facebook Graph request failed (${res.status}): ${errText || "unknown error"}`);
  }

  const payload = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      category?: string;
      about?: string;
      phone?: string;
      website?: string;
      emails?: string[];
      single_line_address?: string;
      location?: {
        city?: string;
        state?: string;
        street?: string;
        zip?: string;
        latitude?: number;
        longitude?: number;
      };
    }>;
  };

  const rows: ExternalImportRow[] = [];

  for (const page of payload.data || []) {
    const city = clean(page.location?.city);
    const stateCodeFromPage = clean(page.location?.state).toUpperCase();

    rows.push({
      email: clean((page.emails || [])[0]),
      business_name: clean(page.name),
      county_fips: clean(input.defaultCountyFips),
      state_code: stateCodeFromPage || clean(input.defaultStateCode).toUpperCase(),
      phone: clean(page.phone),
      website: clean(page.website),
      category: clean(page.category),
      services: clean(page.about),
      address_line1:
        clean(page.single_line_address) ||
        clean(page.location?.street) ||
        [clean(page.location?.city), clean(page.location?.state), clean(page.location?.zip)]
          .filter(Boolean)
          .join(", "),
      city,
      postal_code: clean(page.location?.zip),
      latitude: typeof page.location?.latitude === "number" ? String(page.location.latitude) : "",
      longitude:
        typeof page.location?.longitude === "number" ? String(page.location.longitude) : "",
      external_source: "facebook_graph_pages",
      external_id: clean(page.id),
    });
  }

  const warnings: string[] = [];
  if (!rows.length) {
    warnings.push("Facebook Graph returned zero page candidates for this query.");
  }

  return { rows, warnings };
}

export async function searchTradeScoutExternalBusinesses(
  input: ExternalBusinessSearchInput
): Promise<ExternalBusinessSearchResult> {
  const provider = clean(input.provider) as ExternalImportProvider;
  if (provider !== "google_maps_places" && provider !== "facebook_graph_pages") {
    throw new Error("provider must be google_maps_places or facebook_graph_pages");
  }

  const { rows, warnings } =
    provider === "google_maps_places"
      ? await fetchGooglePlacesRows(input)
      : await fetchFacebookPagesRows(input);

  const generatedCsv = toCsv(DEFAULT_HEADERS, rows);

  return {
    provider,
    headers: DEFAULT_HEADERS,
    rows,
    warnings,
    generatedCsv,
  };
}
