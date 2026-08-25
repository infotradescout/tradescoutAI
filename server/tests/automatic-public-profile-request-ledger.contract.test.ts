import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("automatic public profile request-intent ledger", () => {
  it("observes the shared Direct Connect panel for every public profile theme", () => {
    const app = read("client/src/App.tsx");

    expect(app).toContain("public_profile_direct_connect_opened");
    expect(app).toContain("express_direct_connect_panel");
    expect(app).toContain(
      '[role=\"dialog\"][aria-labelledby=\"express-direct-connect-title\"]'
    );
    expect(app).toContain("new MutationObserver(scanForOpenDialog)");
    expect(app).toContain("if (!isPublicProfileRoute && !isCustomDomainProfileRoute) return;");
    expect(app).toContain('meta[name="tradescout-business-slug"]');
    expect(app).toContain("customDomainProfileSlug");
    expect(app).toContain("/^\\/(?:u|p|business|contractors|profile)\\/([^/]+)/");
    expect(app).toContain('profileSlug,');
    expect(app).toContain('deviceType: window.innerWidth < 768 ? "mobile" : "desktop"');
  });

  it("records one canonical open per mounted dialog instead of one event per mutation", () => {
    const app = read("client/src/App.tsx");

    expect(app).toContain("let activeDialog: Element | null = null;");
    expect(app).toContain("if (dialog === activeDialog) return;");
    expect(app).toContain("activeDialog = dialog;");
    expect(app).toContain("activeDialog = null;");
    expect(app).toContain("observer.disconnect()");
  });
});
