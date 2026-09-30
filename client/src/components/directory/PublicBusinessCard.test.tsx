// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toPublicBusinessCardDetails, type PublicDirectoryBusiness } from "@shared/publicBusinessCard";

const share = vi.hoisted(() => vi.fn(async (_payload: unknown) => undefined));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));
vi.mock("@/utils/share", () => ({ share, inferShareKind: () => "profile" }));
import { PublicBusinessCard } from "./PublicBusinessCard";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
const business: PublicDirectoryBusiness = {
  id: "business-1", name: "Test Plumbing", slug: "test-plumbing", claimStatus: "claimed",
  counties: [{ fips: "22033", stateCode: "LA", name: "East Baton Rouge Parish" }],
  card: toPublicBusinessCardDetails({
    tagline: "Repairs and renovations", description: "A detailed business description. ".repeat(12),
    category: "Plumbing", services: ["Drain cleaning", "Water heaters", "Leak repair", "Fixtures", "Repiping"],
    city: "Baton Rouge", stateCode: "LA", importExtras: { average_rating: 4.8, review_count: 26 },
  }),
  profilePreview: {
    businessId: "business-1", profileSlug: "test-profile", headline: "Published service headline",
    logoUrl: "/images/test/logo.svg", coverImageUrl: "/images/test/cover.webp",
    gallery: [{ imageUrl: "/images/test/project.webp", title: "Completed installation", path: "/u/test-profile/gallery/installation" }],
  },
};
async function render(value = business) {
  await act(async () => { root.render(<PublicBusinessCard business={value} />); });
}
beforeEach(() => {
  share.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("public business card React interactions", () => {
  it("renders actual saved facts and available public media", async () => {
    await render();
    expect(container.querySelector("h3")?.textContent).toBe("Test Plumbing");
    expect(container.textContent).toContain("Baton Rouge, LA");
    expect(container.textContent).toContain("Water heaters");
    expect(container.querySelectorAll("img")).toHaveLength(3);
    expect(container.querySelector('a[href="/u/test-profile/gallery/installation"]')).not.toBeNull();
    expect(container.textContent).not.toContain("22033");
  });
  it("opens additional details using native accessible disclosure", async () => {
    await render();
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    await act(async () => { container.querySelector("summary")!.click(); });
    expect(details.open).toBe(true);
    expect(details.textContent).toContain("Repiping");
  });
  it("uses the real ShareButton and preserves the exact business destination", async () => {
    await render();
    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Share"]')!;
    await act(async () => { button.click(); });
    expect(share).toHaveBeenCalledOnce();
    const payload = share.mock.calls[0][0] as { url: string; title: string };
    expect(new URL(payload.url).pathname).toBe("/business/test-plumbing");
    expect(payload.title).toBe("Test Plumbing");
    expect(button.disabled).toBe(false);
  });
  it("keeps review evidence separate from claim status and verification", async () => {
    await render();
    expect(container.textContent).toContain("26 reviews");
    expect(container.textContent).toContain("Imported review rating");
    expect(container.textContent).toContain("Claimed listing");
    expect(container.textContent).not.toContain("Professional Verified");
  });
  it("suppresses another business's preview immediately on render", async () => {
    await render({ ...business, id: "business-2" });
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelector('a[href^="/u/"]')).toBeNull();
  });
  it("rejects signed/private media and off-profile gallery destinations", async () => {
    await render({ ...business, profilePreview: {
      ...business.profilePreview!, logoUrl: "/api/private/logo.svg", coverImageUrl: "/images/test/cover.webp?token=private",
      gallery: [{ imageUrl: "/images/test/project.webp", title: "Wrong target", path: "/u/other-profile/gallery/photo" }],
    } });
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.textContent).not.toContain("Profile photos");
  });
  it("hides broken images without removing the business details or profile action", async () => {
    await render();
    const logo = container.querySelector<HTMLImageElement>('img[alt="Test Plumbing logo"]')!;
    await act(async () => { logo.dispatchEvent(new Event("error")); });
    expect(logo.hidden).toBe(true);
    expect(container.querySelector('a[aria-label="View business: Test Plumbing"]')?.getAttribute("href")).toBe("/business/test-plumbing");
    expect(container.textContent).toContain("Drain cleaning");
  });
  it("replaces a failed image when a different public image is supplied", async () => {
    await render();
    const image = container.querySelector<HTMLImageElement>('img[alt="Test Plumbing profile photo"]')!;
    await act(async () => { image.dispatchEvent(new Event("error")); });
    await render({ ...business, profilePreview: { ...business.profilePreview!, coverImageUrl: "/images/test/new-cover.webp" } });
    expect(container.querySelector<HTMLImageElement>('img[src="/images/test/new-cover.webp"]')?.hidden).toBe(false);
  });
  it("keeps sparse cards honest and still navigable", async () => {
    await render({ id: "empty", name: "Sparse Business", slug: "sparse" });
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelector("details")).toBeNull();
    expect(container.textContent).not.toMatch(/Photo coming soon|No reviews|Open now|Claimed listing|Unclaimed listing/);
    expect(container.querySelector('a[aria-label="View business: Sparse Business"]')).not.toBeNull();
  });
  it("falls back to the published headline without changing saved card content", async () => {
    await render({ ...business, card: { ...business.card!, tagline: "" } });
    expect(container.textContent).toContain("Published service headline");
    expect(business.card?.tagline).toBe("Repairs and renovations");
  });
});
