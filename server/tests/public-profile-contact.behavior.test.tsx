import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BusinessProfileTheme from "../../client/src/pages/profile-sites/BusinessProfileTheme";
import { registerIssaBuildPublicRoutes } from "../issaBuildPublicRoutes";
import { resolveApprovedPublicContact, publicProfileContactStructuredData, withPublicProfileContactHtml } from "../../shared/publicProfileContact";

const supplied = { label: "Business contact", phone: "(850) 555-0123", tel: "+18505550123", email: "projects@example.test" };
const options = { publicationApproved: true };
const contact = resolveApprovedPublicContact(supplied, options);
const url = "https://www.thetradescout.com/issa-build";
const document = () => `<html><head><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "LocalBusiness", "@id": url + "#identity", url, name: "Example" }, { "@type": "Product", name: "Stone" }, { "@type": "Organization", name: "Publisher" }] })}</script></head><body><div id="root"><main data-seo-profile="true"><article><h1>Example</h1><p>Approved description</p></article></main></div></body></html>`;
const graph = (html: string) => JSON.parse(html.match(/<script[^>]*>(.*?)<\/script>/s)![1])["@graph"];

describe("explicitly approved public contact", () => {
  it("requires explicit publication approval, not management or a business name", () => {
    expect(resolveApprovedPublicContact(supplied, { publicationApproved: false })).toBeNull();
    expect(resolveApprovedPublicContact({ ...supplied, managed: true, businessName: "ISSA Build" }, {} as any)).toBeNull();
  });
  it("honors hidden contact even with publication permission", () => expect(resolveApprovedPublicContact(supplied, { ...options, visible: false })).toBeNull());
  it("returns only the supplied public pair, not owner or private fields", () => expect(resolveApprovedPublicContact({ ...supplied, ownerPhone: "+19999999999", secret: "private" }, options)).toEqual(supplied));
  it.each([null, undefined, [], {}, "phone", { ...supplied, tel: "javascript:alert(1)" }, { ...supplied, tel: "+19995550123" }, { ...supplied, phone: "<svg onload=alert(1)>" }, { ...supplied, email: "user@example.test?bcc=secret@example.test" }, { ...supplied, label: "Contact\nsecret" }])("rejects malformed public contact %j", (value) => expect(resolveApprovedPublicContact(value, options)).toBeNull());
  it("supports an ordinary business and an international public number without email", () => expect(resolveApprovedPublicContact({ label: "Contact", phone: "+44 20 7946 0958", tel: "+442079460958" }, options)).not.toBeNull());
  it("leaves the document byte-for-byte unchanged without public permission", () => expect(withPublicProfileContactHtml(document(), null, [url])).toBe(document()));
  it("does not add contact to a missing or private-page scaffold", () => expect(withPublicProfileContactHtml("<html>Not found</html>", contact, [url])).toBe("<html>Not found</html>"));
  it("does not annotate schema if there is no visible article to receive the contact", () => { const html = document().replace("<article>", "<div>").replace("</article>", "</div>"); expect(withPublicProfileContactHtml(html, contact, [url])).toBe(html); });
  it("adds visible native phone and email links without changing descriptions", () => {
    const html = withPublicProfileContactHtml(document(), contact, [url]);
    expect(html).toContain('href="tel:+18505550123"');
    expect(html).toContain('href="mailto:projects%40example.test"');
    expect(html).toContain("Approved description");
  });
  it("updates only the selected business identity, never its product or publisher", () => { const nodes = graph(withPublicProfileContactHtml(document(), contact, [url])); expect(nodes[0].telephone).toBe(supplied.tel); expect(nodes[0].contactPoint.email).toBe(supplied.email); expect(nodes[1].telephone).toBeUndefined(); expect(nodes[2].telephone).toBeUndefined(); });
  it("does not attach the contact to an unrelated identity", () => expect(graph(withPublicProfileContactHtml(document(), contact, ["https://other.test"]))[0].telephone).toBeUndefined());
  it("does not duplicate links on repeated rendering", () => { const once = withPublicProfileContactHtml(document(), contact, [url]); expect(withPublicProfileContactHtml(once, contact, [url])).toBe(once); });
  it("escapes labels in both HTML and structured data, including replacement markers", () => { const c = resolveApprovedPublicContact({ ...supplied, label: "Contact <script>oops</script> $&" }, options); const html = withPublicProfileContactHtml(document(), c, [url]); expect(html).not.toContain("<script>oops"); expect(html).toContain("&lt;script&gt;"); expect(html).toContain("\\u003cscript"); expect(html).toContain("$&amp;"); });
  it("preserves the approved operator label in structured data", () => expect(publicProfileContactStructuredData(contact).contactPoint?.contactType).toBe("Business contact"));
});

describe("shared business layout", () => {
  const props = { businessName: "An ordinary self-managed business", services: ["Remodeling"], serviceAreas: ["Pensacola"], galleryItems: [], onDirectConnect: vi.fn(), trustActions: null, tradeScoutHandoff: null };
  it("renders an approved public pair for any business alongside Start a Request", () => { const html = renderToStaticMarkup(<BusinessProfileTheme {...props} publicContact={contact} />); expect(html).toContain('data-testid="public-profile-contact"'); expect(html).toContain('href="tel:+18505550123"'); expect(html).toContain("Start a Request"); expect(html).not.toContain("543-0748"); });
  it("does not infer a public contact from a business name or management custody", () => { const html = renderToStaticMarkup(<BusinessProfileTheme {...props} businessName="ISSA Build" deliveryCustody="tradescout_pending_owner" />); expect(html).not.toContain('data-testid="public-profile-contact"'); expect(html).not.toContain('href="tel:'); });
  it("keeps the public contact hidden when the existing contact section is disabled", () => { const html = renderToStaticMarkup(<BusinessProfileTheme {...props} publicContact={contact} showContact={false} />); expect(html).not.toContain('href="tel:'); expect(html).not.toContain("Start a Request"); });
});

async function request(pathname: string, settings: { hidden?: boolean; missing?: boolean; host?: string } = {}) {
  let handler: any;
  const app = { use: (callback: any) => { handler = callback; } };
  const profile = settings.missing ? null : { slug: "issa-build", seoMeta: {}, profileSections: { contactCard: !settings.hidden } };
  registerIssaBuildPublicRoutes(app as any, { readTemplate: () => "", readProfile: vi.fn(async () => profile) as any, renderProfile: vi.fn(async () => document()) });
  const res: any = { code: 200, body: "", headers: {}, setHeader: vi.fn((name, value) => { res.headers[name] = value; }), status: vi.fn((code) => { res.code = code; return res; }), type: vi.fn(() => res), send: vi.fn((body) => { res.body = body; return res; }), redirect: vi.fn((code, location) => { res.code = code; res.headers.Location = location; return res; }) };
  const next = vi.fn();
  await handler({ method: "GET", path: pathname, originalUrl: pathname, query: {}, protocol: "https", headers: { host: settings.host || "www.thetradescout.com" }, get: (name: string) => name.toLowerCase() === "host" ? settings.host || "www.thetradescout.com" : undefined }, res, next);
  return { res, next };
}

describe("actual public route contact wiring", () => {
  it.each(["/issa-build", "/issa-build/onyx", "/issa-build/onyx/inventory/honey-onyx", "/issa-build/onyx/inventory/multi-green-onyx"])("publishes only the approved managed pair at %s", async (pathname) => { const { res } = await request(pathname); expect(res.code).toBe(200); expect(res.body).toContain('href="tel:+18505430748"'); expect(res.body).toContain("contact@thetradescout.com"); expect(res.body).toContain("TradeScout managed contact"); expect(res.body).not.toContain("850) 208-5644"); expect(graph(res.body)[0].telephone).toBe("+18505430748"); });
  it("respects a hidden contact section", async () => { const { res } = await request("/issa-build", { hidden: true }); expect(res.body).not.toContain("543-0748"); expect(graph(res.body)[0].telephone).toBeUndefined(); });
  it("does not expose contact on a missing business", async () => { const { res } = await request("/issa-build", { missing: true }); expect(res.code).toBe(404); expect(res.body).not.toContain("543-0748"); });
  it("keeps unrecognized children unavailable", async () => { const { res } = await request("/issa-build/onyx/inventory/unknown"); expect(res.code).toBe(404); expect(res.body).not.toContain("543-0748"); });
  it("does not claim another site's business identity", async () => { const { next, res } = await request("/issa-build", { host: "unrelated.example" }); expect(next).toHaveBeenCalledOnce(); expect(res.body).toBe(""); });
});
