import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Scout response-shape wiring", () => {
  it("routes trimResponseToScreenFit through ensureFollowUpQuestion", () => {
    const routeFile = readFileSync(join(process.cwd(), "server", "routes", "scout.ts"), "utf8");

    expect(routeFile).toContain('import { ensureFollowUpQuestion } from "../scout/responseShape";');
    expect(routeFile).toContain("return ensureFollowUpQuestion(result);");
  });
});
