// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PensacolaPage from "./pensacola";
import {
  PENSACOLA_PROJECTS,
  pensacolaProjectMessage,
  type PensacolaProjectKind,
} from "@shared/pensacolaDiscovery";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock("@/components/SEOHelmet", () => ({
  SEOHelmet: () => null,
  createBreadcrumbStructuredData: () => ({}),
  createFAQStructuredData: () => ({}),
}));
vi.mock("wouter", () => ({ Link: ({ href, children }: any) => <a href={href}>{children}</a> }));

describe("Pensacola to ISSA Build visitor journey", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        requestId: "isolated-test",
        deliveryCustody: "tradescout_pending_owner",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each(Object.keys(PENSACOLA_PROJECTS) as PensacolaProjectKind[])(
    "opens the actual anonymous form for %s and submits only to ISSA Build",
    async (kind) => {
      await act(async () => root.render(<PensacolaPage />));
      const link = Array.from(container.querySelectorAll("a")).find(
        (node) => node.textContent === PENSACOLA_PROJECTS[kind].label
      );
      expect(link).toBeTruthy();
      await act(async () => {
        link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await act(async () => {
        await vi.dynamicImportSettled();
      });
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain("ISSA Build");
      expect(dialog?.querySelector("textarea")?.value).toBe(pensacolaProjectMessage(kind));
      expect(dialog?.querySelector("select")?.value).toBe("request_service");
      expect(fetchMock).not.toHaveBeenCalled();
      // Local, intercepted submission verifies recipient and selected need without any real request.
      for (const [selector, value] of [
        ['input[autocomplete="name"]', "Test Person"],
        ['input[type="email"]', "test@example.com"],
        ['input[type="tel"]', "555-555-1212"],
      ]) {
        const input = dialog?.querySelector<HTMLInputElement>(selector);
        expect(input).toBeTruthy();
        act(() => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
            input,
            value
          );
          input?.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      await act(async () => {
        dialog
          ?.querySelector("form")
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(
        "/api/tradepartner-profiles/issa-build/express-request"
      );
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
        serviceName: PENSACOLA_PROJECTS[kind].title,
        message: pensacolaProjectMessage(kind),
        requestType: "request_service",
        updatesOptIn: false,
      });
    }
  );
});
