import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("Scout result action card lifecycle contracts", () => {
  it("shows one card per new query and avoids duplicates for same query", () => {
    const source = read("client/src/scout/ScoutThread.tsx");

    expect(source).toContain(
      "const [resultCardQuery, setResultCardQuery] = React.useState<string | null>(null);"
    );
    expect(source).toContain("const lastResultCardRef = React.useRef");
    expect(source).toContain("if (previous.queryKey === queryKey) return;");
    expect(source).toContain("setResultCardQuery(queryText);");
    expect(source).toContain("{resultCardQuery && (");
  });

  it("allows follow-up cards only when intent changes", () => {
    const source = read("client/src/scout/ScoutThread.tsx");

    expect(source).toContain("function isScoutFollowUpQuery(value?: string): boolean {");
    expect(source).toContain("const followUp = isScoutFollowUpQuery(queryText);");
    expect(source).toContain("if (followUp && previous.intent === intent) return;");
    expect(source).toContain("classifyScoutResultIntent(queryText)");
  });

  it("renders no result card on empty ScoutHome", () => {
    const homeSource = read("client/src/scout/ScoutHome.tsx");

    expect(homeSource).not.toContain("ScoutResultActionCard");
  });
});
