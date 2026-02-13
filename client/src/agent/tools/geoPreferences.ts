/**
 * Update the current user's hyper-local geo preferences based on
 * a device-provided location. Scout and other agents should call
 * this helper instead of patching user.preferences directly.
 */
export async function updateGeoPreferencesFromDeviceLocation(args: {
  lat: number;
  lng: number;
  label?: string;
  /** Optional radius in meters for nearby content (default handled server-side) */
  notifyNearbyRadiusMeters?: number;
  /** Enable or disable hyper-local alerts */
  enableNearbyDeals?: boolean;
  /** Optional explicit includeTypes override */
  includeTypes?: Array<"marketplace" | "trade">;
}): Promise<{
  geo: {
    homeLocation: { lat: number; lng: number; label?: string };
    notifyNearbyRadiusMeters?: number;
    enableNearbyDeals?: boolean;
    includeTypes?: Array<"marketplace" | "trade">;
  } | null;
}> {
  const body: any = {
    homeLocation: {
      lat: args.lat,
      lng: args.lng,
      ...(args.label ? { label: args.label } : {}),
    },
  };

  if (typeof args.notifyNearbyRadiusMeters === "number") {
    body.notifyNearbyRadiusMeters = args.notifyNearbyRadiusMeters;
  }

  if (typeof args.enableNearbyDeals === "boolean") {
    body.enableNearbyDeals = args.enableNearbyDeals;
  }

  if (Array.isArray(args.includeTypes)) {
    body.includeTypes = args.includeTypes;
  }

  const res = await fetch("/api/agent/preferences/geo", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `Failed to update geo preferences (${res.status})`;
    try {
      const json = await res.json();
      if (json?.message) message = json.message;
    } catch {
      // ignore JSON parse errors, fall back to default message
    }
    throw new Error(message);
  }

  const json = await res.json();
  return {
    geo: json?.geo ?? null,
  };
}
