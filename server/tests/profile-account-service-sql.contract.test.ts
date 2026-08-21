import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("profile account service SQL contract", () => {
  it("keeps the reused user id parameter explicitly typed for PostgreSQL", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "server/services/profileAccountService.ts"),
      "utf8"
    );

    expect(source).toContain("$1::varchar,");
    expect(source).toContain("WHERE user_id = $1::varchar");
  });
});
