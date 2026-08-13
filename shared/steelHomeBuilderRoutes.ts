export const STEEL_HOME_BUILDER_ROUTE_COLLECTION = "builders" as const;

export const STEEL_HOME_BUILDER_ROUTE_SLUGS = {
  countertops: "countertops",
  cabinets: "cabinets",
  building: "metal-buildings",
} as const;

export type SteelHomeBuilderKey = keyof typeof STEEL_HOME_BUILDER_ROUTE_SLUGS;

const BUILDER_BY_SLUG = Object.fromEntries(
  Object.entries(STEEL_HOME_BUILDER_ROUTE_SLUGS).map(([key, slug]) => [slug, key])
) as Record<string, SteelHomeBuilderKey>;

export function buildSteelHomeBuilderPath(
  builder: SteelHomeBuilderKey,
  profileRoute = "/u/steel-home-packages"
): string {
  return `${profileRoute.replace(/\/+$/, "")}/${STEEL_HOME_BUILDER_ROUTE_COLLECTION}/${STEEL_HOME_BUILDER_ROUTE_SLUGS[builder]}`;
}

export function resolveSteelHomeBuilderRoute(
  collection: unknown,
  itemSlug: unknown
): SteelHomeBuilderKey | null {
  if (
    String(collection || "")
      .trim()
      .toLowerCase() !== STEEL_HOME_BUILDER_ROUTE_COLLECTION
  ) {
    return null;
  }
  return (
    BUILDER_BY_SLUG[
      String(itemSlug || "")
        .trim()
        .toLowerCase()
    ] || null
  );
}

export function resolveSteelHomeBuilderPathname(pathname: unknown): SteelHomeBuilderKey | null {
  const path = String(pathname || "")
    .split(/[?#]/, 1)[0]
    .replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 2 && segments[0] === STEEL_HOME_BUILDER_ROUTE_COLLECTION) {
    return resolveSteelHomeBuilderRoute(segments[0], segments[1]);
  }
  if (
    segments.length === 4 &&
    (segments[0] === "u" || segments[0] === "p") &&
    segments[1].toLowerCase() === "steel-home-packages"
  ) {
    return resolveSteelHomeBuilderRoute(segments[2], segments[3]);
  }
  return null;
}
