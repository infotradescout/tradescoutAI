import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  JW_STONE_SAVED_STONES_EMAIL_PURPOSE,
  buildJwStoneSavedStonesEmail,
  sanitizeJwStoneSavedStoneEmailItems,
} from "../services/jwStoneSavedStonesEmail";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("JW Stone saved-stones email copy", () => {
  it("sanitizes named stones and drops synthetic/anonymous placeholders", () => {
    const items = sanitizeJwStoneSavedStoneEmailItems([
      { name: "Amazonic Green", shareSlug: "amazonic-green" },
      { name: "Trending Selection 3", shareSlug: "trending-selection-3" },
      { name: "  ", shareSlug: "blank" },
      { name: "Steel Gray", shareSlug: "steel-gray" },
      { name: "Steel Gray", shareSlug: "steel-gray" },
      { name: "Unnamed only", shareSlug: null },
    ]);

    expect(items).toEqual([
      { name: "Amazonic Green", shareSlug: "amazonic-green" },
      { name: "Steel Gray", shareSlug: "steel-gray" },
      { name: "Unnamed only", shareSlug: null },
    ]);
  });

  it("builds email content with names and optional marketplace stone links", () => {
    const content = buildJwStoneSavedStonesEmail({
      publicBaseUrl: "https://www.thetradescout.com",
      stones: [
        { name: "Amazonic Green", shareSlug: "amazonic-green" },
        { name: "Steel Gray", shareSlug: null },
      ],
    });

    expect(content.subject).toContain("2 saved stones");
    expect(content.html).toContain("Amazonic Green");
    expect(content.html).toContain("/jw-stone/stones/amazonic-green");
    expect(content.html).toContain("Steel Gray");
    expect(content.html).toContain("JW Stone is not notified");
    expect(content.text).toContain(
      "Amazonic Green: https://www.thetradescout.com/jw-stone/stones/amazonic-green"
    );
    expect(content.text).toContain("- Steel Gray");
    expect(content.html).not.toContain("Sheet Wish List");
  });

  it("registers a public JW route with an EMAIL_MODE allow-listed purpose", () => {
    const route = read("server/routes/jw-stone-saved-stones-email.ts");
    const service = read("server/services/jwStoneSavedStonesEmail.ts");
    const emailService = read("server/services/emailService.ts");
    const routesIndex = read("server/routes.ts");

    expect(route).toContain('"/api/jw-stone/saved-stones/email"');
    expect(route).toContain(`purpose: JW_STONE_SAVED_STONES_EMAIL_PURPOSE`);
    expect(route).not.toContain("notificationEmail");
    expect(route).not.toContain("notifySuperAdmins");
    expect(service).toContain("JW Stone is not notified");
    expect(emailService).toContain(`purpose === "${JW_STONE_SAVED_STONES_EMAIL_PURPOSE}"`);
    expect(routesIndex).toContain("registerJwStoneSavedStonesEmailRoutes(app)");
  });

  it("keeps WishlistPanel email UX on the customer copy path", () => {
    const panel = read("client/src/features/jw-stone/WishlistPanel.tsx");
    expect(panel).toContain("Email my saved stones");
    expect(panel).toContain("/api/jw-stone/saved-stones/email");
    expect(panel).toContain("shareSlug");
    expect(panel).not.toContain("Sheet Wish List");
    expect(panel).toContain("Email my saved stones");
  });
});
