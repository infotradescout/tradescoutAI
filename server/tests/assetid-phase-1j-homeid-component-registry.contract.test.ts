import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1j homeid component registry contracts", () => {
  it("adds HomeID components persistence endpoint and storage contract", () => {
    const homesSource = read("server/routes/homes.ts");
    expect(homesSource).toContain('router.put("/api/homeid/:homeId/components"');
    expect(homesSource).toContain(
      'const HOMEID_PERSISTENCE_COMPONENTS_TITLE = "homeid:persistence:components"'
    );
    expect(homesSource).toContain("components: z.array(homeIdComponentSchema).max(800)");
  });

  it("includes components in HomeID persistence hydrate payload", () => {
    const homesSource = read("server/routes/homes.ts");
    expect(homesSource).toContain("componentsRecord");
    expect(homesSource).toContain("components: HomeIdServerComponent[]");
    expect(homesSource).toContain("components,");
  });

  it("maps direct connect component metadata into HomeID component records", () => {
    const directConnectSource = read("server/routes/direct-connect/home-id.ts");
    expect(directConnectSource).toContain("async function upsertHomeIdComponentFromDirectConnect");
    expect(directConnectSource).toContain("title: HOMEID_PERSISTENCE_COMPONENTS_TITLE");
    expect(directConnectSource).toContain('source: "direct_connect_completed_work"');
    expect(directConnectSource).toContain("await upsertHomeIdComponentFromDirectConnect({");
  });
});
