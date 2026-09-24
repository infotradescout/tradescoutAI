import { describe, expect, it } from "vitest";
import { renderExchangeStoneLanding } from "../publicExchangeStoneHtml";
import { audienceQualifiedStonePath } from "../services/exchangeStoneDiscovery";

const id = "tradescout-stone-aj-quartz";
const item = {
  id,
  title: "AJ Quartz | TradeScout",
  description: "Stone material",
  price: 30,
  images: [`/api/exchange/stone-media/${id}`],
  specifications: { priceUnit: "sqft", referenceSizesInches: "120x80" },
};

function schema(html: string): Record<string, any> {
  const match = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  if (!match) throw new Error("Missing collection schema");
  return JSON.parse(match[1]);
}

describe("public retail stone links", () => {
  it("keeps only the unselected area chooser indexable", () => {
    const result = renderExchangeStoneLanding({
      audience: { allowed: false, reason: "location_required" },
      items: [item], publicationReady: true, states: ["TX", "FL"],
    });
    expect(result.robots).toBe("index, follow");
    expect(result.html).toContain('<link rel="canonical" href="https://www.thetradescout.com/exchange/stone">');
    expect(result.html).not.toContain('class="stone-card"');
    expect(schema(result.html)).not.toHaveProperty("mainEntity");
  });

  it("qualifies eligible listing and ItemList links without leaking attribution into schema", () => {
    const result = renderExchangeStoneLanding({
      audience: { allowed: true, reason: "eligible" },
      items: [item], publicationReady: true, market: { state: "TX" }, states: ["TX", "FL"],
      acquisitionTags: { utm_source: "campaign" },
    });
    const selected = `https://www.thetradescout.com/exchange/building-materials/${id}?audienceState=TX&audienceCountry=US`;
    expect(result.robots).toBe("noindex, follow");
    expect(result.html).not.toMatch(/<link\s+rel="canonical"/i);
    expect(result.html).toContain('class="stone-card"');
    expect(result.html).toContain(`audienceState=TX&amp;audienceCountry=US`);
    expect(schema(result.html).mainEntity.itemListElement[0].url).toBe(selected);
    expect(schema(result.html).mainEntity.itemListElement[0].url).not.toContain("utm_");
  });

  it("retains the required Florida city and keeps excluded selections empty", () => {
    const tampa = renderExchangeStoneLanding({
      audience: { allowed: true, reason: "eligible" },
      items: [item], publicationReady: true, market: { city: "Tampa", state: "FL" }, states: ["TX", "FL"],
    });
    expect(schema(tampa.html).mainEntity.itemListElement[0].url).toContain(
      "?audienceState=FL&audienceCity=Tampa&audienceCountry=US"
    );
    for (const reason of ["pensacola", "outside_us"] as const) {
      const blocked = renderExchangeStoneLanding({
        audience: { allowed: false, reason },
        items: [item], publicationReady: true, market: { city: "Pensacola", state: "FL" }, states: ["TX", "FL"],
      });
      expect(blocked.robots).toBe("noindex, follow");
      expect(blocked.html).not.toContain('class="stone-card"');
      expect(schema(blocked.html)).not.toHaveProperty("mainEntity");
    }
  });

  it("rejects invalid link paths and excluded market inputs", () => {
    expect(audienceQualifiedStonePath(`/exchange/building-materials/${id}`, { state: "TX", country: "US" }))
      .toBe(`/exchange/building-materials/${id}?audienceState=TX&audienceCountry=US`);
    expect(audienceQualifiedStonePath("//external.example/stone", { state: "TX", country: "US" })).toBeNull();
    expect(audienceQualifiedStonePath(`/exchange/${id}?utm_source=spoof`, { state: "TX", country: "US" })).toBeNull();
    expect(audienceQualifiedStonePath(`/exchange/${id}`, { city: "Pensacola", state: "FL", country: "US" })).toBeNull();
    expect(audienceQualifiedStonePath(`/exchange/${id}`, { state: "TX", country: "CA" })).toBeNull();
  });
});
