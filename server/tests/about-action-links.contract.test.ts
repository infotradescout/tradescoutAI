import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("About action links", () => {
  it("renders every canonical action with a stable promise ID and destination", () => {
    const source = read("client/src/pages/about-explainer-content.tsx");
    expect(source).toContain("data-about-promise-id={promiseId}");
    expect(source).toContain("data-about-action-link={promiseId}");
    expect(source).toContain("<a href={feature.href}");
  });

  it.each([
    ["Maps", "maps"],
    ["Leaderboard", "leaderboard"],
    ["Messages and quotes", "messages"],
    ["Conversation search", "messages"],
    ["Connections", "connections"],
    ["Notes", "notes"],
    ["CRM", "crm"],
  ])("routes %s to its real surface", (featureName, routeKey) => {
    const source = read("client/src/pages/about-explainer-content.tsx");
    const start = source.indexOf(`name: "${featureName}"`);
    expect(start).toBeGreaterThan(-1);
    expect(source.slice(start, start + 420)).toContain(`href: routes.${routeKey}`);
  });
});
