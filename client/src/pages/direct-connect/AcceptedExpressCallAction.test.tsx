// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AcceptedExpressCallAction from "./AcceptedExpressCallAction";

const auth = vi.hoisted(() => ({ user: { id: "provider-1" } as { id: string } | null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = Parameters<typeof AcceptedExpressCallAction>[0];
const submittedProps: Props = {
  assignmentId: "assignment-1", assignmentStatus: "invited",
  contactPreference: "platform_message", submissionContactAvailable: true,
};
const contact = (assignmentId = "assignment-1", name = "Jordan Example", phone = "+12255550100") => ({
  assignmentId, requestId: "request-1", contactGateState: "submission_consented",
  contactPreference: "platform_message", requesterContact: { name, phone },
});
const response = (payload = contact(), ok = true) => ({ ok, json: async () => payload });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("requester contact in the assigned-provider inbox", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    auth.user = { id: "provider-1" };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const render = (props: Props = submittedProps) => act(async () => { root.render(<AcceptedExpressCallAction {...props} />); });
  const click = () => act(async () => {
    const button = container.querySelector("button");
    if (!button) throw new Error("Expected contact action");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const expectNoContact = () => {
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('[data-testid="request-sender-contact"]')).toBeNull();
  };

  it.each(["suggested", "invited", "accepted"])(
    "automatically displays submitted contact for %s without a second approval or reveal click",
    async (assignmentStatus) => {
      const fetchMock = vi.fn().mockResolvedValue(response());
      vi.stubGlobal("fetch", fetchMock);
      await render({ ...submittedProps, assignmentStatus });
      expect(container.textContent).toContain("Jordan Example");
      expect(container.querySelector('a[href="tel:+12255550100"]')).not.toBeNull();
      expect(container.textContent).not.toMatch(/View sender contact|approval|protected/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("/api/direct-connect/assignments/assignment-1/contact",
        expect.objectContaining({ method: "GET", credentials: "include", cache: "no-store", signal: expect.any(AbortSignal) }));
    }
  );

  it("does not fetch contact for a signed-out viewer", async () => {
    auth.user = null;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await render();
    expect(container.textContent).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { assignmentStatus: "suggested", contactPreference: "call" as const },
    { assignmentStatus: "accepted", contactPreference: "platform_message" as const },
  ])("does not infer submission permission for legacy data: %j", async (props) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await render({ assignmentId: "assignment-1", ...props });
    expect(container.textContent).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves the existing accepted Express call endpoint and explicit legacy action", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ...contact(),
      contactGateState: "accepted", contactPreference: "call" }));
    vi.stubGlobal("fetch", fetchMock);
    await render({ assignmentId: "assignment-1", assignmentStatus: "accepted", contactPreference: "call" });
    expectNoContact();
    expect(fetchMock).not.toHaveBeenCalled();
    await click();
    expect(container.querySelector('[data-testid="accepted-express-call-link"]')?.getAttribute("href"))
      .toBe("tel:+12255550100");
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it.each([
    { ...contact(), assignmentId: "assignment-other" },
    { ...contact(), assignmentId: undefined },
    { ...contact(), contactGateState: "accepted" },
    { ...contact(), requesterContact: { name: "", phone: "+12255550100" } },
    { ...contact(), requesterContact: { name: 123, phone: "+12255550100" } },
    { ...contact(), requesterContact: { name: "Jordan", phone: 12255550100 } },
    { ...contact(), requesterContact: { name: "Jordan", phone: "123" } },
    null,
  ])("rejects unconfirmed or malformed contact response %#", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
    await render();
    expectNoContact();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not be loaded");
    expect(container.textContent).not.toContain("still protected");
  });

  it("rejects a different assignment on the legacy accepted call path too", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ...contact("foreign"),
      contactGateState: "accepted", contactPreference: "call" })));
    await render({ assignmentId: "assignment-1", assignmentStatus: "accepted", contactPreference: "call" });
    await click();
    expectNoContact();
  });

  it("rejects platform-message-only authority on the legacy call path", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ...contact(), contactGateState: "accepted" })));
    await render({ assignmentId: "assignment-1", assignmentStatus: "accepted", contactPreference: "call" });
    await click();
    expectNoContact();
  });

  it("shows a retry after a denied response and never renders its contact body", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(contact(), false)).mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetchMock);
    await render();
    expectNoContact();
    expect(container.textContent).toContain("Retry contact");
    await click();
    expect(container.textContent).toContain("Jordan Example");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers from network and invalid-JSON failures without an approval prompt", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, json: async () => { throw new Error("Invalid JSON"); } })
      .mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetchMock);
    await render();
    expectNoContact();
    await click();
    expectNoContact();
    await click();
    expect(container.textContent).toContain("Jordan Example");
  });

  it("aborts the previous assignment and ignores its late response", async () => {
    const old = deferred<ReturnType<typeof response>>();
    const fetchMock = vi.fn().mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(response(contact("assignment-2", "Second Requester", "+12255550200")));
    vi.stubGlobal("fetch", fetchMock);
    await render();
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Loading");
    await render({ ...submittedProps, assignmentId: "assignment-2" });
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { old.resolve(response()); });
    expect(container.textContent).toContain("Second Requester");
    expect(container.textContent).not.toContain("Jordan Example");
    expect(container.querySelector('a[href="tel:+12255550200"]')).not.toBeNull();
  });

  it("clears rendered contact on an account switch before the new lookup resolves", async () => {
    const next = deferred<ReturnType<typeof response>>();
    const fetchMock = vi.fn().mockResolvedValueOnce(response()).mockReturnValueOnce(next.promise);
    vi.stubGlobal("fetch", fetchMock);
    await render();
    auth.user = { id: "provider-2" };
    await render();
    expectNoContact();
    expect(container.textContent).not.toContain("Jordan Example");
    await act(async () => { next.resolve(response(contact(), false)); });
    expectNoContact();
  });

  it("ignores an old account's pending response after switching accounts", async () => {
    const old = deferred<ReturnType<typeof response>>();
    const fetchMock = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(contact(), false));
    vi.stubGlobal("fetch", fetchMock);
    await render();
    auth.user = { id: "provider-2" };
    await render();
    await act(async () => { old.resolve(response()); });
    expectNoContact();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("removes contact and cancels pending reads on sign-out", async () => {
    const old = deferred<ReturnType<typeof response>>();
    const fetchMock = vi.fn().mockReturnValueOnce(old.promise);
    vi.stubGlobal("fetch", fetchMock);
    await render();
    auth.user = null;
    await render();
    await act(async () => { old.resolve(response()); });
    expect(container.textContent).toBe("");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it.each(["declined", "expired", "revoked"])("discards a pending response when assignment becomes %s", async (assignmentStatus) => {
    const old = deferred<ReturnType<typeof response>>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(old.promise));
    await render();
    await render({ ...submittedProps, assignmentStatus });
    await act(async () => { old.resolve(response()); });
    expect(container.textContent).toBe("");
  });

  it("drops loaded contact when the server's submission-availability flag is removed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    await render();
    await render({ ...submittedProps, submissionContactAvailable: false });
    expect(container.textContent).toBe("");
  });

  it("aborts a slow request, offers retry and ignores a late success from the timed-out attempt", async () => {
    vi.useFakeTimers();
    const old = deferred<ReturnType<typeof response>>();
    const fetchMock = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetchMock);
    await render();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(container.textContent).toContain("Retry contact");
    await act(async () => { old.resolve(response(contact("assignment-1", "Late Stale Contact"))); });
    expectNoContact();
    await click();
    expect(container.textContent).toContain("Jordan Example");
    expect(container.textContent).not.toContain("Late Stale Contact");
  });

  it("aborts on unmount and does not retain the requester in browser storage", async () => {
    const old = deferred<ReturnType<typeof response>>();
    const fetchMock = vi.fn().mockReturnValueOnce(old.promise);
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    vi.stubGlobal("fetch", fetchMock);
    await render();
    await act(async () => { root.render(null); });
    await act(async () => { old.resolve(response()); });
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it("does not duplicate reads on an unchanged rerender", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);
    await render();
    await render();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("escapes requester names and encodes the selected assignment in the request URL", async () => {
    const assignmentId = "assignment-1?redirect=/other";
    const name = '<img src=x onerror="alert(1)">';
    const fetchMock = vi.fn().mockResolvedValue(response(contact(assignmentId, name)));
    vi.stubGlobal("fetch", fetchMock);
    await render({ ...submittedProps, assignmentId });
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/direct-connect/assignments/${encodeURIComponent(assignmentId)}/contact`);
    expect(container.textContent).toContain(name);
    expect(container.querySelector("img")).toBeNull();
  });

  it("remains wired into the shipped inbox with server-derived authority, not client-supplied contact", () => {
    const shell = fs.readFileSync(path.resolve(__dirname, "DirectConnectShell.tsx"), "utf8");
    expect(shell).toContain('import AcceptedExpressCallAction from "./AcceptedExpressCallAction"');
    expect(shell).toContain("<AcceptedExpressCallAction");
    expect(shell).toContain("contactPreference={assignment.contactPreference}");
    expect(shell).toContain("submissionContactAvailable={assignment.submissionContactAvailable}");
    expect(shell).not.toContain("requesterContact={assignment");
  });
});
