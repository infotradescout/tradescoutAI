import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ISSA_BUILD_LOCAL_DISCOVERY } from "@shared/issaBuildProfile";
import { resolvePublicProfileRootDiscoverySlug } from "@shared/publicProfileRootDiscovery";

const mock = vi.hoisted(() => ({ getProfileBySlugPublic: vi.fn() }));
vi.mock("../storage", () => ({ storage: mock }));
import { attachPublicProfileServiceLinks } from "../publicProfileServiceHtml";
import { attachPublicProfileServiceAreaLink } from "../publicProfileServiceAreaLinks";

const base = "https://www.thetradescout.com";
const html = '<!doctype html><html><head><title>ISSA Build</title><link rel="canonical" href="https://www.thetradescout.com/issa-build"></head><body><main><article><h1>ISSA Build</h1></article></main></body></html>';
const serviceUrls = ISSA_BUILD_LOCAL_DISCOVERY.services.map(service => `${base}/u/issa-build/services/${service.slug}`);
const hubUrl = `${base}/u/issa-build/service-areas`;
function profile() {
  return {
    slug: "issa-build", displayName: "ISSA Build", seoMeta: {},
    contentBlocks: [{ type: "localServiceProfile", data: {
      serviceAreas: ["Pensacola, FL"], services: ISSA_BUILD_LOCAL_DISCOVERY.services.map(service => ({ ...service })),
    } }],
  };
}
function app(options: { status?: number; body?: string; repeated?: boolean } = {}) {
  const server = express();
  server.use(async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    try {
      await attachPublicProfileServiceLinks(req, res);
      await attachPublicProfileServiceAreaLink(req, res);
      if (options.repeated) {
        await attachPublicProfileServiceLinks(req, res);
        await attachPublicProfileServiceAreaLink(req, res);
      }
      next();
    } catch (error) { next(error); }
  });
  server.get("*", (req, res) => {
    res.setHeader('X-Fixture-Original-Url', req.originalUrl);
    res.status(options.status || 200).send(options.body ?? html);
  });
  return server;
}
// The socket stays on loopback; the real Host header exercises the production
// origin branch without mocking resolvePublicOrigin or making external calls.
const get = (server: express.Express, pathname: string) => request(server).get(pathname).set('Host', 'www.thetradescout.com');
beforeEach(() => mock.getProfileBySlugPublic.mockReset().mockResolvedValue(profile()));

// Only the public storage lookup is a fixture. Express, request origin, both
// link owners and the service/area resolvers are real; no database is changed.
describe("Canonical public profile root discovery", () => {
  it.each(["/issa-build", "/issa-build/", "/u/issa-build", "/u/issa-build/"])("links all four existing services and the hub from %s", async pathname => {
    const original = profile(); mock.getProfileBySlugPublic.mockResolvedValue(original);
    const before = structuredClone(original);
    const response = await get(app(), pathname);
    expect(response.status).toBe(200);
    for (const url of [...serviceUrls, hubUrl]) expect(response.text).toContain(`href="${url}"`);
    for (const service of ISSA_BUILD_LOCAL_DISCOVERY.services) expect(response.text).toContain(service.description);
    expect(response.text).toContain('rel="canonical" href="https://www.thetradescout.com/issa-build"');
    expect(response.text).not.toContain('/issa-build/services/');
    expect(response.text.match(/data-seo-profile-service-links="true"/g)).toHaveLength(1);
    expect(response.text.match(/data-seo-profile-service-area-link="true"/g)).toHaveLength(1);
    expect(mock.getProfileBySlugPublic).toHaveBeenCalledWith("issa-build");
    expect(original).toEqual(before);
  });
  it("retains the original request path and query", async () => {
    const response = await get(app(), '/issa-build?source=shared');
    expect(response.status).toBe(200); expect(response.text).toContain(`href="${serviceUrls[0]}"`);
    expect(response.headers['x-fixture-original-url']).toBe('/issa-build?source=shared');
  });
  it("retains loopback origins for local previews", async () => {
    const response = await request(app()).get('/issa-build');
    for (const service of ISSA_BUILD_LOCAL_DISCOVERY.services) {
      expect(response.text).toMatch(new RegExp('href="http://127\\.0\\.0\\.1:\\d+/u/issa-build/services/' + service.slug + '"'));
    }
  });
  it("ignores untrusted forwarded hosts", async () => {
    const response = await get(app(), '/issa-build').set('X-Forwarded-Host', 'untrusted.example');
    expect(response.text).toContain(`href="${serviceUrls[0]}"`);
    expect(response.text).not.toContain('untrusted.example');
  });
  it("does not expose a profile denied by the existing public getter", async () => {
    mock.getProfileBySlugPublic.mockResolvedValue(undefined);
    expect((await get(app(), '/issa-build')).text).toBe(html);
  });
  it("leaves custom-domain ownership to its existing canonical handler", async () => {
    mock.getProfileBySlugPublic.mockResolvedValue({ ...profile(), seoMeta: { customDomain: 'fixture.example' } });
    expect((await get(app(), '/issa-build')).text).toBe(html);
  });
  it("does not manufacture pages from title-only or empty services", async () => {
    for (const services of [[], [{ title: 'Cabinets', slug: 'cabinets' }]]) {
      mock.getProfileBySlugPublic.mockResolvedValue({ ...profile(), contentBlocks: [{ type: 'localServiceProfile', data: { services, serviceAreas: ['Pensacola, FL'] } }] });
      expect((await get(app(), '/issa-build')).text).toBe(html);
    }
  });
  it("retains the published service-area opt-out", async () => {
    const value = profile();
    mock.getProfileBySlugPublic.mockResolvedValue({ ...value, contentBlocks: [...value.contentBlocks, { type: 'publicDiscovery', data: { sitemap: { serviceAreas: false } } }] });
    const response = await get(app(), '/issa-build');
    expect(response.text).toContain(`href="${serviceUrls[0]}"`);
    expect(response.text).not.toContain('data-seo-profile-service-area-link');
  });
  it.each([301, 308, 400, 401, 403, 404, 500, 503])("does not inject public discovery into HTTP %s", async status => {
    const response = await get(app({ status }), '/issa-build');
    expect(response.status).toBe(status); expect(response.text).toBe(html);
  });
  it("preserves non-HTML bodies", async () => {
    expect((await get(app({ body: 'Not an HTML profile' }), '/issa-build')).text).toBe('Not an HTML profile');
  });
  it("does not duplicate sections when both owners are attached twice", async () => {
    const response = await get(app({ repeated: true }), '/issa-build');
    expect(response.text.match(/data-seo-profile-service-links="true"/g)).toHaveLength(1);
    expect(response.text.match(/data-seo-profile-service-area-link="true"/g)).toHaveLength(1);
  });
  it.each(['/issa-build/onyx', '/issa-build/services/cabinets', '/u/issa-build/services/cabinets', '/business/issa-build', '/contractors/issa-build', '/unregistered-business', '/admin', '/'])("does not reinterpret child, legacy, private or arbitrary route %s", async pathname => {
    expect((await get(app(), pathname)).text).toBe(html);
    expect(mock.getProfileBySlugPublic).not.toHaveBeenCalled();
  });
  it("supports HEAD without granting write behavior", async () => {
    expect((await request(app()).head('/issa-build').set('Host', 'www.thetradescout.com')).status).toBe(200);
    mock.getProfileBySlugPublic.mockClear();
    expect((await request(app()).post('/issa-build').send({ publiclyReleased: true })).status).toBe(404);
    expect(mock.getProfileBySlugPublic).not.toHaveBeenCalled();
  });
});

describe("Public root identity grammar", () => {
  it.each(['/issa-build', '/ISSA-BUILD/', '/u/issa-build', '/U/ISSA-BUILD/'])("recognizes the established root %s", pathname => {
    expect(resolvePublicProfileRootDiscoverySlug(pathname)).toBe('issa-build');
  });
  it("retains ordinary /u profile roots", () => {
    expect(resolvePublicProfileRootDiscoverySlug('/u/local-provider')).toBe('local-provider');
  });
  it.each([undefined, null, 7, '', '/u/%', '/u/one%2Ftwo', '/u/one%5Ctwo', '/u/%252F', '/u/one%3Ftwo', '/u/one%23two', '/u/%00', '/u/two%20words', '/issa-build?next=x', '/%69ssa-build', 'https://www.thetradescout.com/issa-build', '/u/' + 'a'.repeat(161)])("rejects malformed or non-root identity %s", pathname => {
    expect(resolvePublicProfileRootDiscoverySlug(pathname)).toBeNull();
  });
});
