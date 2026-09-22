import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Source-contract regression, not native Drizzle/PostgreSQL execution.
// Drizzle SQL array chunks expand to a parenthesized list of bound parameters.
// They are valid after IN, not an array value for ANY(...::text[]).
test("catalog identity uses a parameterized IN list, not an array-chunk cast", () => {
  const source = fs.readFileSync(new URL("../server/services/exchangeStoneCatalogReader.ts", import.meta.url), "utf8");
  assert.ok(source.includes("WHERE l.id IN ${[...stoneCatalog.keys()]} AND l.seller_id = ${sellerId}"));
  assert.equal(source.includes("ANY(${[...stoneCatalog.keys()]}::text[])"), false);
  assert.ok(source.includes("pool.query(query.sql, query.params)"));
});
