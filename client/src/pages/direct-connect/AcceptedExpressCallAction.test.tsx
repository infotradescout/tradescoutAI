// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AcceptedExpressCallAction from "./AcceptedExpressCallAction";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("accepted Express call action", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("does not request or render raw contact before an accepted call assignment", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(
        <AcceptedExpressCallAction
          assignmentId="assignment-1"
          assignmentStatus="suggested"
          contactPreference="call"
        />
      );
    });

    expect(container.textContent).toBe("");
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never offers a raw call action for platform-message authority", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(
        <AcceptedExpressCallAction
          assignmentId="assignment-1"
          assignmentStatus="accepted"
          contactPreference="platform_message"
        />
      );
    });

    expect(container.textContent).toBe("");
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the exact gated endpoint before rendering the accepted call link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        assignmentId: "assignment-1",
        requestId: "request-1",
        contactPreference: "call",
        contactGateState: "accepted",
        requesterContact: { phone: "+1 (404) 555-0100" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(
        <AcceptedExpressCallAction
          assignmentId="assignment-1"
          assignmentStatus="accepted"
          contactPreference="call"
        />
      );
    });

    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    await act(async () => {
      click(
        Array.from(container.querySelectorAll("button")).find((node) =>
          node.textContent?.includes("Show call number")
        ) || null
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/direct-connect/assignments/assignment-1/contact",
      expect.objectContaining({ method: "GET", credentials: "include" })
    );
    expect(container.querySelector('a[href="tel:+14045550100"]')).not.toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("fails closed when the endpoint does not confirm call-scoped authority", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        contactPreference: "platform_message",
        contactGateState: "accepted",
        requesterContact: { phone: "404-555-0100" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(
        <AcceptedExpressCallAction
          assignmentId="assignment-1"
          assignmentStatus="accepted"
          contactPreference="call"
        />
      );
    });

    await act(async () => {
      click(container.querySelector("button"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("still protected");
  });

  it("is wired into the shipped provider inbox with server-derived preference", () => {
    const shell = fs.readFileSync(path.resolve(__dirname, "DirectConnectShell.tsx"), "utf8");

    expect(shell).toContain('import AcceptedExpressCallAction from "./AcceptedExpressCallAction"');
    expect(shell).toContain("<AcceptedExpressCallAction");
    expect(shell).toContain("contactPreference={assignment.contactPreference}");
    expect(shell).not.toContain("requesterContact={assignment");
  });

  it("shows the submitted sender name and phone to an invited business using platform messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        assignmentId: "assignment-1",
        contactGateState: "submission_consented",
        contactPreference: "platform_message",
        requesterContact: { name: "Jordan Example", phone: "+12255550100" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    act(() =>
      root.render(
        <AcceptedExpressCallAction
          assignmentId="assignment-1"
          assignmentStatus="invited"
          contactPreference="platform_message"
          submissionContactAvailable
        />
      )
    );
    expect(container.textContent).toContain("View sender contact");
    expect(container.textContent).not.toContain("Jordan Example");
    await act(async () => {
      click(container.querySelector("button"));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Jordan Example");
    expect(container.querySelector('a[href="tel:+12255550100"]')).not.toBeNull();
    act(() =>
      root.render(
        <AcceptedExpressCallAction
          assignmentId="assignment-2"
          assignmentStatus="invited"
          contactPreference="platform_message"
          submissionContactAvailable
        />
      )
    );
    expect(container.textContent).not.toContain("Jordan Example");
    await act(async () => {
      click(container.querySelector("button"));
      await Promise.resolve();
    });
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });
});
