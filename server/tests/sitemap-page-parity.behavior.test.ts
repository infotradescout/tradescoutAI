import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { toPublicHomeScoutListing } from "../publicHomeScoutListing";

const bridge = vi.hoisted(() => ({ database: null as any }));
vi.mock("../db", () => ({
  db: new Proxy({}, { get(_target, key) {
    const value = bridge.database[key];
    return typeof value === "function" ? value.bind(bridge.database) : value;
  } }),
  pool: {},
}));
// County candidates have already passed the business-detail publication check.
// This fixture isolates their additional real cached trade-scope requirement.
// HomeScout uses the actual authority SQL, without an eligibility mock.
vi.mock("../publicationBusiness", () => ({
  publicBusinessDetailExposureSqlPredicate: () => sql`TRUE`,
  publicBusinessSitemapCrawlabilitySqlPredicate: () => sql`TRUE`,
}));
import { SitemapRepository } from "../repositories/sitemapRepository";
import { listActiveCountyTradeScopes } from "../services/seoDirectoryNavigationService";

const database = new PGlite();
const repository = new SitemapRepository();
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
beforeAll(async () => {
  bridge.database = drizzle(database);
  await database.exec(`
    CREATE TABLE users (id varchar PRIMARY KEY, email_verified boolean, address_verified boolean, verification_status text);
    CREATE TABLE business_verifications (provider_user_id varchar, status text, verification_type text, expires_at timestamp);
    CREATE TABLE businesses (id varchar PRIMARY KEY, status text, public_discovery_enabled boolean, owner_user_id varchar, updated_at timestamp);
    CREATE TABLE counties (id varchar PRIMARY KEY, fips varchar, name text, state_code varchar);
    CREATE TABLE business_counties (business_id varchar, county_id varchar);
    CREATE TABLE ts_seo_trade_county_pages (trade_slug text, state_code text, county_slug text, business_count integer);
    CREATE TABLE home_scout_listings (id varchar PRIMARY KEY, title text, county_fips varchar, state_code varchar, status text, updated_at timestamp, contact_user_id varchar, agent_user_id varchar, seller_user_id varchar);
    INSERT INTO users VALUES ('allowed',true,true,'pending'),('unverified',false,true,'approved'),('identity',true,false,'approved'),('licensed',true,false,'pending'),('expired',true,false,'pending');
    INSERT INTO business_verifications VALUES ('licensed','approved','license',NULL),('expired','approved','license','2020-01-01');
    INSERT INTO counties VALUES ('a','01001','Autauga','AL'),('e','12033','Escambia','FL'),('j','22051','Jefferson Parish','LA'),('s','12113','Santa Rosa','FL');
    INSERT INTO businesses VALUES ('b','active',true,'allowed','2026-09-11');
    INSERT INTO business_counties SELECT 'b',id FROM counties;
    INSERT INTO ts_seo_trade_county_pages VALUES ('plumber','FL','escambia',3),('electrician','FL','santa-rosa',2),('carpenter','LA','jefferson-parish',1),('plumber','AL','autauga',0);
  `);
  const fixtures = [
    {n:1,title:' ',contact:'allowed'},
    {n:2,title:'Malformed location',contact:'allowed',county:'bad'},
    {n:10,title:'Eligible contact listing',contact:'allowed',agent:'unverified'},
    {n:11,title:'Agent fallback listing',contact:'',agent:'identity'},
    {n:12,title:'Seller fallback listing',contact:null,agent:null,seller:'licensed'},
    {n:20,title:'Unverified contact cannot borrow eligible agent',contact:'unverified',agent:'allowed'},
    {n:21,title:'Whitespace contact does not fall back',contact:' ',agent:'allowed'},
    {n:22,title:'Expired business evidence',contact:'expired'},
    {n:23,title:'Missing account',contact:'missing'},
    {n:24,title:'Inactive listing',contact:'allowed',status:'inactive'},
    {n:25,title:'No authority identity',contact:null,agent:null,seller:null},
  ];
  for (const item of fixtures) {
    await database.query('INSERT INTO home_scout_listings VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',[
      id(item.n),item.title,item.county||'12033','FL',item.status||'active','2026-09-11',item.contact,item.agent??null,item.seller??null,
    ]);
  }
});
afterAll(async () => { await database.close(); });

describe("County sitemap matches served scope", () => {
  it("excludes a business-bearing county that the public county page rejects", async () => {
    expect(await listActiveCountyTradeScopes('AL','autauga')).toEqual([]);
    const rows=await repository.listDirectoryCountiesForSitemap();
    expect(rows.map(row=>row.fips)).toEqual(['12033','12113','22051']);
    expect(rows.some(row=>row.fips==='01001')).toBe(false);
  });
  it("counts only that same served set", async () => {
    expect(await repository.countDirectoryCountiesForSitemap()).toBe(3);
  });
  it("paginates after eligibility instead of producing holes from rejected counties", async () => {
    expect((await repository.listDirectoryCountiesForSitemap({limit:1,offset:0})).map(row=>row.fips)).toEqual(['12033']);
    expect((await repository.listDirectoryCountiesForSitemap({limit:1,offset:1})).map(row=>row.fips)).toEqual(['12113']);
    expect((await repository.listDirectoryCountiesForSitemap({limit:1,offset:2})).map(row=>row.fips)).toEqual(['22051']);
    expect(await repository.listDirectoryCountiesForSitemap({limit:1,offset:3})).toEqual([]);
  });
  it("uses the same Parish slug and preserves stored modification time", async () => {
    const rows=await repository.listDirectoryCountiesForSitemap();
    expect(await listActiveCountyTradeScopes('LA','jefferson-parish')).toHaveLength(1);
    expect(rows.find(row=>row.fips==='22051')?.name).toBe('Jefferson Parish');
    expect(new Date(rows[0].updatedAt!).toISOString()).toBe('2026-09-11T00:00:00.000Z');
  });
});

describe("HomeScout sitemap matches public listing prerequisites", () => {
  it("uses real exposure SQL and the public projection rather than status alone", async () => {
    const before=await database.query('select count(*)::int as n from home_scout_listings');
    const rows=await repository.listActiveHomeScoutListingsForSitemap();
    expect(rows.map(row=>row.id)).toEqual([id(10),id(11),id(12)]);
    const after=await database.query('select count(*)::int as n from home_scout_listings');
    expect(after.rows).toEqual(before.rows);
    expect(rows.every(row=>Object.keys(row).sort().join(',')==='id,updatedAt')).toBe(true);
  });
  it("fills bounded pages even when the earliest eligible-author records fail public projection", async () => {
    expect((await repository.listActiveHomeScoutListingsForSitemap({limit:1})).map(row=>row.id)).toEqual([id(10)]);
    expect((await repository.listActiveHomeScoutListingsForSitemap({limit:2})).map(row=>row.id)).toEqual([id(10),id(11)]);
  });
  it("preserves contact/agent/seller precedence, current evidence and email requirements", async () => {
    const ids=(await repository.listActiveHomeScoutListingsForSitemap()).map(row=>row.id);
    for(const rejected of [20,21,22,23,24,25])expect(ids).not.toContain(id(rejected));
  });
  it("omits records that the actual public projection cannot represent", () => {
    expect(toPublicHomeScoutListing({id:id(1),title:' ',countyFips:'12033',stateCode:'FL'})).toBeNull();
    expect(toPublicHomeScoutListing({id:id(2),title:'Malformed location',countyFips:'bad',stateCode:'FL'})).toBeNull();
  });
  it("immediately stops advertising a newly unverified author", async () => {
    await database.exec("UPDATE users SET email_verified=false WHERE id='allowed'");
    try{expect((await repository.listActiveHomeScoutListingsForSitemap()).map(row=>row.id)).toEqual([id(11),id(12)]);}
    finally{await database.exec("UPDATE users SET email_verified=true WHERE id='allowed'");}
  });
});
