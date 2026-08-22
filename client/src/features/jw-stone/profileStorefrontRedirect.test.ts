import { describe, expect, it } from "vitest";
import { resolveJwStonePublicStorefrontRedirect } from "./profileStorefrontRedirect";

describe("resolveJwStonePublicStorefrontRedirect", () => {
  it("sends the public profile storefront to the marketplace", () => {
    expect(resolveJwStonePublicStorefrontRedirect("/u/jw-stone")).toBe("/jw-stone");
    expect(resolveJwStonePublicStorefrontRedirect("/p/jw-stone")).toBe("/jw-stone");
    expect(resolveJwStonePublicStorefrontRedirect("/u/jw-stone/")).toBe("/jw-stone");
  });

  it("preserves stone and material deep links on the marketplace", () => {
    expect(resolveJwStonePublicStorefrontRedirect("/u/jw-stone/stones/cristallo")).toBe(
      "/jw-stone/stones/cristallo"
    );
    expect(resolveJwStonePublicStorefrontRedirect("/u/jw-stone/stones/cristallo?photo=2")).toBe(
      "/jw-stone/stones/cristallo?photo=2"
    );
    expect(resolveJwStonePublicStorefrontRedirect("/u/jw-stone/materials/granite")).toBe(
      "/jw-stone/materials/granite"
    );
  });

  it("upgrades legacy query selectors onto marketplace paths", () => {
    expect(resolveJwStonePublicStorefrontRedirect("/u/jw-stone?stone=blue-mare&photo=3")).toBe(
      "/jw-stone/stones/blue-mare?photo=3"
    );
    expect(resolveJwStonePublicStorefrontRedirect("/u/jw-stone?category=quartzite")).toBe(
      "/jw-stone/materials/quartzite"
    );
  });

  it("preserves profile-account continuation on the canonical marketplace", () => {
    expect(resolveJwStonePublicStorefrontRedirect("/u/jw-stone?profileAccount=1")).toBe(
      "/jw-stone?profileAccount=1"
    );
    expect(
      resolveJwStonePublicStorefrontRedirect(
        "/u/jw-stone?profileAccount=1&profileAccountMode=signin#account"
      )
    ).toBe("/jw-stone?profileAccount=1&profileAccountMode=signin#account");
  });

  it("leaves booking and admin edit on the profile surface", () => {
    expect(resolveJwStonePublicStorefrontRedirect("/u/jw-stone?book=1")).toBeNull();
    expect(resolveJwStonePublicStorefrontRedirect("/u/jw-stone/edit")).toBeNull();
  });

  it("ignores unrelated profiles", () => {
    expect(resolveJwStonePublicStorefrontRedirect("/u/issa-build")).toBeNull();
    expect(resolveJwStonePublicStorefrontRedirect("/jw-stone")).toBeNull();
  });
});
