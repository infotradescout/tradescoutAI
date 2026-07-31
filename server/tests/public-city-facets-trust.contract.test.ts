import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public city facet trust boundary", () => {
  it("filters both anonymous aggregations before grouping or limiting", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/city-public.ts"),
      "utf8"
    );

    expect(
      source.match(/\.leftJoin\(users, eq\(users\.id, businesses\.ownerUserId\)\)/g)
    ).toHaveLength(2);
    expect(source.match(/eq\(businesses\.publicDiscoveryEnabled, true\)/g)).toHaveLength(2);
    expect(source.match(/publicBusinessDetailExposureSqlPredicate\(\)/g)).toHaveLength(2);
    for (const route of source.split('router.get("').slice(1)) {
      const predicate = route.indexOf("publicBusinessDetailExposureSqlPredicate()");
      expect(predicate).toBeGreaterThan(-1);
      expect(predicate).toBeLessThan(route.indexOf(".groupBy("));
      expect(predicate).toBeLessThan(route.indexOf(".limit(200)"));
    }
  });
});
