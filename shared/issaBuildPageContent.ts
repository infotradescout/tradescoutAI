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
  "ISSA Build | Luxury Translucent Onyx",
  "Honey Onyx and Multi Green Onyx for interiors designed to glow.",
  "Custom Honey Onyx and Multi Green Onyx installations for residential and commercial interiors.",
  "We craft translucent onyx for residential and commercial interiors — selection, customization, backlighting, installation, and private project consultation.",
  "Honey Onyx and Multi Green Onyx for residential and commercial interiors. Private project consultation with us on TradeScout.",
]);

export function issaBuildBusinessText(value: unknown, fallback = ""): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text && !LEGACY_PRODUCT_COPY.has(text) ? text : fallback;
}

/** Product text and photographs stay on the existing product presentation. */
export function buildIssaBuildOnyxContentBlocks(): IssaBuildContentBlock[] {
  return clone(productSource.filter((block) => !["services", "serviceAreas"].includes(block.type)));
}

/** Repair known product-as-profile defaults without replacing owner-authored content. */
export function buildIssaBuildBusinessContentBlocks(input: unknown): IssaBuildContentBlock[] {
  const source = Array.isArray(input)
    ? input.filter((block): block is IssaBuildContentBlock => Boolean(block && typeof block === "object" && typeof block.type === "string"))
    : [];
  const blocks = clone(source).filter((block) => {
    if (block.type === "premiumProduct" || block.type === "siteTemplate") return false;
    if (block.type === "cta") return JSON.stringify(block.data) !== JSON.stringify(productBlock("cta")?.data);
    if (block.type === "hero" || block.type === "about") {
      const data = block.data || {};
      for (const key of ["headerLabel", "title", "teaser", "text", "body", "description"]) {
        if (typeof data[key] === "string" && LEGACY_PRODUCT_COPY.has(data[key].trim())) delete data[key];
      }
      if (block.type === "hero") {
        if (data.eyebrow === "CUSTOM BACKLIT ONYX") delete data.eyebrow;
        if (!data.title && !data.headerLabel) data.title = ISSA_BUILD_BUSINESS_NAME;
        if (!data.text && !data.teaser) data.text = ISSA_BUILD_LOCAL_DISCOVERY.headline;
        // Keep the stored photographs, logo, links and other hero settings.
        block.data = data;
      } else {
        block.data = data;
        if (![data.text, data.body, data.description].some((value) => typeof value === "string" && value.trim())) return false;
      }
    }
    if (block.type === "services" && Array.isArray(block.data?.items)) {
      block.data.items = block.data.items.map((item: unknown) => {
        if (!item || typeof item !== "object") return item;
        const value = item as Record<string, unknown>;
        const legacy = ISSA_BUILD_LOCAL_DISCOVERY.services.find((service) => service.slug === value.slug);
        if (!legacy || value.description !== legacy.description) return value;
        const { description: _legacyInstruction, ...retained } = value;
        return retained;
      });
    }
    if (block.type === "serviceAreas" && block.data?.description === productBlock("serviceAreas")?.data?.description) {
      delete block.data?.description;
    }
    return true;
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
