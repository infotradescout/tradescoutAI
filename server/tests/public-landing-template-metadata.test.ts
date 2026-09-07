import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPublicFindLocalBusinessesHtml,
  buildPublicLandingHtml,
  buildPublicPensacolaHtml,
} from "../publicLandingHtml";

const origin = "https://www.thetradescout.com";
const template = fs.readFileSync(path.resolve("client/landing.html"), "utf8");
const descriptionKeys = [
  ["name", "description"],
  ["property", "og:description"],
  ["name", "twitter:description"],
] as const;

function tags(html: string, element: string, attribute: string, value: string) {
  const identity = new RegExp(`\\s${attribute}\\s*=\\s*(?:"${value}"|'${value}')`, "i");
  return [...html.matchAll(new RegExp(`<${element}\\b[^>]*>`, "gi"))]
    .map((match) => match[0])
    .filter((tag) => identity.test(tag));
}

function expectSingleDescriptions(html: string) {
  for (const [attribute, key] of descriptionKeys) {
    expect(tags(html, "meta", attribute, key), key).toHaveLength(1);
  }
  expect(tags(html, "link", "rel", "canonical")).toHaveLength(1);
  expect(tags(html, "meta", "name", "robots")).toHaveLength(1);
  expect(tags(html, "meta", "property", "og:image")).toHaveLength(1);
  expect(tags(html, "meta", "name", "twitter:image")).toHaveLength(1);
  expect(html).not.toMatch(/contact before acceptance|stale fixture description/);
}

describe("actual public landing template metadata", () => {
  it("keeps the unrendered fallback descriptions consistent with submission consent", () => {
    expect(template).not.toMatch(/contact before acceptance/);
    for (const [attribute, key] of descriptionKeys) {
      const existing = tags(template, "meta", attribute, key);
      expect(existing).toHaveLength(1);
      expect(existing[0]).toContain("before you send a request");
    }
    expect(template).toContain('src="/src/landing-main.tsx"');
    expect(template).toContain('id="ts-landing-fallback"');
  });

  it.each(["/", "/landing", "/lp"])("uses one current description in the real formatted template at %s", async (requestPath) => {
    const html = await buildPublicLandingHtml({ origin, requestPath, templateHtml: template });
    expectSingleDescriptions(html);
    for (const [attribute, key] of descriptionKeys) {
      expect(tags(html, "meta", attribute, key)[0]).toContain("before you send a request");
    }
    expect(html).toContain('href="https://www.thetradescout.com/"');
    expect(html).toContain("Sending a Direct Connect request shares your name and phone number with the businesses you choose");
    expect(html).toContain('src="/src/landing-main.tsx"');
    expect(html).toContain('href="/manifest.json?v=11"');
    expect(html).toContain('content="#091119"');
    expect(tags(html, "meta", "name", "robots")[0]).toContain(requestPath === "/" ? "index, follow" : "noindex,follow");
  });

  it("replaces reordered, single-quoted and duplicate identities without removing unrelated tags", async () => {
    const formatted = template.replace("</head>", `
      <META content='stale fixture description' NAME = 'description'>
      <meta\n content="stale fixture description" property = 'og:description'>
      <meta content='stale fixture description' name='twitter:description'>
      <link href='https://example.com/stale' REL = 'canonical'>
      <meta content='noindex' name = 'robots'>
      <meta name='description-extra' content='retained unrelated description'>
      <link rel='alternate' href='https://example.com/alternate'>
    </head>`);
    const html = await buildPublicLandingHtml({ origin, requestPath: "/", templateHtml: formatted });
    expectSingleDescriptions(html);
    expect(html).toContain("retained unrelated description");
    expect(html).toContain("https://example.com/alternate");
    expect(html).not.toContain("https://example.com/stale");
    expect(html).toContain('href="/favicon.svg?v=12"');
  });

  it("uses Pensacola's existing description rather than leaving homepage metadata beside it", () => {
    const html = buildPublicPensacolaHtml({ origin, templateHtml: template });
    expectSingleDescriptions(html);
    expect(tags(html, "link", "rel", "canonical")[0]).toContain(origin + "/pensacola");
    expect(tags(html, "meta", "name", "description")[0]).toContain("Pensacola");
  });

  it("uses local discovery's existing description without duplicate homepage metadata", () => {
    const html = buildPublicFindLocalBusinessesHtml({ origin, templateHtml: template });
    expectSingleDescriptions(html);
    expect(tags(html, "link", "rel", "canonical")[0]).toContain(origin + "/find-local-businesses");
    expect(html).toContain("Browse local businesses");
  });
});
