// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJwExpressAccountAction } from "./useJwExpressAccountAction";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function response(): Response {
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("JW Express fragment account actions", () => {
  let host: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/jw-stone");
  });

  it("clears and POSTs a verification fragment without putting the token in a URL", async () => {
    window.history.replaceState(null, "", "/jw-stone#jw-express-action=verify&token=verify-secret");

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(window.location.hash).toBe("");
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/jw-stone/express/verification/confirm");
    expect(path).not.toContain("verify-secret");
    expect(JSON.parse(String(init.body))).toEqual({ token: "verify-secret" });
  });

  it("retains a reset fragment token in memory until the new password is submitted", async () => {
    window.history.replaceState(null, "", "/jw-stone#jw-express-action=reset&token=reset-secret");

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(window.location.hash).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/jw-stone/express/password/reset/confirm");
    expect(path).not.toContain("reset-secret");
    expect(JSON.parse(String(init.body))).toEqual({
      token: "reset-secret",
      password: "replacement-password",
      passwordConfirmation: "replacement-password",
    });
  });
});

function Harness() {
  const action = useJwExpressAccountAction();
  return (
    <button
      type="button"
      onClick={() => action.completeReset("replacement-password", "replacement-password")}
    >
      Complete reset
    </button>
  );
}
