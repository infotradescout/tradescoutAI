// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SellerStoneInventoryItem } from "@shared/stoneInventory";
import Manager from "./JwStoneCurrentInventoryManager";
import ManageChrome from "./ProfileSiteManageChrome";

const api = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", () => ({ apiRequest: api }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const id = `stone_${"a".repeat(32)}`;
const fixture: SellerStoneInventoryItem = {
  id,
  inventoryPositionId: "position-a",
  passportCode: "SYNTHETIC-A",
  sourceAssetRef: "fixture-only",
  materialSlug: "not-in-static-catalog",
  materialName: "Synthetic existing lot",
  materialClass: "natural_stone",
  materialFamily: "granite",
  assetKind: "bundle",
  quantity: 7,
  unit: "slabs",
  dimensions: { length: 3000, height: 1800, thickness: null, unit: "mm" },
  finishQuantities: [
    { finish: "Polished", slabCount: 3 },
    { finish: "Honed", slabCount: 2 },
  ],
  imageUrls: ["/synthetic/one.webp", "/synthetic/two.webp"],
  locationLabel: "Synthetic rack A",
  lastConfirmedAt: new Date().toISOString(),
  confirmationExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
  publicAvailabilityStatus: "not_published",
  isSaleReady: false,
};
let container: HTMLDivElement;
let root: Root;
let items: SellerStoneInventoryItem[];
let capabilities: { write: boolean; publish: boolean };
function button(text: string) {
  const found = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (el) => el.textContent?.trim() === text
  );
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}
async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
function input(label: string) {
  const wrapper = Array.from(container.querySelectorAll("label")).find(
    (el) => el.firstChild?.textContent?.trim() === label
  );
  const found = wrapper?.querySelector<HTMLInputElement | HTMLSelectElement>("input,select");
  if (!found) throw new Error(`Missing field ${label}`);
  return found;
}
async function change(label: string, value: string) {
  const el = input(label);
  await act(async () => {
    const proto =
      el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function renderManager() {
  await act(async () => root.render(<Manager open profileSlug="jw-stone" onClose={vi.fn()} />));
}
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  items = [structuredClone(fixture)];
  capabilities = { write: true, publish: true };
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  api.mockImplementation(async (method: string, url: string, payload: any) => {
    if (method === "GET" && url.endsWith("new-arrivals/manage"))
      return { profileSlug: "jw-stone", itemIds: [] };
    if (method === "GET") return { profileSlug: "jw-stone", items, capabilities };
    if (method === "DELETE") {
      items = [];
      return;
    }
    if (method === "POST") {
      items = items.map((item) => ({
        ...item,
        quantity: payload.quantity,
        lastConfirmedAt: payload.lastConfirmedAt,
      }));
      return { item: items[0] };
    }
    return {};
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("reachable physical stock manager", () => {
  it("opens lazily from JW manage controls and does not expose a stock control on another profile", async () => {
    const props = {
      profileId: "profile-fixture",
      profileSlug: "other-profile",
      displayName: "Synthetic profile",
      headline: null,
      contentBlocks: [],
      siteTemplate: "wholesaler" as const,
      editMode: false,
      onSaved: vi.fn(),
      onToggleEdit: vi.fn(),
    };
    await act(async () => root.render(<ManageChrome {...props} />));
    expect(container.textContent).not.toContain("Current Inventory");
    expect(api).not.toHaveBeenCalled();
    await act(async () => root.render(<ManageChrome {...props} profileSlug="jw-stone" />));
    expect(container.querySelector('[data-testid="jw-current-inventory-manager"]')).toBeNull();
    expect(api).not.toHaveBeenCalled();
    await click(button("Current Inventory"));
    await vi.waitFor(() =>
      expect(container.querySelector('[data-testid="jw-current-inventory-manager"]')).not.toBeNull()
    );
    expect(api).toHaveBeenCalledWith("GET", "/api/u/jw-stone/stone-inventory/manage");
    await click(button("Close inventory"));
    expect(container.querySelector('[data-testid="jw-current-inventory-manager"]')).toBeNull();
  });
  it("re-confirms the same lot without fabricating sizes, swapping material or losing photos and finish records", async () => {
    await renderManager();
    expect(input("Quantity").value).toBe("");
    expect(input("Location").value).toBe("");
    expect(input("Material").textContent).not.toMatch(/Trending Selection \d|First Cut/i);
    await click(button("Edit / re-confirm"));
    expect(input("Material").value).toBe(fixture.materialSlug);
    expect(input("Material").disabled).toBe(true);
    expect(input("Measurement unit").value).toBe("mm");
    expect(input("Thickness").value).toBe("");
    expect(input("Finish 2").value).toBe("Honed");
    await change("Quantity", "8");
    await click(button("Save and re-confirm this lot"));
    const post = api.mock.calls.find(([method]) => method === "POST")!;
    expect(post[1]).toBe("/api/u/jw-stone/stone-inventory/current");
    expect(post[2]).toMatchObject({
      publicId: id,
      materialSlug: fixture.materialSlug,
      materialName: fixture.materialName,
      materialClass: fixture.materialClass,
      materialFamily: fixture.materialFamily,
      quantity: 8,
      dimensions: fixture.dimensions,
      finishQuantities: fixture.finishQuantities,
      imageUrls: fixture.imageUrls,
      locationLabel: fixture.locationLabel,
    });
    expect(post[2]).not.toHaveProperty("businessId");
    expect(post[2]).not.toHaveProperty("saleReady");
    expect(api.mock.calls.filter(([method]) => method === "POST")).toHaveLength(1);
    expect(container.textContent).toContain("8 slabs");
    expect(container.textContent).toContain("Private draft");
  });
  it("keeps unknown dimensions blank on edit and requires an entered quantity for new stock", async () => {
    items = [{ ...fixture, materialFamily: null, dimensions: null, finishQuantities: [] }];
    await renderManager();
    await click(button("Confirm current stock"));
    expect(api.mock.calls.some(([method]) => method === "POST")).toBe(false);
    await click(button("Edit / re-confirm"));
    expect(input("Length").value).toBe("");
    expect(input("Measurement unit").value).toBe("");
    await click(button("Save and re-confirm this lot"));
    expect(api.mock.calls.find(([method]) => method === "POST")?.[2].dimensions).toEqual({
      length: null,
      height: null,
      thickness: null,
      unit: null,
    });
    expect(api.mock.calls.find(([method]) => method === "POST")?.[2].materialFamily).toBe(
      "unconfirmed"
    );
  });
  it.each([
    { write: false, publish: false },
    { write: true, publish: false },
    { write: false, publish: true },
  ])("keeps independent server capabilities truthful: %j", async (caps) => {
    capabilities = caps;
    await renderManager();
    expect(container.textContent?.includes("Edit / re-confirm")).toBe(caps.write);
    expect(container.textContent?.includes("Confirm current stock")).toBe(caps.write);
    expect(container.textContent?.includes("Retire")).toBe(caps.write);
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === "Publish sale-ready"
      )
    ).toBe(caps.publish);
    expect(api.mock.calls.every(([method]) => method === "GET")).toBe(true);
  });
  it("treats missing capabilities and failed/foreign responses as unavailable for writes", async () => {
    api.mockResolvedValue({
      profileSlug: "foreign",
      items,
      capabilities: { write: true, publish: true },
      itemIds: [],
    });
    await renderManager();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain(fixture.materialName);
    expect(container.querySelector("fieldset")).toBeNull();
    api.mockImplementation(async () => ({ profileSlug: "jw-stone", items, itemIds: [] }));
    await click(button("Retry inventory"));
    expect(container.textContent).toContain("read-only");
    expect(container.querySelector("fieldset")).toBeNull();
  });
  it("keeps a rejected edit in place for correction without creating a replacement lot", async () => {
    await renderManager();
    await click(button("Edit / re-confirm"));
    api.mockImplementation(async (method) => {
      if (method === "POST")
        throw new Error("Reserved inventory cannot be edited until its hold is released");
      return {};
    });
    await click(button("Save and re-confirm this lot"));
    expect(input("Quantity").value).toBe("7");
    expect(container.textContent).toContain("Edit and re-confirm SYNTHETIC-A");
    expect(api.mock.calls.filter(([method]) => method === "POST")).toHaveLength(1);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Could not confirm stock", variant: "destructive" })
    );
  });
  it("retires only the selected publicId after confirmation and reloads the list", async () => {
    await renderManager();
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await click(button("Retire"));
    expect(api.mock.calls.some(([method]) => method === "DELETE")).toBe(false);
    await click(button("Retire"));
    expect(api).toHaveBeenCalledWith("DELETE", `/api/u/jw-stone/stone-inventory/current/${id}`);
    expect(container.textContent).not.toContain(fixture.materialName);
  });
  it("prevents repeated submissions while a mutation is pending", async () => {
    await renderManager();
    await click(button("Edit / re-confirm"));
    let reject!: (error: Error) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        })
    );
    const save = button("Save and re-confirm this lot");
    await click(save);
    await click(save);
    expect(api.mock.calls.filter(([method]) => method === "POST")).toHaveLength(1);
    await act(async () => reject(new Error("fixture rejection")));
  });
});
