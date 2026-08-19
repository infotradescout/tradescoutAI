import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RED_GRANITI_MANAGED_CONTACT } from "@shared/redGranitiProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("R.E.D. Graniti working action contract", () => {
  it("wraps only the exact R.E.D. profile in the interaction boundary", () => {
    const wrapper = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");

    expect(wrapper).toContain(
      'import RedGranitiInteractionBoundary from "./RedGranitiInteractionBoundary"'
    );
    expect(wrapper).toContain("normalizedSlug === RED_GRANITI_PROFILE_SLUG");
    expect(wrapper).toContain(
      "<RedGranitiInteractionBoundary platformBaseHref={props.platformBaseHref}>"
    );
    expect(wrapper).toContain("</RedGranitiInteractionBoundary>");
    expect(wrapper.indexOf("<RedGranitiInteractionBoundary")).toBeGreaterThan(
      wrapper.indexOf("if (isRedGranitiProfile)")
    );
    expect(wrapper.indexOf("<RedGranitiInteractionBoundary")).toBeLessThan(
      wrapper.indexOf("return <LegacyWholesalerProfileTheme")
    );
  });

  it("recovers stale document interaction locks without breaking an open modal", () => {
    const boundary = read(
      "client/src/pages/profile-sites/RedGranitiInteractionBoundary.tsx"
    );

    expect(boundary).toContain("function hasOpenModal()");
    expect(boundary).toContain("if (hasOpenModal()) return;");
    expect(boundary).toContain('element.style.pointerEvents === "none"');
    expect(boundary).toContain('element.style.removeProperty("pointer-events")');
    expect(boundary).toContain('element.classList.remove("pointer-events-none")');
    expect(boundary).toContain('element.removeAttribute("inert")');
    expect(boundary).toContain(
      'root.style.setProperty("pointer-events", "auto", "important")'
    );
    expect(boundary).toContain(
      'root.querySelectorAll<HTMLElement>("a, button, input, select, textarea")'
    );
    expect(boundary).toContain("new MutationObserver(restore)");
    expect(boundary).toContain('root.addEventListener("pointerdown", restore, true)');
    expect(boundary).toContain('root.addEventListener("keydown", restore, true)');
  });

  it("keeps the protected panel first but supplies native Call and request fallbacks", () => {
    const boundary = read(
      "client/src/pages/profile-sites/RedGranitiInteractionBoundary.tsx"
    );

    expect(RED_GRANITI_MANAGED_CONTACT.tel).toBe("+18505430748");
    expect(boundary).toContain('href: `tel:${RED_GRANITI_MANAGED_CONTACT.tel}`');
    expect(boundary).toContain("buildRedGranitiRequestFallbackHref");
    expect(boundary).toContain('profile: JW_STONE_PROFILE_SLUG');
    expect(boundary).toContain('source: "red_graniti_profile"');
    expect(boundary).toContain('title: "R.E.D. Graniti first-cut request"');
    expect(boundary).toContain('intent: "request_material"');
    expect(boundary).toContain("R.E.D. material or stone need:");
    expect(boundary).toContain("Needed format — rough block, slab, or first cut:");
    expect(boundary).toContain("Quantity or dimensions:");
    expect(boundary).toContain("Delivery destination:");
    expect(boundary).toContain("Needed timing:");
    expect(boundary).toContain("Project details:");
    expect(boundary).toContain('root.addEventListener("click", handleClick, true)');
    expect(boundary).toContain(
      'document.getElementById("red-graniti-contact-title")'
    );
    expect(boundary).toContain("window.location.href = action.href");
    expect(boundary).toContain("window.location.assign(action.href)");
  });

  it("covers every R.E.D. call and quotation label rendered by the website recreation", () => {
    const boundary = read(
      "client/src/pages/profile-sites/RedGranitiInteractionBoundary.tsx"
    );
    const theme = read("client/src/pages/profile-sites/RedGranitiProfileTheme.tsx");

    expect(boundary).toContain('"red-graniti-primary-call"');
    expect(boundary).toContain('"red-graniti-mobile-call"');
    expect(boundary).toContain('"red-graniti-primary-request"');
    expect(boundary).toContain('"red-graniti-mobile-request"');
    expect(boundary).toContain('text.includes("START A REQUEST")');
    expect(boundary).toContain('text.includes("REQUEST A QUOTE")');
    expect(boundary).toContain('text.includes("GET A QUOTATION NOW")');

    expect(theme).toContain('data-testid="red-graniti-primary-call"');
    expect(theme).toContain('data-testid="red-graniti-primary-request"');
    expect(theme).toContain('data-testid="red-graniti-mobile-call"');
    expect(theme).toContain('data-testid="red-graniti-mobile-request"');
    expect(theme).toContain("REQUEST A QUOTE");
    expect(theme).toContain("Get a quotation now");
  });

  it("does not hardcode an account id or turn the fallback into another profile owner", () => {
    const boundary = read(
      "client/src/pages/profile-sites/RedGranitiInteractionBoundary.tsx"
    );

    expect(boundary).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
    );
    expect(boundary).not.toContain("ownerUserId");
    expect(boundary).not.toContain("activeBusinessId");
    expect(boundary).not.toContain("activeProfileId");
  });
});
