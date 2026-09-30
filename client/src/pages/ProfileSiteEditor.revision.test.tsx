// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/queryClient";
import ProfileSiteEditor from "./ProfileSiteEditor";

const api = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
const authUser = vi.hoisted(() => ({ id: "owner-1", preferences: {} }));
vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: api };
});
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock("wouter", () => ({
  useRoute: (pattern: string) => pattern === "/u/:slug/edit"
    ? [true, { slug: "synthetic-shop" }]
    : [false, null],
  useLocation: () => ["/u/synthetic-shop/edit", vi.fn()],
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/state-county-selector", () => ({ StateCountySelector: () => null }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const id = "synthetic-profile";
const blocks = (about: string) => [
  { type: "hero", data: { title: "Owner title", text: "Owner hero" } },
  { type: "about", data: { body: about } },
];
const detail = (revision: number, about: string, overrides: Record<string, unknown> = {}) => ({
  id,
  ownerUserId: "owner-1",
  businessId: null,
  slug: "synthetic-shop",
  displayName: "Synthetic shop",
  roleContext: "business_owner",
  status: "draft",
  publiclyReleased: false,
  headline: "Owner headline",
  contentBlocks: blocks(about),
  contentBlocksRevision: revision,
  ctaConfig: {},
  seoMeta: {},
  ...overrides,
});

let container: HTMLDivElement;
let root: Root;

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

async function changeContentBlocks(value: string) {
  const label = [...container.querySelectorAll<HTMLLabelElement>("label")].find(
    (item) => item.textContent?.trim() === "Content blocks (JSON)"
  );
  const field = label?.parentElement?.querySelector<HTMLTextAreaElement>("textarea");
  if (!field) throw new Error("Missing content blocks field");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function changeJsonField(labelText: string, value: string) {
  const label = [...container.querySelectorAll<HTMLLabelElement>("label")].find(
    (item) => item.textContent?.trim() === labelText
  );
  const field = label?.parentElement?.querySelector<HTMLTextAreaElement>("textarea");
  if (!field) throw new Error(`Missing ${labelText} field`);
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

describe("full profile editor whole-page revision", () => {
  it("keeps the About draft on conflict and retries only after an explicit latest-version review", async () => {
    let detailReads = 0;
    let putCount = 0;
    api.mockImplementation((method: string, path: string) => {
      if (method === "GET" && path === "/api/profiles") return [detail(3, "Owner saved About")];
      if (method === "GET" && path === `/api/profiles/${id}`) {
        return ++detailReads === 1 ? detail(3, "Owner saved About") : detail(4, "System updated About", {
          displayName: "Another writer's name",
          headline: "Another writer's headline",
          seoMeta: { title: "Another writer's title" },
        });
      }
      if (method === "PUT" && path === `/api/profiles/${id}`) {
        putCount += 1;
        if (putCount === 1) {
          throw new ApiError("Changed", { status: 409, code: "PROFILE_CONTENT_BLOCKS_STALE" });
        }
        return detail(5, "My unsaved About");
      }
      if (method === "GET") return {};
      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    await act(async () => root.render(<ProfileSiteEditor />));
    await click("Show");
    await changeContentBlocks(JSON.stringify(blocks("My unsaved About"), null, 2));
    await click("Save");
    const firstPut = api.mock.calls.find((call) => call[0] === "PUT");
    expect(firstPut?.[2].expectedContentBlocksRevision).toBe(3);
    expect(firstPut?.[2].expectedProfileIdentity).toEqual({
      ownerUserId: "owner-1", businessId: null, roleContext: "business_owner",
      slug: "synthetic-shop", status: "draft", publiclyReleased: false, customDomain: "",
    });
    for (const field of ["displayName", "headline", "ctaConfig", "seoMeta", "ctaConfigPatch", "seoMetaPatch"]) {
      expect(firstPut?.[2]).not.toHaveProperty(field);
    }
    expect(firstPut?.[2].contentBlocks).toContainEqual({
      type: "about", data: { body: "My unsaved About" },
    });
    expect(container.querySelector('[data-testid="profile-editor-content-conflict"]')).not.toBeNull();
    expect(container.textContent).toContain("My unsaved About");
    expect(container.textContent).toContain("background update may have changed it");
    expect(container.textContent).toContain("Discard my draft and reload");
    expect(container.textContent).not.toContain("Retry saving my draft");
    expect(api.mock.calls.filter((call) => call[0] === "PUT")).toHaveLength(1);

    await click("Review current saved version");
    expect(container.textContent).toContain("System updated About");
    expect(container.textContent).toContain("My unsaved About");
    expect(container.textContent).toContain("Current saved version");
    expect(container.textContent).toContain("Your unsaved draft");
    expect(api.mock.calls.filter((call) => call[0] === "PUT")).toHaveLength(1);
    await click("Retry saving my draft");
    const puts = api.mock.calls.filter((call) => call[0] === "PUT");
    expect(puts).toHaveLength(2);
    expect(puts[1][2].expectedContentBlocksRevision).toBe(4);
    expect(puts[1][2].expectedProfileIdentity).toEqual(puts[0][2].expectedProfileIdentity);
    expect(puts[1][2].contentBlocks).toEqual(puts[0][2].contentBlocks);
    for (const field of ["displayName", "headline", "ctaConfig", "seoMeta", "ctaConfigPatch", "seoMetaPatch"]) {
      expect(puts[1][2]).not.toHaveProperty(field);
    }
  });

  it("holds the draft without retry when the profile target changes", async () => {
    let reads = 0;
    api.mockImplementation((method: string, path: string) => {
      if (method === "GET" && path === "/api/profiles") return [detail(3, "Saved About")];
      if (method === "GET" && path === `/api/profiles/${id}`) return ++reads === 1
        ? detail(3, "Saved About")
        : detail(3, "Saved About", { businessId: "other-business" });
      if (method === "PUT" && path === `/api/profiles/${id}`)
        throw new ApiError("Target changed", { status: 409, code: "PROFILE_TARGET_CHANGED" });
      if (method === "GET") return {};
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await act(async () => root.render(<ProfileSiteEditor />));
    await click("Show");
    await changeContentBlocks(JSON.stringify(blocks("My unsaved About"), null, 2));
    await click("Save");
    expect(container.textContent).toContain("owner, business, role, address, or public status changed");
    expect(container.textContent).toContain("My unsaved About");
    await click("Review current saved version");
    expect(container.textContent).toContain("cannot be retried against a changed profile target");
    expect(container.textContent).not.toContain("Retry saving my draft");
    expect(api.mock.calls.filter((call) => call[0] === "PUT" && call[1] === `/api/profiles/${id}`)).toHaveLength(1);
  });

  it("refreshes publication identity from an authorized same-page publish response", async () => {
    const initial = detail(3, "Saved About");
    const published = detail(4, "Saved About", { status: "published", publiclyReleased: true });
    api.mockImplementation((method: string, path: string) => {
      if (method === "GET" && path === "/api/profiles") return [initial];
      if (method === "GET" && path === `/api/profiles/${id}`) return initial;
      if (method === "PUT" && path === `/api/profiles/${id}/publish`) return published;
      if (method === "PUT" && path === `/api/profiles/${id}`) return detail(4, "Saved About", {
        status: "published", publiclyReleased: true,
      });
      if (method === "GET") return {};
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await act(async () => root.render(<ProfileSiteEditor />));
    await click("Publish");
    await click("Save");
    const payload = api.mock.calls.find((call) => call[0] === "PUT" && call[1] === `/api/profiles/${id}`)?.[2];
    expect(payload.expectedProfileIdentity.status).toBe("published");
    expect(payload.expectedProfileIdentity.publiclyReleased).toBe(true);
    expect(payload.expectedContentBlocksRevision).toBe(3);
    expect(container.querySelector('a[href="/presence/review?section=facts"]')?.textContent).toBe("Review imported business details");
  });

  it("refreshes visibility identity with a private read before the next page save", async () => {
    const initial = detail(3, "Saved About");
    const visible = detail(4, "Saved About", { status: "published", publiclyReleased: true });
    let privateReads = 0;
    api.mockImplementation((method: string, path: string) => {
      if (method === "GET" && path === "/api/profiles") return [initial];
      if (method === "GET" && path === `/api/profiles/${id}`) return ++privateReads === 1 ? initial : visible;
      if (method === "PATCH" && path === "/api/users/profile-visibility") return { profileStatus: "published" };
      if (method === "PUT" && path === `/api/profiles/${id}`) return detail(4, "Saved About", {
        status: "published", publiclyReleased: true,
      });
      if (method === "GET") return {};
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await act(async () => root.render(<ProfileSiteEditor />));
    await click("Make link public");
    await click("Save");
    const payload = api.mock.calls.find((call) => call[0] === "PUT" && call[1] === `/api/profiles/${id}`)?.[2];
    expect(privateReads).toBe(2);
    expect(payload.expectedProfileIdentity.status).toBe("published");
    expect(payload.expectedProfileIdentity.publiclyReleased).toBe(true);
    expect(payload.expectedContentBlocksRevision).toBe(3);
  });

  it.each(["publish", "unpublish"] as const)(
    "does not bless stale content after %s returns a concurrent first About", async (action) => {
      const initial = detail(3, "Original owner text", {
        status: action === "publish" ? "draft" : "published",
        publiclyReleased: action !== "publish",
      });
      // Another writer inserted the imported About at revision 4; changing
      // publication status advances the canonical revision to 5.
      const changed = detail(5, "New approved imported About", {
        status: action === "publish" ? "published" : "draft",
        publiclyReleased: action === "publish",
      });
      let reads = 0;
      api.mockImplementation((method: string, path: string) => {
        if (method === "GET" && path === "/api/profiles") return [initial];
        if (method === "GET" && path === `/api/profiles/${id}`) return ++reads === 1 ? initial : changed;
        if (method === "PUT" && path === `/api/profiles/${id}/${action}`) return changed;
        if (method === "PUT" && path === `/api/profiles/${id}`)
          throw new ApiError("Current About changed", { status: 409, code: "PROFILE_CONTENT_BLOCKS_STALE" });
        if (method === "GET") return {};
        throw new Error(`Unexpected request: ${method} ${path}`);
      });
      await act(async () => root.render(<ProfileSiteEditor />));
      await click("Show");
      await changeContentBlocks(JSON.stringify(blocks("My unsaved draft"), null, 2));
      await click(action === "publish" ? "Publish" : "Unpublish");
      await click("Save");
      const puts = api.mock.calls.filter((call) => call[0] === "PUT" && call[1] === `/api/profiles/${id}`);
      expect(puts).toHaveLength(1);
      expect(puts[0][2].expectedContentBlocksRevision).toBe(3);
      expect(puts[0][2].contentBlocks).toContainEqual({ type: "about", data: { body: "My unsaved draft" } });
      expect(container.querySelector('[data-testid="profile-editor-content-conflict"]')).not.toBeNull();
      expect(container.textContent).toContain("My unsaved draft");
      expect(container.textContent).not.toContain("Retry saving my draft");
      await click("Review current saved version");
      expect(container.textContent).toContain("New approved imported About");
      expect(container.textContent).toContain("My unsaved draft");
      expect(api.mock.calls.filter((call) => call[0] === "PUT" && call[1] === `/api/profiles/${id}`)).toHaveLength(1);
    }
  );

  it("sends only the edited nested CTA and SEO keys, including a deliberate key removal", async () => {
    const primary = { label: "Call", kind: "link", value: "https://example.test/call" };
    const secondary = { label: "Mail", kind: "link", value: "https://example.test/mail" };
    const initial = detail(7, "Saved About", {
      ctaConfig: { primary, secondary },
      seoMeta: { title: "Old title", description: "Keep this description" },
    });
    api.mockImplementation((method: string, path: string) => {
      if (method === "GET" && path === "/api/profiles") return [initial];
      if (method === "GET" && path === `/api/profiles/${id}`) return initial;
      if (method === "PUT" && path === `/api/profiles/${id}`) return detail(8, "Saved About", {
        ctaConfig: { secondary },
        seoMeta: { title: "New title", description: "Keep this description" },
      });
      if (method === "GET") return {};
      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    await act(async () => root.render(<ProfileSiteEditor />));
    await click("Show");
    await changeJsonField("CTA config (JSON)", JSON.stringify({ secondary }, null, 2));
    await changeJsonField("SEO meta (JSON)", JSON.stringify({ title: "New title", description: "Keep this description" }, null, 2));
    await click("Save");
    const payload = api.mock.calls.find((call) => call[0] === "PUT")?.[2];
    expect(payload.expectedContentBlocksRevision).toBe(7);
    expect(payload.ctaConfigPatch).toEqual({ primary: null });
    expect(payload.seoMetaPatch).toEqual({ title: "New title" });
    expect(payload).not.toHaveProperty("ctaConfig");
    expect(payload).not.toHaveProperty("seoMeta");
    expect(payload).not.toHaveProperty("displayName");
    expect(payload).not.toHaveProperty("headline");
  });
});
