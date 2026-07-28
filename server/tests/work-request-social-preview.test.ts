import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as any[],
  getTradeBySlug: vi.fn(),
  getCountyByFips: vi.fn(),
  renderSocialPreviewCard: vi.fn(),
}));

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mocks.rows,
        }),
      }),
    }),
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getTradeBySlug: mocks.getTradeBySlug,
    getCountyByFips: mocks.getCountyByFips,
  },
}));

vi.mock("../socialPreviewCardRenderer", () => ({
  renderSocialPreviewCard: mocks.renderSocialPreviewCard,
}));

import {
  buildWorkRequestShareHtml,
  buildWorkRequestSocialPreview,
} from "../workRequestShareHtml";

const TOKEN = "a".repeat(32);
const TEMPLATE = `<!doctype html><html><head>
  <title>TradeScout</title>
  <meta name="description" content="" />
  <meta property="og:title" content="" />
  <meta property="og:description" content="" />
  <meta property="og:image" content="/tradescout-social-preview.png" />
  <meta property="og:url" content="" />
  <meta name="twitter:title" content="" />
  <meta name="twitter:description" content="" />
  <meta name="twitter:image" content="" />
  <link rel="canonical" href="" />
</head><body></body></html>`;

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    source: "direct_connect",
    status: "open",
    shareToken: TOKEN,
    tradeId: "roofing",
    countyFips: "12033",
    stateCode: "FL",
    title: "Roof repair at 123 Provider Lane — @provider_team",
    description:
      "See https://provider.example or provider.example and call 850-555-1212 for access.",
    budgetMin: 2_000,
    budgetMax: 5_000,
    ...overrides,
  };
}

describe("work request social preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows = [requestRow()];
    mocks.getTradeBySlug.mockResolvedValue({ name: "Roofing" });
    mocks.getCountyByFips.mockResolvedValue({ name: "Escambia County" });
    mocks.renderSocialPreviewCard.mockResolvedValue({
      png: Buffer.from([1, 2, 3]),
      sourceImageRequested: false,
      sourceImageLoaded: false,
    });
  });

  it("rechecks the current request and renders only coarse, privacy-safe card context", async () => {
    const preview = await buildWorkRequestSocialPreview({
      shareToken: TOKEN,
      origin: "https://www.thetradescout.com",
    });

    expect(preview).not.toBeNull();
    expect(mocks.renderSocialPreviewCard).toHaveBeenCalledWith({
      kind: "offer",
      title: "Roofing project request",
      brandName: "TradeScout Direct Connect",
      eyebrow: "Roofing request",
      supportingText:
        "Shared through TradeScout. Project details stay private until access is granted.",
      locationLabel: "Escambia County, FL",
      ctaLabel: "Review request · Respond privately",
      sourceImageUrl: null,
      logoUrl: null,
      accentColor: "#f97316",
    });
    const serializedContext = JSON.stringify(preview?.context);
    expect(serializedContext).not.toContain("123 Provider Lane");
    expect(serializedContext).not.toContain("provider.example");
    expect(serializedContext).not.toContain("@provider_team");
    expect(serializedContext).not.toContain("$2,000");
  });

  it("fails closed after request revocation or closure", async () => {
    mocks.rows = [requestRow({ status: "closed" })];

    await expect(
      buildWorkRequestSocialPreview({
        shareToken: TOKEN,
        origin: "https://www.thetradescout.com",
      })
    ).resolves.toBeNull();
    expect(mocks.renderSocialPreviewCard).not.toHaveBeenCalled();
  });

  it("sanitizes an unresolved user-supplied trade identifier before public rendering", async () => {
    mocks.rows = [requestRow({ tradeId: "call 850-555-1212 or @provider_team" })];
    mocks.getTradeBySlug.mockResolvedValueOnce(null);

    const preview = await buildWorkRequestSocialPreview({
      shareToken: TOKEN,
      origin: "https://www.thetradescout.com",
    });

    const serializedContext = JSON.stringify(preview?.context);
    expect(serializedContext).not.toContain("850-555-1212");
    expect(serializedContext).not.toContain("@provider_team");
    expect(serializedContext).toContain("Continue through TradeScout");
  });

  it("rejects non-Direct-Connect and malformed tokens", async () => {
    mocks.rows = [requestRow({ source: "community" })];
    await expect(
      buildWorkRequestSocialPreview({
        shareToken: TOKEN,
        origin: "https://www.thetradescout.com",
      })
    ).resolves.toBeNull();
    await expect(
      buildWorkRequestSocialPreview({
        shareToken: "not-a-token",
        origin: "https://www.thetradescout.com",
      })
    ).resolves.toBeNull();
  });

  it("publishes an opaque card URL and noindex directives in shared-request HTML", async () => {
    const html = await buildWorkRequestShareHtml({
      shareToken: TOKEN,
      origin: "https://www.thetradescout.com",
      templateHtml: TEMPLATE,
    });

    expect(html).toContain(`/images/social/request/${TOKEN}.png`);
    expect(html).toContain('name="robots" content="noindex, nofollow, noarchive"');
    expect(html).toContain('name="googlebot" content="noindex, nofollow, noarchive"');
    const imagePath = html?.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || "";
    expect(imagePath).not.toContain("123 Provider Lane");
    expect(imagePath).not.toContain("provider.example");
  });
});
