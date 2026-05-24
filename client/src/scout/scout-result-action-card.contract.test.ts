import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("Scout result action card contracts", () => {
  it("renders result card in thread after user query", () => {
    const threadSource = read("client/src/scout/ScoutThread.tsx");

    expect(threadSource).toContain(
      'import { ScoutResultActionCard } from "./ScoutResultActionCard";'
    );
    expect(threadSource).toContain("const firstUserMessage = React.useMemo(");
    expect(threadSource).toContain("{firstUserMessage && (");
    expect(threadSource).toContain("<ScoutResultActionCard");
    expect(threadSource).toContain("query={firstUserMessage.content}");
  });

  it("does not render result card on empty ScoutHome", () => {
    const homeSource = read("client/src/scout/ScoutHome.tsx");

    expect(homeSource).not.toContain("ScoutResultActionCard");
  });

  it("uses consumer-safe copy and action labels", () => {
    const cardSource = read("client/src/scout/ScoutResultActionCard.tsx");

    expect(cardSource).toContain("Home repair");
    expect(cardSource).toContain("Vehicle help");
    expect(cardSource).toContain("Local listings");
    expect(cardSource).toContain("Local help");
    expect(cardSource).toContain("Price check");
    expect(cardSource).toContain("Nearby activity");
    expect(cardSource).toContain("You review before anything is shared.");

    expect(cardSource).not.toContain("county_metrics");
    expect(cardSource).not.toContain("source-backed");
    expect(cardSource).not.toContain("confidence");
    expect(cardSource).not.toContain("building your best next step");
  });

  it("maps actions to real routes or safe follow-up queries", () => {
    const cardSource = read("client/src/scout/ScoutResultActionCard.tsx");

    expect(cardSource).toContain('to: "/direct-connect"');
    expect(cardSource).toContain('to: "/direct-connect/pros"');
    expect(cardSource).toContain('to: "/exchange"');
    expect(cardSource).toContain('to: "/exchange/new"');
    expect(cardSource).toContain('to: "/vehicles"');
    expect(cardSource).toContain('to: "/community"');
    expect(cardSource).toContain('to: "/utilities/supply-run"');

    expect(cardSource).toContain('prompt: "Compare local prices for this home repair."');
    expect(cardSource).toContain('prompt: "Compare local prices for this vehicle service."');
    expect(cardSource).toContain('prompt: "Compare local listing prices for this."');
    expect(cardSource).toContain('prompt: "What should I verify before contacting local help?"');
    expect(cardSource).toContain('prompt: "Search nearby posts and activity."');
  });
});
