/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicProfileAccountDialog } from "./PublicProfileAccountDialog";

const fixture = vi.hoisted(() => ({
  viewer: { id: "member-a" } as { id: string } | null,
  authenticated: true,
  load: vi.fn(),
  create: vi.fn(),
  register: vi.fn(),
  refetch: vi.fn(),
  changed: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: fixture.viewer, isAuthenticated: fixture.authenticated, refetch: fixture.refetch }) }));
vi.mock("./profileAccountClient", () => ({
  buildProfileAccountResumePath: (slug: string) => `/u/${slug}?profileAccount=1`,
  currentProfileAccountSourcePath: (slug: string) => `/u/${slug}`,
  loadProfileAccountState: fixture.load,
  createProfileAccount: fixture.create,
  registerProfileAccount: fixture.register,
  readProfileAccountJson: async (response: Response) => response.json(),
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children, ...props }: any) => <section {...props}>{children}</section>,
  DialogDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
}));
const policy = { enabled: true, requiredIdentity: "business", includesBidRock: false };
function connected(name: string, id: string) {
  return { policy, viewerBusiness: { id: "business-" + id, name, verificationStatus: "pending" }, requiresBusinessSetup: false,
    account: { id: "account-" + id, status: "active", businessName: name, verificationStatus: "pending" }, entitlements: [] };
}
const unconnected = { policy, viewerBusiness: null, requiresBusinessSetup: true, account: null, entitlements: [] };
let host: HTMLDivElement, root: Root;
const close = vi.fn();
async function render(slug = "jw-stone") {
  await act(async () => { root.render(<PublicProfileAccountDialog open onOpenChange={close} onAccountChange={fixture.changed} profileSlug={slug} profileName="JW Stone" />); });
}
beforeEach(() => {
  fixture.viewer = { id: "member-a" }; fixture.authenticated = true;
  fixture.load.mockReset().mockResolvedValue(connected("Synthetic Business A", "a"));
  fixture.create.mockReset(); fixture.register.mockReset(); fixture.refetch.mockReset(); fixture.changed.mockReset();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("Profile account session isolation", () => {
  it("clears a former member's connected state immediately when another customer signs in", async () => {
    await render(); expect(host.textContent).toContain("Synthetic Business A is connected");
    fixture.changed.mockClear();
    let resolve!: (value: unknown) => void;
    fixture.load.mockImplementation(() => new Promise(done => { resolve = done; }));
    fixture.viewer = { id: "member-b" };
    await render();
    expect(host.textContent).not.toContain("Synthetic Business A");
    expect(host.querySelector('[data-testid="profile-account-dialog-connected"]')).toBeNull();
    expect(fixture.load).toHaveBeenCalledTimes(2);
    await act(async () => { resolve(connected("Synthetic Business B", "b")); });
    expect(host.textContent).toContain("Synthetic Business B is connected");
    expect(fixture.changed.mock.calls.every(([state]) => state.account?.businessName !== "Synthetic Business A")).toBe(true);
  });
  it("does not show a connected business or carry its name into a logged-out form", async () => {
    await render();
    fixture.load.mockResolvedValue(unconnected); fixture.viewer = null; fixture.authenticated = false;
    await render();
    expect(host.textContent).not.toContain("Synthetic Business A");
    expect(host.querySelector('[data-testid="profile-account-dialog-connected"]')).toBeNull();
    expect((host.querySelector('[data-testid="profile-account-business-name"]') as HTMLInputElement)?.value).toBe("");
  });
  it("ignores the old session's late account response after logout", async () => {
    let resolveOld!: (value: unknown) => void;
    fixture.load.mockImplementationOnce(() => new Promise(done => { resolveOld = done; }));
    await render();
    fixture.viewer = null; fixture.authenticated = false; fixture.load.mockResolvedValue(unconnected);
    await render();
    await act(async () => { resolveOld(connected("Synthetic Business A", "a")); });
    expect(host.textContent).not.toContain("Synthetic Business A");
    expect(host.querySelector('[data-testid="profile-account-dialog-connected"]')).toBeNull();
  });
  it("does not leave the former business visible when the new session's lookup fails", async () => {
    await render();
    fixture.viewer = { id: "member-b" }; fixture.load.mockRejectedValue(new Error("Synthetic account lookup unavailable"));
    await render();
    expect(host.textContent).not.toContain("Synthetic Business A");
    expect(host.querySelector('[data-testid="profile-account-load-error"]')).not.toBeNull();
    expect(fixture.create).not.toHaveBeenCalled();
  });
  it("does not reload or discard state merely because the same user's object refreshed", async () => {
    await render(); fixture.viewer = { id: "member-a" }; await render();
    expect(host.textContent).toContain("Synthetic Business A is connected");
    expect(fixture.load).toHaveBeenCalledTimes(1);
  });
});
