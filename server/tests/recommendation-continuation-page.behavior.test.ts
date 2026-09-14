import express from "express";
import request from "supertest";
import fs from "node:fs";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ getContractorBySlug: vi.fn(), getBusinessProfileByUserId: vi.fn() }));
vi.mock("../storage", () => ({ storage: calls }));
import { recommendationContinuationPage } from "../recommendationContinuationPage";
import { buildPublicContractorProfileHtml } from "../publicContractorProfileHtml";

const template = '<!doctype html><html><head><title>TradeScout</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';
const contractor = { id: "synthetic-contractor", userId: "synthetic-owner", companyName: "Synthetic Installer", slug: "synthetic-installer", photos: [], isActive: true };
function application(readTemplate: () => Promise<string> = async () => template) {
  const app = express();
  app.get("/contractors/:slug", recommendationContinuationPage(readTemplate));
  app.get("/contractors/:slug", (_req, res) => res.redirect(301, "/business/synthetic-installer"));
  return app;
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  calls.getContractorBySlug.mockReset().mockResolvedValue(contractor);
  calls.getBusinessProfileByUserId.mockReset().mockResolvedValue({ visibility: "public", slug: "synthetic-installer" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Recommendation full-page continuation", () => {
  it("proves the ordinary renderer would redirect, but the precise action serves the real HTML renderer", async () => {
    expect(await buildPublicContractorProfileHtml({ slug: contractor.slug, origin: "https://www.thetradescout.com", templateHtml: template })).toEqual({ kind: "redirect", location: "/business/synthetic-installer" });
    const response = await request(application()).get("/contractors/synthetic-installer?trustAction=recommend");
    expect(response.status).toBe(200); expect(response.headers.location).toBeUndefined();
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toBe("private, no-store"); expect(response.headers["x-robots-tag"]).toBe("noindex");
    expect(response.text).toContain("Synthetic Installer"); expect(response.text).toContain('/assets/app.js');
    expect(response.text).toContain('id="root"'); expect(response.text).not.toContain("recommendation-draft");
    expect(calls.getContractorBySlug).toHaveBeenLastCalledWith(contractor.slug);
  });
  it.each([
    "", "?trustAction=unrelated", "?trustAction=Recommend",
    "?trustAction=recommend&trustAction=recommend", "?trustAction=recommend&trustAction=other",
  ])("retains ordinary canonical behavior for %s", async query => {
    const response = await request(application()).get('/contractors/synthetic-installer' + query);
    expect(response.status).toBe(301); expect(response.headers.location).toBe('/business/synthetic-installer');
    expect(calls.getContractorBySlug).not.toHaveBeenCalled();
  });
  it.each(['apply', 'signup', 'accelerator', 'dashboard'])("does not override reserved entry %s", async slug => {
    expect((await request(application()).get(`/contractors/${slug}?trustAction=recommend`)).status).toBe(301);
    expect(calls.getContractorBySlug).not.toHaveBeenCalled();
  });
  it("does not introduce an encoded-path exemption", async () => {
    const response = await request(application()).get('/contractors/%73ynthetic-installer?trustAction=recommend');
    expect(response.status).toBe(301); expect(calls.getContractorBySlug).not.toHaveBeenCalled();
  });
  it("supports a normal trailing slash and a HEAD without a redirect", async () => {
    expect((await request(application()).get('/contractors/synthetic-installer/?trustAction=recommend')).status).toBe(200);
    expect((await request(application()).head('/contractors/synthetic-installer?trustAction=recommend')).status).toBe(200);
  });
  it.each([null, { ...contractor, isActive: false }])("fails closed for a missing or inactive provider", async value => {
    calls.getContractorBySlug.mockResolvedValue(value);
    const response = await request(application()).get('/contractors/synthetic-installer?trustAction=recommend');
    expect(response.status).toBe(404); expect(response.headers.location).toBeUndefined();
  });
  it("reports a template failure without dropping the saved action into a canonical redirect", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request(application(async () => { throw new Error('Synthetic template failure'); })).get('/contractors/synthetic-installer?trustAction=recommend');
    expect(response.status).toBe(503); expect(response.headers.location).toBeUndefined();
    expect(response.text).toContain('saved draft'); expect(response.text).not.toContain('Synthetic template failure');
  });
  it("leaves development HTML to the existing Vite owner", async () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect((await request(application()).get('/contractors/synthetic-installer?trustAction=recommend')).status).toBe(301);
    expect(calls.getContractorBySlug).not.toHaveBeenCalled();
  });
  it("cannot write or grant publication through the page route", async () => {
    expect((await request(application()).post('/contractors/synthetic-installer?trustAction=recommend').send({ isPublic: true })).status).toBe(404);
    expect(calls.getContractorBySlug).not.toHaveBeenCalled();
  });
  it("registers the action before the unchanged production canonical metadata route", () => {
    const index = fs.readFileSync('server/index.ts', 'utf8');
    const routes = fs.readFileSync('server/routes/recommendations.ts', 'utf8');
    const registration = index.indexOf('const server = await registerRoutes(app);');
    const canonical = index.indexOf('app.get("/contractors/:slug"');
    expect(registration).toBeGreaterThan(-1); expect(canonical).toBeGreaterThan(registration);
    expect(routes).toContain('app.get("/contractors/:slug", recommendationContinuationPage())');
  });
});
