import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { PgDialect } from "drizzle-orm/pg-core";
import { getTradeSeoMatch } from "@shared/tradeSeo";
import { buildPublicTradeCityHtml } from "../publicTradeCityHtml";

const fixture = vi.hoisted(() => ({ rows: [] as any[], where: vi.fn() }));
vi.mock("../db", () => ({ db: { select: () => {
  const query: any = {};
  for (const method of ["from", "innerJoin", "leftJoin", "groupBy", "orderBy"]) query[method] = () => query;
  query.where = (predicate: unknown) => { fixture.where(predicate); return query; };
  query.limit = async () => fixture.rows;
  return query;
} } }));
vi.mock("../publicationRules", () => ({ getPublicationRules: async () => ({ categoryPageRecencyWindowDays: 30 }) }));

describe("ISSA countertop public directory routes with synthetic county results", () => {
  beforeEach(() => {
    fixture.where.mockReset();
    fixture.rows = [{ countyFips: "12033", countyName: "Escambia County", stateCode: "FL", businessCount: 1 }];
  });
  it.each(["Countertop Fabrication", "Countertop Installation"])(
    "renders %s through the actual Pensacola city renderer and bounded trade predicate", async name => {
      const slug = getTradeSeoMatch(name)!.canonicalSlug;
      const html = await buildPublicTradeCityHtml({
        templateHtml: '<html><head></head><body><div id="root"></div></body></html>',
        origin: "https://www.thetradescout.com", tradeSlug: name, stateCode: "FL", citySlug: "pensacola",
      });
      expect(html).not.toBeNull();
      const document = new JSDOM(html!).window.document;
      expect(document.querySelector("h1")?.textContent).toBe(`${name} in Pensacola, FL`);
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
        `https://www.thetradescout.com/trade/${slug}/fl/city/pensacola`
      );
      expect(document.querySelector(`a[href="/trade/${slug}/fl/escambia?city=pensacola"]`)).not.toBeNull();
      expect(document.body.textContent).toContain("Contact is protected through TradeScout Direct Connect.");
      const query = new PgDialect().sqlToQuery(fixture.where.mock.calls[0][0]);
      expect(query.params).toContain(`%${name}%`);
      expect(query.params).toContain("FL");
      expect(query.params).toContain("pensacola");
    }
  );
  it("does not create an indexable city page from an empty synthetic discovery result", async () => {
    fixture.rows = [];
    expect(await buildPublicTradeCityHtml({
      templateHtml: '<html><head></head><body><div id="root"></div></body></html>',
      origin: "https://www.thetradescout.com", tradeSlug: "countertop-installation", stateCode: "FL", citySlug: "pensacola",
    })).toBeNull();
  });
});
