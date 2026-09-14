import { describe, expect, it, vi } from "vitest";
vi.mock("../storage", () => ({ storage: {} }));
import { ISSA_BUILD_LOCAL_DISCOVERY, ISSA_BUILD_PROFILE_CONTENT_BLOCKS } from "@shared/issaBuildProfile";
import { buildIssaBuildBusinessContentBlocks, buildIssaBuildOnyxContentBlocks, ISSA_BUILD_SERVICE_SUMMARIES } from "@shared/issaBuildPageContent";
import { listFactBearingProfileServices, resolveProfileServiceItem } from "@shared/profileServiceShare";
import { buildPublicProfileServiceHtml } from "../publicProfileServiceHtml";
import { buildProfileSitemapUrls } from "../profileSitemapDiscovery";
import { canonicalizeIssaBuildDocumentUrls } from "../issaBuildPublicRoutes";

const origin = "https://www.thetradescout.com";
const titleOnly = [{ type: "services", data: { items: ISSA_BUILD_LOCAL_DISCOVERY.services.map(({ slug, title }) => ({ slug, title })) } }];
const template = '<!doctype html><html><head><title>TradeScout</title><meta name="robots" content="noindex"><meta name="description" content="Default"><link rel="canonical" href="https://www.thetradescout.com/"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';
const getItems = (input: unknown) => buildIssaBuildBusinessContentBlocks(input).find(block => block.type === "services")!.data!.items;

describe("ISSA service discovery after business-copy cleanup", () => {
  it("reproduces the four missing routes from the observed title-only production shape", () => {
    expect(listFactBearingProfileServices(titleOnly)).toEqual([]);
    for (const service of ISSA_BUILD_LOCAL_DISCOVERY.services) expect(resolveProfileServiceItem(titleOnly, service.slug)).toBeNull();
    expect(buildProfileSitemapUrls({ profileSlug: "issa-build", profileUrl: origin + "/u/issa-build", contentBlocks: titleOnly })).toEqual([]);
  });

  it.each(ISSA_BUILD_LOCAL_DISCOVERY.services)("recovers $slug with substantive existing-business facts and stable URLs", service => {
    const blocks = buildIssaBuildBusinessContentBlocks(titleOnly);
    const resolved = resolveProfileServiceItem(blocks, service.slug);
    expect(resolved).not.toBeNull();
    expect(resolved!.description).toBe(ISSA_BUILD_SERVICE_SUMMARIES[service.slug]);
    expect(resolved!.description).not.toBe(service.description);
    expect(resolved!.description).not.toMatch(/\b(share|bring|include|start a|tell us)\b/i);
    expect(resolved!.description).not.toMatch(/licensed|insured|guarantee|best|rating|\$/i);
    const html = buildPublicProfileServiceHtml({ templateHtml: template, origin, profile: { slug: "issa-build", displayName: "ISSA Build", contentBlocks: blocks }, service: resolved! });
    const expected = origin + "/u/issa-build/services/" + service.slug;
    expect(html).toContain('<link rel="canonical" href="' + expected + '"');
    expect(html).toContain('<h1');
    expect(html).toContain(service.title);
    expect(html).toContain(resolved!.description);
    expect(html).toContain('"@type":"Service"');
    expect(html).toContain('content="index, follow');
    expect(html).not.toContain('content="noindex"');
    expect(html).not.toContain('/assets/app.js');
    expect(buildProfileSitemapUrls({ profileSlug: "issa-build", profileUrl: origin + "/u/issa-build", contentBlocks: blocks })).toContain(expected);
    expect(canonicalizeIssaBuildDocumentUrls(expected)).toBe(expected);
  });

  it("replaces only exact seeded instruction descriptions and keeps the same four services", () => {
    const items = getItems(ISSA_BUILD_PROFILE_CONTENT_BLOCKS);
    expect(items).toHaveLength(4);
    for (const service of ISSA_BUILD_LOCAL_DISCOVERY.services) expect(items.find((item: any) => item.slug === service.slug)?.description).toBe(ISSA_BUILD_SERVICE_SUMMARIES[service.slug]);
  });

  it("seeds descriptive services once when the existing services block is absent", () => {
    const blocks = buildIssaBuildBusinessContentBlocks([]);
    expect(listFactBearingProfileServices(blocks)).toHaveLength(4);
    expect(buildIssaBuildBusinessContentBlocks(blocks)).toEqual(blocks);
  });

  it.each([
    { description: "Owner-written service scope that must remain exactly as supplied." },
    { description: "Owner short text" },
    { body: "Owner-written body with the actual project scope and service details." },
    { text: "Owner-written alternate description for this published service." },
    { title: "Owner-specific service name" },
  ])("does not overwrite owner-edited identity or content: %j", edit => {
    const item = { slug: "cabinets", title: "Cabinets in Pensacola", ...edit };
    expect(getItems([{ type: "services", data: { items: [item] } }])).toEqual([item]);
  });

  it("does not create facts for unrelated services or repopulate an explicitly empty service list", () => {
    const item = { slug: "unconfirmed-service", title: "An owner-added service" };
    expect(getItems([{ type: "services", data: { items: [item] } }])).toEqual([item]);
    expect(getItems([{ type: "services", data: { items: [] } }])).toEqual([]);
  });

  it("retains explicit discovery opt-outs and rejects unknown service slugs", () => {
    const blocks = buildIssaBuildBusinessContentBlocks([...titleOnly, { type: "publicDiscovery", data: { sitemap: { services: false } } }]);
    expect(buildProfileSitemapUrls({ profileSlug: "issa-build", profileUrl: origin + "/u/issa-build", contentBlocks: blocks }).filter(url => url.includes('/services/'))).toEqual([]);
    expect(resolveProfileServiceItem(blocks, "not-a-published-service")).toBeNull();
  });

  it("is repeatable without mutating inputs, product media or the onyx presentation", () => {
    const before = JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS);
    const productBefore = buildIssaBuildOnyxContentBlocks();
    const once = buildIssaBuildBusinessContentBlocks(ISSA_BUILD_PROFILE_CONTENT_BLOCKS);
    expect(buildIssaBuildBusinessContentBlocks(once)).toEqual(once);
    expect(JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS)).toBe(before);
    expect(buildIssaBuildOnyxContentBlocks()).toEqual(productBefore);
    for (const type of ["inventoryCatalog", "publicDiscovery"]) expect(once.find(block => block.type === type)).toEqual(ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find(block => block.type === type));
  });
});
