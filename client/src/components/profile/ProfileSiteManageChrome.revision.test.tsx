// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/queryClient";
import ProfileSiteManageChrome from "./ProfileSiteManageChrome";

const api = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: api };
});
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const id = "synthetic-profile";
const blocks = (about: string, heroText = "Saved hero") => [
  { type: "hero", data: { title: "Saved title", text: heroText } },
  { type: "about", data: { body: about } },
];
const snapshot = (revision: number, about: string, heroText = "Saved hero") => ({
  id,
  ownerUserId: "owner-1",
  businessId: "business-1",
  roleContext: "business_owner",
  slug: "synthetic-shop",
  status: "published" as const,
  publiclyReleased: true,
  seoMeta: { customDomain: " SHOP.EXAMPLE.TEST " },
  displayName: "Synthetic shop",
  headline: "Saved headline",
  contentBlocks: blocks(about, heroText),
  contentBlocksRevision: revision,
  siteTemplate: "default" as const,
});

let container: HTMLDivElement;
let root: Root;
const onSaved = vi.fn();
const props = {
  profileId: id,
  profileSlug: "synthetic-shop",
  displayName: "Public cached shop",
  headline: "Public cached headline",
  contentBlocks: blocks("Public cached About"),
  siteTemplate: "default" as const,
  editMode: true,
  onSaved,
  onToggleEdit: vi.fn(),
};

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === label
  );
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

async function click(label: string) {
  await act(async () => button(label).click());
}

async function changeHeroText(value: string) {
  const field = container.querySelector<HTMLTextAreaElement>('[data-testid="profile-manage-hero-text"]');
  if (!field) throw new Error("Missing hero text field");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("profile manage whole-page revision", () => {
  it("pairs a private snapshot with its revision, preserves a draft on conflict, and retries only after review", async () => {
    let finishInitial!: (value: unknown) => void;
    let finishReview!: (value: unknown) => void;
    const initial = new Promise((resolve) => { finishInitial = resolve; });
    const review = new Promise((resolve) => { finishReview = resolve; });
    let getCount = 0;
    let putCount = 0;
    api.mockImplementation((method: string, path: string, payload?: Record<string, unknown>) => {
      if (method === "GET" && path === `/api/profiles/${id}`) return ++getCount === 1 ? initial : review;
      if (method === "PUT" && path === `/api/profiles/${id}`) {
        putCount += 1;
        if (putCount === 1) {
          throw new ApiError("Changed", { status: 409, code: "PROFILE_CONTENT_BLOCKS_STALE" });
        }
        return snapshot(5, "Private current About", "My unsaved hero");
      }
      throw new Error(`Unexpected request: ${method} ${path} ${JSON.stringify(payload)}`);
    });

    await act(async () => root.render(<ProfileSiteManageChrome {...props} />));
    expect(container.querySelector('[data-testid="profile-manage-save-inline"]')).toBeNull();
    expect(button("Change template").disabled).toBe(true);
    await act(async () => finishInitial(snapshot(3, "Private current About")));
    expect(container.querySelector<HTMLTextAreaElement>('[data-testid="profile-manage-hero-text"]')?.value)
      .toBe("Saved hero");

    await changeHeroText("My unsaved hero");
    await click("Save changes");
    const firstPut = api.mock.calls.find((call) => call[0] === "PUT");
    expect(firstPut?.[2].expectedContentBlocksRevision).toBe(3);
    expect(firstPut?.[2].expectedProfileIdentity).toEqual({
      ownerUserId: "owner-1", businessId: "business-1", roleContext: "business_owner",
      slug: "synthetic-shop", status: "published", publiclyReleased: true,
      customDomain: "shop.example.test",
    });
    expect(firstPut?.[2]).not.toHaveProperty("displayName");
    expect(firstPut?.[2]).not.toHaveProperty("headline");
    expect(firstPut?.[2].contentBlocks).toContainEqual({
      type: "about", data: { body: "Private current About" },
    });
    expect(container.querySelector<HTMLTextAreaElement>('[data-testid="profile-manage-hero-text"]')?.value)
      .toBe("My unsaved hero");
    expect(container.textContent).toContain("background update may have changed it");
    expect(container.textContent).not.toContain("Retry saving my draft");
    expect(api.mock.calls.filter((call) => call[0] === "PUT")).toHaveLength(1);

    await click("Review current saved version");
    expect(container.querySelector<HTMLTextAreaElement>('[data-testid="profile-manage-hero-text"]')?.value)
      .toBe("My unsaved hero");
    expect(api.mock.calls.filter((call) => call[0] === "PUT")).toHaveLength(1);
    await act(async () => finishReview({
      ...snapshot(4, "System updated About"),
      displayName: "Another writer's name",
      headline: "Another writer's headline",
    }));
    expect(container.textContent).toContain("System updated About");
    expect(container.textContent).toContain("Private current About");
    expect(container.textContent).toContain("Current saved version");
    expect(container.textContent).toContain("Your unsaved draft");
    await click("Retry saving my draft");
    const puts = api.mock.calls.filter((call) => call[0] === "PUT");
    expect(puts).toHaveLength(2);
    expect(puts[1][2].expectedContentBlocksRevision).toBe(4);
    expect(puts[1][2].expectedProfileIdentity).toEqual(puts[0][2].expectedProfileIdentity);
    expect(puts[1][2].contentBlocks).toEqual(puts[0][2].contentBlocks);
    expect(puts[1][2]).not.toHaveProperty("displayName");
    expect(puts[1][2]).not.toHaveProperty("headline");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft and prevents retry when the profile target changed", async () => {
    let reads = 0;
    api.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === `/api/profiles/${id}`) return ++reads === 1
        ? snapshot(3, "Saved About")
        : { ...snapshot(3, "Saved About"), businessId: "business-2" };
      if (method === "PUT" && path === `/api/profiles/${id}`)
        throw new ApiError("Target changed", { status: 409, code: "PROFILE_TARGET_CHANGED" });
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await act(async () => root.render(<ProfileSiteManageChrome {...props} />));
    await changeHeroText("My unsaved hero");
    await click("Save changes");
    expect(container.textContent).toContain("owner, business, role, address, or public status changed");
    expect(container.textContent).not.toContain("Retry saving my draft");
    await click("Review current saved version");
    expect(container.textContent).toContain("My unsaved hero");
    expect(container.textContent).toContain("cannot be retried against a changed profile target");
    expect(api.mock.calls.filter((call) => call[0] === "PUT")).toHaveLength(1);
  });

  it("sends an explicit headline clear without resending the unchanged name", async () => {
    api.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === `/api/profiles/${id}`) return snapshot(3, "Saved About");
      if (method === "PUT" && path === `/api/profiles/${id}`) return { ...snapshot(4, "Saved About"), headline: null };
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await act(async () => root.render(<ProfileSiteManageChrome {...props} />));
    const headline = [...container.querySelectorAll<HTMLInputElement>("input")].find(
      (field) => field.value === "Saved headline"
    );
    if (!headline) throw new Error("Missing headline input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(headline, "");
      headline.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("Save changes");
    const payload = api.mock.calls.find((call) => call[0] === "PUT")?.[2];
    expect(payload.headline).toBeNull();
    expect(payload).not.toHaveProperty("displayName");
  });

  it("uses the private snapshot template when the public template is stale", async () => {
    const privateBlocks = [
      { type: "siteTemplate", data: { id: "wholesaler" } },
      ...blocks("Private About"),
    ];
    api.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === `/api/profiles/${id}`) return {
        ...snapshot(3, "Private About"), contentBlocks: privateBlocks, siteTemplate: "wholesaler",
      };
      if (method === "PUT" && path === `/api/profiles/${id}`) return {
        ...snapshot(4, "Private About"), contentBlocks: privateBlocks, siteTemplate: "wholesaler",
      };
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await act(async () => root.render(<ProfileSiteManageChrome {...props} />));
    expect(container.textContent).toContain("Featured inventory slugs");
    await click("Save changes");
    const payload = api.mock.calls.find((call) => call[0] === "PUT")?.[2];
    expect(payload.contentBlocks).toContainEqual({
      type: "inventoryCatalog", data: { categories: [], featuredStoneSlugs: [] },
    });
    expect(payload.expectedContentBlocksRevision).toBe(3);
  });

  it("blocks whole-array actions when the private revision load fails", async () => {
    api.mockRejectedValue(new ApiError("Unavailable", { status: 503 }));
    await act(async () => root.render(<ProfileSiteManageChrome {...props} />));
    expect(container.textContent).toContain("Editing is unavailable until it loads");
    expect(container.querySelector('[data-testid="profile-manage-save-inline"]')).toBeNull();
    expect(button("Change template").disabled).toBe(true);
    expect(api.mock.calls.filter((call) => call[0] === "PUT")).toHaveLength(0);
  });
});
