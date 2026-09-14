/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContractorProfile from "./contractor-profile";

const state = vi.hoisted(() => ({ navigate: vi.fn(), authenticated: false }));
vi.mock("wouter", () => ({
  useParams: () => ({ slug: "synthetic-installer" }),
  useLocation: () => ["/contractors/synthetic-installer", state.navigate],
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({
  isLoading: false,
  data: {
    contractor: { id: "contractor-1", slug: "synthetic-installer", companyName: "Synthetic Installer", photos: [] },
    recommendations: [],
    canonicalBusinessProfileUrl: "/u/synthetic-installer",
  },
}) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: state.authenticated }) }));
vi.mock("@/components/RecommendationForm", () => ({ RecommendationForm: (props: any) =>
  <div data-testid="actual-parent-composer" data-open={props.defaultOpen} data-resume={props.resumeSaved} data-destination={props.resumePath} data-contractor={props.contractorId} />,
}));
vi.mock("@/components/SEOHelmet", () => ({ SEOHelmet: () => null }));
vi.mock("@/components/ShareButton", () => ({ ShareButton: () => null }));
vi.mock("@/pages/profile-sites/TradeScoutProfileHandoff", () => ({ default: () => null }));

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  state.navigate.mockReset(); state.authenticated = false;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
async function render(search: string) {
  window.history.replaceState({}, "", "/contractors/synthetic-installer" + search);
  await act(async () => root.render(<ContractorProfile />));
}
describe("Canonical contractor recommendation return", () => {
  it.each([false, true])("renders the requested composer without redirect or spinner; authenticated=%s", async authenticated => {
    state.authenticated = authenticated;
    await render("?trustAction=recommend");
    const composer = host.querySelector('[data-testid="actual-parent-composer"]');
    expect(composer).not.toBeNull();
    expect(composer?.getAttribute("data-open")).toBe("true");
    expect(composer?.getAttribute("data-resume")).toBe("true");
    expect(composer?.getAttribute("data-contractor")).toBe("contractor-1");
    expect(composer?.getAttribute("data-destination")).toBe("/contractors/synthetic-installer?trustAction=recommend");
    expect(host.querySelector(".animate-spin")).toBeNull();
    expect(state.navigate).not.toHaveBeenCalled();
  });
  it.each(["", "?trustAction=unrelated"])("preserves ordinary canonical navigation for %s", async search => {
    await render(search);
    expect(state.navigate).toHaveBeenCalledWith("/u/synthetic-installer");
    expect(host.querySelector('[data-testid="actual-parent-composer"]')).toBeNull();
  });
});
