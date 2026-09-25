// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoutHome } from "./ScoutHome";

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/scout", vi.fn()] }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: () => "Scout" }) }));
vi.mock("@/components/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("./hooks/useScoutLocation", () => ({
  useScoutLocation: () => ({ location: { status: "unresolved", label: "Maricopa County, AZ", fips: null, state: null } }),
}));
vi.mock("./hooks/useScoutHomeSnapshot", () => ({ useScoutHomeSnapshot: () => ({ data: { recentActivity: [] } }) }));
vi.mock("./ScoutWorkPanel", () => ({ ScoutWorkPanel: () => null }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const threads = [
  { id: "task-a", title: "Repair a leaking roof", summary: "Roof repair plan" },
  { id: "task-b", title: "Replace damaged wiring", summary: "Electrical inspection plan" },
];

describe("Scout saved conversation selection", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("lets a person choose the second saved task instead of silently opening the first", async () => {
    const onSelect = vi.fn();
    await act(async () => root.render(
      <ScoutHome primaryOutcomeInput={<div />} onPromptSelect={vi.fn()} onContinuationSelect={onSelect} continuationThreads={threads} />
    ));
    const conversations = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Saved tasks"));
    expect(conversations).toBeTruthy();
    await act(async () => conversations!.click());
    expect(onSelect).not.toHaveBeenCalled();
    expect(conversations!.getAttribute("aria-expanded")).toBe("true");
    const choices = [...container.querySelectorAll<HTMLButtonElement>('[data-testid="scout-continuation"]')];
    expect(choices.map((button) => button.textContent)).toEqual([
      expect.stringContaining("Repair a leaking roof"),
      expect.stringContaining("Replace damaged wiring"),
    ]);
    await act(async () => choices[1].click());
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("task-b");
    expect(container.querySelector('[data-testid="scout-continuations-list"]')).toBeNull();
  });

  it("opens the only saved task with one click", async () => {
    const onSelect = vi.fn();
    await act(async () => root.render(
      <ScoutHome primaryOutcomeInput={<div />} onPromptSelect={vi.fn()} onContinuationSelect={onSelect} continuationThreads={[threads[0]]} />
    ));
    const conversations = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Saved tasks"));
    await act(async () => conversations!.click());
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("task-a");
    expect(container.querySelector('[data-testid="scout-continuations-list"]')).toBeNull();
  });
});
