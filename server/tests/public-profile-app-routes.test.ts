import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appMocks = vi.hoisted(() => ({
  buildManifest: vi.fn(),
  resolveIdentity: vi.fn(),
  renderIcon: vi.fn(),
}));

vi.mock("../publicProfileApp", () => ({
  buildPublicProfileWebAppManifest: appMocks.buildManifest,
  resolvePublicProfileAppIdentity: appMocks.resolveIdentity,
}));

vi.mock("../socialPreviewCardRenderer", () => ({
  renderProfileAppIconPng: appMocks.renderIcon,
}));

import { registerPublicProfileAppRoutes } from "../routes/public-profile-app";

describe("public profile app routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appMocks.buildManifest.mockResolvedValue({
      id: "/profile-apps/jrs-auto-glass",
      name: "JR's Auto Glass",
      short_name: "JR's Auto Glass",
      start_url: "/u/jrs-auto-glass?entry=profile_app",
      scope: "/u/jrs-auto-glass",
      display: "standalone",
      orientation: "portrait",
      theme_color: "#d92727",
      background_color: "#07100c",
      icons: [],
      categories: ["business"],
      launch_handler: { client_mode: "focus-existing" },
    });
    appMocks.resolveIdentity.mockResolvedValue({
      slug: "jrs-auto-glass",
      displayName: "JR's Auto Glass",
      logoUrl: "/images/businesses/jrs-auto-glass/logo.webp",
      accentColor: "#d92727",
    });
    appMocks.renderIcon.mockResolvedValue(Buffer.from([137, 80, 78, 71]));
  });

  function createApp(mapped?: { slug: string; host: string }) {
    const app = express();
    if (mapped) {
      app.use((req, _res, next) => {
        Object.assign(req, {
          mappedProfileDomainSlug: mapped.slug,
          mappedProfileDomainHost: mapped.host,
        });
        next();
      });
    }
    registerPublicProfileAppRoutes(app);
    return app;
  }

  it("serves a profile manifest with the manifest content type", async () => {
    const response = await request(createApp())
      .get("/profile-manifests/jrs-auto-glass.webmanifest")
      .set("Host", "www.thetradescout.com")
      .expect(200);

    expect(response.headers["content-type"]).toContain("application/manifest+json");
    expect(response.headers.vary).toContain("Host");
    expect(response.body.name).toBe("JR's Auto Glass");
    expect(appMocks.buildManifest).toHaveBeenCalledWith({
      slug: "jrs-auto-glass",
      origin: "https://www.thetradescout.com",
    });
  });

  it("serves generated square profile icons", async () => {
    const response = await request(createApp())
      .get("/profile-app-icons/jrs-auto-glass/192.png")
      .set("Host", "www.thetradescout.com")
      .expect(200);

    expect(response.headers["content-type"]).toContain("image/png");
    expect(appMocks.renderIcon).toHaveBeenCalledWith(
      {
        brandName: "JR's Auto Glass",
        logoUrl: "/images/businesses/jrs-auto-glass/logo.webp",
        accentColor: "#d92727",
      },
      192
    );
  });

  it("rejects unsupported app-icon sizes and malformed manifests", async () => {
    await request(createApp())
      .get("/profile-app-icons/jrs-auto-glass/96.png")
      .set("Host", "www.thetradescout.com")
      .expect(404);
    await request(createApp())
      .get("/profile-manifests/jrs-auto-glass.json")
      .set("Host", "www.thetradescout.com")
      .expect(404);
  });

  it("serves only the mapped profile identity on a custom domain", async () => {
    await request(createApp({ slug: "jrs-auto-glass", host: "jrsautoglass.example" }))
      .get("/profile-manifests/jrs-auto-glass.webmanifest")
      .set("Host", "jrsautoglass.example")
      .expect(200);

    expect(appMocks.buildManifest).toHaveBeenLastCalledWith({
      slug: "jrs-auto-glass",
      origin: "https://jrsautoglass.example",
    });

    await request(createApp({ slug: "jrs-auto-glass", host: "jrsautoglass.example" }))
      .get("/profile-manifests/another-profile.webmanifest")
      .set("Host", "jrsautoglass.example")
      .expect(404);
  });
});
