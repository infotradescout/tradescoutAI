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
  | { status: "error"; items: []; reason: "source_unavailable" | "category_unavailable" | "invalid_topic" | "scan_limit_reached" }
  | { status: "area_unavailable"; items: []; reason: "invalid_county" };

const TOOL_CATEGORY_NAME = "Tools & Hardware";
const TOOL_PAGE_SIZE = 16;
const MAX_SCANNED_TOOLS = 256;
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

function publicToolDescription(value: unknown): string {
  return sanitizePublicDiscoveryText(value, 500)
    .replace(
      /\b(?:email|call|text|contact)\s+Continue through TradeScout(?:\s+or\s+(?:email|call|text|contact)\s+Continue through TradeScout)*\.?/gi,
      ""
    )
    .replace(/\s+([.!?])/g, "$1")
    .trim();
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

    const items: ScoutPublicToolListing[] = [];
    let offset = 0;
    while (offset < MAX_SCANNED_TOOLS) {
      const pageLimit = Math.min(TOOL_PAGE_SIZE, MAX_SCANNED_TOOLS - offset);
      const rows = await source.getMarketplaceListings({
        categoryId: toolsCategory.id,
        countyAliases: aliases,
        state: area.state,
        status: "active",
        requireApproved: true,
        publicExposureOnly: true,
        ...(terms.length ? { publicToolTopic: terms.join(" ") } : {}),
        sortBy: "date_desc",
        limit: pageLimit,
        offset,
      });
      if (rows.length > pageLimit) {
        return { status: "error", items: [], reason: "source_unavailable" };
      }

      for (const row of rows) {
        if (
          row.categoryId !== toolsCategory.id ||
          !row.approvedAt ||
          !aliases.includes(String(row.county || "").trim().toLowerCase()) ||
          String(row.state || "").trim().toUpperCase() !== area.state
        ) {
          continue;
        }
        const publicListing = toPublicExchangeListing(row);
        if (!publicListing) continue;
        const id = String(publicListing.id || "");
        const title = sanitizePublicDiscoveryText(publicListing.title, 200);
        const description = publicToolDescription(publicListing.description);
        if (!id || !title) continue;
        const topicMatchSource = terms.length
          ? fieldMatchesTopic(title, terms)
            ? "title"
            : fieldMatchesTopic(description, terms)
              ? "description"
              : null
          : null;
        if (terms.length && !topicMatchSource) continue;
        items.push({
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
        });
        if (items.length >= limit) return { status: "checked", items };
      }

      offset += rows.length;
      if (rows.length < pageLimit) return { status: "checked", items };
    }
    // A full last page does not prove that more matches do not exist. Keep the
    // result retryable instead of claiming a checked empty or complete result.
    return { status: "error", items: [], reason: "scan_limit_reached" };
  } catch {
    return { status: "error", items: [], reason: "source_unavailable" };
  }
}
