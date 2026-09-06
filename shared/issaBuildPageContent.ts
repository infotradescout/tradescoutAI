import {
  ISSA_BUILD_BUSINESS_NAME,
  ISSA_BUILD_LOCAL_DISCOVERY,
  ISSA_BUILD_LOGO,
  ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
} from "./issaBuildProfile";

export type IssaBuildContentBlock = {
  type: string;
  data?: Record<string, any>;
  [key: string]: unknown;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const productSource = ISSA_BUILD_PROFILE_CONTENT_BLOCKS as unknown as IssaBuildContentBlock[];
const productBlock = (type: string) => productSource.find((block) => block.type === type);

/** Exact legacy values, not a keyword filter: owner-written copy must survive. */
const LEGACY_PRODUCT_COPY = new Set([
  "Crafted for light.",
  "Onyx, brought to light.",
  "Honey Onyx and Multi Green Onyx for interiors designed to glow.",
  "Custom Honey Onyx and Multi Green Onyx installations for residential and commercial interiors.",
  "We craft translucent onyx for residential and commercial interiors — selection, customization, backlighting, installation, and private project consultation.",
  "Honey Onyx and Multi Green Onyx for residential and commercial interiors. Private project consultation with us on TradeScout.",
]);

export function issaBuildBusinessText(value: unknown, fallback = ""): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text && !LEGACY_PRODUCT_COPY.has(text) ? text : fallback;
}

/**
 * The existing luxury material presentation is a product page. Keep its copy,
 * photos and stone facts intact; broad company services belong to the profile.
 */
export function buildIssaBuildOnyxContentBlocks(): IssaBuildContentBlock[] {
  return clone(productSource.filter((block) => !["services", "serviceAreas"].includes(block.type)));
}

/**
 * Selectively repair the old product-as-profile record. This is idempotent and
 * never discards unrelated owner blocks, gallery records, or catalog identities.
 * The catalog stays available for existing item links and gated requests; it is
 * not the business page's visual presentation.
 */
export function buildIssaBuildBusinessContentBlocks(input: unknown): IssaBuildContentBlock[] {
  const source = Array.isArray(input)
    ? input.filter((block): block is IssaBuildContentBlock => Boolean(block && typeof block === "object" && typeof block.type === "string"))
    : [];
  const blocks = clone(source).filter((block) => {
    if (block.type === "premiumProduct") return false;
    if (block.type === "hero") {
      const data = block.data || {};
      return ![data.headerLabel, data.title, data.teaser, data.text].some((value) =>
        typeof value === "string" && LEGACY_PRODUCT_COPY.has(value.trim())
      );
    }
    if (block.type === "about") {
      const data = block.data || {};
      return ![data.text, data.body, data.description].some((value) =>
        typeof value === "string" && LEGACY_PRODUCT_COPY.has(value.trim())
      );
    }
    if (block.type === "cta") {
      return JSON.stringify(block.data) !== JSON.stringify(productBlock("cta")?.data);
    }
    return block.type !== "siteTemplate";
  });
  const types = new Set(blocks.map((block) => block.type));
  if (!types.has("hero")) {
    blocks.unshift({ type: "hero", data: {
      title: ISSA_BUILD_BUSINESS_NAME,
      text: ISSA_BUILD_LOCAL_DISCOVERY.headline,
      logoUrl: ISSA_BUILD_LOGO,
    } });
  }
  if (!types.has("services")) {
    blocks.push({ type: "services", data: {
      items: ISSA_BUILD_LOCAL_DISCOVERY.services.map(({ slug, title }) => ({ slug, title })),
    } });
  }
  for (const type of ["inventoryCatalog", "publicDiscovery"]) {
    if (!types.has(type)) {
      const block = productBlock(type);
      if (block) blocks.push(clone(block));
    }
  }
  const trust = blocks.find((block) => block.type === "trust");
  if (trust) {
    trust.data = { ...trust.data, items: Array.from(new Set([
      "100% Verified by TradeScout",
      ...(Array.isArray(trust.data?.items) ? trust.data.items : []),
    ])) };
  } else {
    blocks.push({ type: "trust", data: { items: ["100% Verified by TradeScout"] } });
  }
  return [{ type: "siteTemplate", data: { id: "default" } }, ...blocks];
}

export const ISSA_BUILD_ONYX_PAGE_TITLE = "Onyx | ISSA Build";
export const ISSA_BUILD_ONYX_PAGE_DESCRIPTION = String(productBlock("about")?.data?.text || "");
