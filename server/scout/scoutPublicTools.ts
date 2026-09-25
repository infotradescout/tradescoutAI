import { US_STATES_COUNTIES } from "../../shared/states-counties";
import { sanitizePublicDiscoveryText } from "../../shared/publicListingSafety";
import { toPublicExchangeListing } from "../publicExchangeListing";
import { storage } from "../storage";
import type { IStorage } from "../storage/contracts";

type ToolSource = Pick<IStorage, "getMarketplaceCategories" | "getMarketplaceListings">;

export type ScoutPublicToolListing = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  condition: string;
  countyFips: string;
  county: string;
  state: string;
  createdAt: string | null;
  detailPath: string;
  topicMatchSource?: "title" | "description";
};

export type ScoutPublicToolsLookup =
  | { status: "checked"; items: ScoutPublicToolListing[] }
  | { status: "error"; items: []; reason: "source_unavailable" | "category_unavailable" | "invalid_topic" }
  | { status: "area_unavailable"; items: []; reason: "invalid_county" };

const TOOL_CATEGORY_NAME = "Tools & Hardware";
const COUNTY_BY_FIPS = new Map(
  US_STATES_COUNTIES.flatMap((state) =>
    state.counties.map((county) => [county.fipsCode, { name: county.name, state: state.code }] as const)
  )
);

function countyAliases(fips: string, name: string): string[] {
  const shortName = name.replace(/\s+(?:County|Parish|Borough|Census Area|Municipality)$/i, "");
  return Array.from(new Set([fips, name, shortName].map((alias) => alias.trim().toLowerCase())));
}

function topicTerms(topic: string): string[] {
  return (topic.toLowerCase().slice(0, 120).match(/[a-z0-9]+/g) ?? [])
    .filter((term) => term.length >= 2)
    .slice(0, 8);
}

function fieldMatchesTopic(value: string, terms: string[]): boolean {
  const normalized = value.toLowerCase();
  return terms.every((term) => new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`).test(normalized));
}

/**
 * Read only native public Marketplace tools. The repository applies all area,
 * topic, approval, expiry, and seller exposure predicates before LIMIT.
 */
export async function lookupScoutPublicTools(
  input: { countyFips: string; topic?: string; limit?: number },
  source: ToolSource = storage
): Promise<ScoutPublicToolsLookup> {
  const countyFips = String(input.countyFips || "").trim();
  const area = /^\d{5}$/.test(countyFips) ? COUNTY_BY_FIPS.get(countyFips) : undefined;
  if (!area) return { status: "area_unavailable", items: [], reason: "invalid_county" };

  const rawTopic = String(input.topic || "").trim();
  const terms = topicTerms(rawTopic);
  if (rawTopic && !terms.length) {
    return { status: "error", items: [], reason: "invalid_topic" };
  }

  const aliases = countyAliases(countyFips, area.name);
  const requestedLimit = Number(input.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(8, Math.max(1, Math.floor(requestedLimit)))
    : 6;

  try {
    const categories = await source.getMarketplaceCategories();
    const toolsCategory = categories.find(
      (category) =>
        category.isActive !== false &&
        String(category.name || "").trim().toLowerCase() === TOOL_CATEGORY_NAME.toLowerCase()
    );
    if (!toolsCategory) {
      return { status: "error", items: [], reason: "category_unavailable" };
    }

    const rows = await source.getMarketplaceListings({
      categoryId: toolsCategory.id,
      countyAliases: aliases,
      state: area.state,
      status: "active",
      requireApproved: true,
      publicExposureOnly: true,
      ...(terms.length ? { publicToolTopic: terms.join(" ") } : {}),
      sortBy: "date_desc",
      limit,
      offset: 0,
    });

    const items = rows.flatMap((row): ScoutPublicToolListing[] => {
      if (
        row.categoryId !== toolsCategory.id ||
        !row.approvedAt ||
        !aliases.includes(String(row.county || "").trim().toLowerCase()) ||
        String(row.state || "").trim().toUpperCase() !== area.state
      ) {
        return [];
      }
      const publicListing = toPublicExchangeListing(row);
      if (!publicListing) return [];
      const id = String(publicListing.id || "");
      const title = sanitizePublicDiscoveryText(publicListing.title, 200);
      const description = sanitizePublicDiscoveryText(publicListing.description, 500);
      if (!id || !title) return [];
      const topicMatchSource = terms.length
        ? fieldMatchesTopic(title, terms)
          ? "title"
          : fieldMatchesTopic(description, terms)
            ? "description"
            : null
        : null;
      if (terms.length && !topicMatchSource) return [];
      return [
        {
          id,
          title,
          description,
          price: Number(publicListing.price) || 0,
          currency: String(publicListing.currency || "USD"),
          condition: String(publicListing.condition || ""),
          countyFips,
          county: area.name,
          state: area.state,
          createdAt:
            typeof publicListing.createdAt === "string" ? publicListing.createdAt : null,
          detailPath: `/exchange/tools/${encodeURIComponent(id)}`,
          ...(topicMatchSource ? { topicMatchSource } : {}),
        },
      ];
    });

    return { status: "checked", items };
  } catch {
    return { status: "error", items: [], reason: "source_unavailable" };
  }
}
