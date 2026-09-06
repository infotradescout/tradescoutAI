// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfileSettings from "./ProfileSettings";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  refetch: vi.fn(),
  toast: vi.fn(),
  path: "",
  user: {
    id: "sender-1",
    firstName: "",
    lastName: "",
    phone: "",
    stateCode: "LA",
    countyFips: "22105",
    countyName: "Tangipahoa",
    preferences: {},
  },
}));
vi.mock("wouter", () => ({ useLocation: () => [state.path, state.navigate] }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: state.user, isAuthenticated: true, refetch: state.refetch }),
}));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ updateCustomColors: vi.fn() }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: (...args: any[]) => state.toast(...args) }));

describe("profile contact recovery", () => {
  let root: Root;
  let container: HTMLDivElement;
  let client: QueryClient;
  let fetchMock: ReturnType<typeof vi.fn>;
  const requestPath = "/direct-connect?county=22105&profile=bayou-roofing";
  beforeEach(() => {
    state.navigate.mockReset();
    state.refetch.mockReset();
    state.toast.mockReset();
    state.path = `/profile-settings?next=${encodeURIComponent(requestPath)}`;
    window.history.replaceState({}, "", state.path);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    fetchMock = vi.fn(async (url, options) => {
      const data =
        options?.method === "PUT"
          ? state.user
          : String(url).includes("/api/states")
            ? [{ code: "LA", name: "Louisiana", subdivisionType: "parish" }]
            : String(url).includes("/api/counties")
              ? [{ stateCode: "LA", fips: "22105", name: "Tangipahoa" }]
              : [];
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
  });
  async function mount() {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <ProfileSettings />
        </QueryClientProvider>
      )
    );
  }
  async function change(id: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function save() {
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="profile-settings-identity-save-basics"]')!
        .click()
    );
  }
  it("collects the missing name and phone, saves canonical location, and returns to the exact request", async () => {
    await mount();
    await save();
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
    await change("profile-settings-identity-first-name", "Jordan");
    await change("profile-settings-identity-last-name", "Example");
    await change("profile-settings-identity-phone", "2255550100");
    await save();
    const update = fetchMock.mock.calls.find(([, options]) => options?.method === "PUT")!;
    expect(update[0]).toBe("/api/user/profile");
    expect(JSON.parse(update[1].body)).toMatchObject({
      firstName: "Jordan",
      lastName: "Example",
      phone: "2255550100",
      stateCode: "LA",
      countyFips: "22105",
    });
    expect(state.refetch).toHaveBeenCalled();
    expect(state.navigate).toHaveBeenCalledWith(requestPath);
  });
  it("rejects an external return destination", async () => {
    state.path = "/profile-settings?next=https%3A%2F%2Funtrusted.example";
    window.history.replaceState({}, "", state.path);
    await mount();
    expect(
      container.querySelector('[data-testid="profile-settings-identity-save-basics"]')?.textContent
    ).toBe("Save profile basics");
    expect(state.navigate).not.toHaveBeenCalled();
  });
});
