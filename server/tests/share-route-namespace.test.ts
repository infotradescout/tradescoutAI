import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  affiliateShareSlugError,
  directConnectOwnsShareSlug,
  isAffiliateShareSlugSyntaxValid,
  isDirectConnectShareToken,
} from "../utils/shareRouteNamespace";

describe("/r share-route namespace", () => {
  it("recognizes the 32-hex Direct Connect token namespace", () => {
    expect(isDirectConnectShareToken("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isDirectConnectShareToken("ABCDEF0123456789ABCDEF0123456789")).toBe(true);

    expect(isDirectConnectShareToken("0123456789abcdef0123456789abcde")).toBe(false);
    expect(isDirectConnectShareToken("g123456789abcdef0123456789abcdef")).toBe(false);
    expect(isDirectConnectShareToken(" 0123456789abcdef0123456789abcdef")).toBe(false);
  });

  it("keeps normal affiliate slugs valid while reserving Direct Connect-shaped values", () => {
    const directConnectToken = "0123456789abcdef0123456789abcdef";

    expect(isAffiliateShareSlugSyntaxValid("roofing-partners")).toBe(true);
    expect(isAffiliateShareSlugSyntaxValid(directConnectToken)).toBe(true);
    expect(isDirectConnectShareToken(directConnectToken)).toBe(true);
    expect(isAffiliateShareSlugSyntaxValid("bad_slug")).toBe(false);
    expect(affiliateShareSlugError("roofing-partners")).toBeNull();
    expect(affiliateShareSlugError(directConnectToken)).toBe(
      "slug format is reserved for Direct Connect"
    );
  });

  it("only consults Direct Connect ownership for 32-hex candidates", async () => {
    const lookup = vi.fn(async () => true);

    await expect(directConnectOwnsShareSlug("roofing-partners", lookup)).resolves.toBe(false);
    expect(lookup).not.toHaveBeenCalled();

    const token = "0123456789abcdef0123456789abcdef";
    await expect(directConnectOwnsShareSlug(token, lookup)).resolves.toBe(true);
    expect(lookup).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledWith(token);
  });

  it("defers a matching Direct Connect token before querying affiliate links", () => {
    const routesSource = fs.readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
    const routeStart = routesSource.indexOf('app.get("/r/:slug"');
    const routeSource = routesSource.slice(routeStart, routeStart + 3_000);
    const ownershipCheck = routeSource.indexOf("directConnectOwnsPersistedShareSlug");
    const directConnectDefer = routeSource.indexOf(
      "if (await directConnectOwnsPersistedShareSlug(slug)) return next()"
    );
    const affiliateLookup = routeSource.indexOf(".from(affiliateShareLinks)");

    expect(routeStart).toBeGreaterThan(-1);
    expect(ownershipCheck).toBeGreaterThan(-1);
    expect(directConnectDefer).toBeGreaterThan(-1);
    expect(affiliateLookup).toBeGreaterThan(directConnectDefer);
  });

  it("blocks new affiliate token-shaped slugs and avoids legacy collisions during allocation", () => {
    const routesSource = fs.readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
    const directConnectSource = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/direct-connect.ts"),
      "utf8"
    );
    const createStart = routesSource.indexOf('app.post("/api/affiliate/share-links"');
    const createSource = routesSource.slice(createStart, createStart + 4_000);
    const allocatorStart = directConnectSource.indexOf("const ensureShareTokenForRequest");
    const allocatorSource = directConnectSource.slice(allocatorStart, allocatorStart + 2_000);
    const collisionLookup = allocatorSource.indexOf(".from(affiliateShareLinks)");
    const assignment = allocatorSource.indexOf(".update(workRequests)");

    expect(createStart).toBeGreaterThan(-1);
    expect(createSource).toContain("affiliateShareSlugError(safeSlug)");
    expect(allocatorStart).toBeGreaterThan(-1);
    expect(collisionLookup).toBeGreaterThan(-1);
    expect(assignment).toBeGreaterThan(collisionLookup);
  });
});
