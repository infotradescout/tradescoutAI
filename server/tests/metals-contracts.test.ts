import { describe, expect, it } from "vitest";
import fs from "fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("Metals Exchange Contracts", () => {
  it("mounts the metals router", () => {
    const routes = read("server/routes.ts");
    expect(routes).toContain("metalsRouter");
    expect(routes).toContain("app.use(metalsRouter)");
  });

  it("exposes metals pricing and portfolio endpoints", () => {
    const src = read("server/routes/metals.ts");
    expect(src).toContain("/api/metals/prices");
    expect(src).toContain("/api/metals/portfolio/summary");
    expect(src).toContain("/api/metals/portfolio/transactions");
  });
});
