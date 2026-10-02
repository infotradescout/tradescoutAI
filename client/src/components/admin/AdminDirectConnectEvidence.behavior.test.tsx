// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDirectConnectQueue } from "./AdminDirectConnectQueue";
import { AdminDirectConnectRequestDetail } from "./AdminDirectConnectRequestDetail";
import { AdminDirectConnectOperations } from "./AdminDirectConnectOperations";
import {
  requestDetailKey,
  requestHistoryKey,
  requestProviderKey,
} from "./adminDirectConnectEvidence";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: api }));

const NOW = Date.parse("2026-10-01T19:00:00Z");
const REQUEST = "request/a?b";
const detail = (requestId = REQUEST) => ({
  request: {
    id: requestId,
    title: "Synthetic roof request",
    description: "Synthetic work scope",
    category: "roofing",
    countyFips: "12001",
    status: "in_progress",
    source: "direct_connect",
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
  },
  requester: { id: "requester", name: "Synthetic requester", contactVisibility: "withheld" },
  originatingProfile: null,
  assignments: [
    {
      id: "accepted-assignment",
      status: "accepted",
      responderUserId: "provider-user",
      responderName: "Synthetic roofer",
      createdAt: new Date(NOW).toISOString(),
    },
  ],
  events: [],
  conversationId: "conversation",
});
const history = () => ({
  page: 0,
  hasMore: false,
  messages: [
    {
      id: "message",
      content: "Synthetic saved message",
      senderId: "requester",
      senderType: "homeowner",
      createdAt: new Date(NOW).toISOString(),
    },
  ],
  replyAssignmentId: "accepted-assignment",
  replyUnavailableReason: null,
});
const invitationDetail = () => ({
  ...detail(),
  request: { ...detail().request, status: "routed" },
  assignments: [],
});
const providers = [{ id: "provider-record", companyName: "Synthetic Roofing" }];
const invitationReceipt = {
  assignmentId: "new-assignment",
  providerUserId: "provider-user",
  idempotentReplay: false,
  notificationQueued: true,
};
const replyReceipt = {
  messageId: "staff-message",
  assignmentId: "accepted-assignment",
  idempotentReplay: false,
};
const queue = {
  requests: [
    {
      id: REQUEST,
      title: "Synthetic roof request",
      status: "routed",
      category: "roofing",
      createdAt: new Date(NOW).toISOString(),
      requesterEmail: null,
      requesterName: "Synthetic requester",
      profileSlug: null,
      businessName: null,
      assignmentCount: 1,
      responseCount: 1,
    },
  ],
  hasMore: false,
  nextOffset: null,
};

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
async function flush(work?: () => void) {
  await act(async () => {
    work?.();
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
async function mount(element: React.ReactNode) {
  await flush(() =>
    root.render(<QueryClientProvider client={client}>{element}</QueryClientProvider>)
  );
  await flush();
}
function button(label: string) {
  const found = [...container.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === label
  );
  expect(found, label).toBeTruthy();
  return found as HTMLButtonElement;
}
function input(label: string) {
  const found = container.querySelector(`[aria-label="${label}"]`);
  expect(found, label).toBeTruthy();
  return found as HTMLInputElement | HTMLTextAreaElement;
}
async function type(label: string, value: string) {
  const node = input(label);
  const proto =
    node instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  await flush(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function seed(key: readonly unknown[], data: unknown, updatedAt = NOW) {
  client.setQueryData(key, data, { updatedAt });
}
async function changeState(key: readonly unknown[], state: Record<string, unknown>) {
  await flush(() => client.getQueryCache().find({ queryKey: key, exact: true })!.setState(state));
}
async function replyDraft() {
  await type("Staff reply", "Synthetic staff assistance");
  await type("Staff reply audit reason", "Synthetic requested support");
}
async function invitationDraft() {
  await flush(() => seed(requestDetailKey(REQUEST), invitationDetail()));
  seed(requestProviderKey(REQUEST, "12001", "Roof"), providers);
  await type("Search providers in request county", "Roof");
  await flush(() => input("Synthetic Roofing").click());
  await type("Provider invitation audit reason", "Synthetic eligible provider review");
}
const posts = () => api.mock.calls.filter(([method]) => method === "POST");

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  api.mockReset();
  api.mockImplementation(async (method, url) => {
    if (method === "POST") return url.endsWith("/assignments") ? invitationReceipt : replyReceipt;
    if (url.includes("/messages?")) return history();
    if (url.includes("/business-providers/search")) return providers;
    if (url.includes("/requests?")) return queue;
    return detail();
  });
  client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  seed(requestDetailKey(REQUEST), detail());
  seed(requestHistoryKey(REQUEST, 0), history());
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.useRealTimers();
});

describe("mounted Direct Connect request evidence", () => {
  it("renders current queue links with encoded IDs, then withholds cached links on error and recovers", async () => {
    const key = ["/api/admin/direct-connect/requests", "limit=25&offset=0&status=all"];
    seed(key, queue);
    await mount(<AdminDirectConnectQueue />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      `/admin/direct-connect-requests?requestId=${encodeURIComponent(REQUEST)}`
    );
    await changeState(key, { status: "error", error: new Error("synthetic unavailable") });
    expect(container.textContent).toContain("Current request queue unavailable");
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("historical");
    await flush(() => button("Refresh request queue").click());
    await flush();
    expect(container.querySelector("a")).toBeTruthy();
  });

  it.each(["bad", { ...queue, requests: [null] }])(
    "withholds malformed queue evidence without an empty-success claim: %j",
    async (payload) => {
      seed(["/api/admin/direct-connect/requests", "limit=25&offset=0&status=all"], payload);
      await mount(<AdminDirectConnectQueue />);
      expect(container.textContent).toContain("Current request queue unavailable");
      expect(container.querySelector("a")).toBeNull();
      expect(container.textContent).not.toContain("No requests match");
    }
  );

  it("keeps typed drafts and original source time through shared context failure and refresh recovery", async () => {
    await mount(<AdminDirectConnectRequestDetail requestId={REQUEST} />);
    await replyDraft();
    const savedAt = client.getQueryState(requestDetailKey(REQUEST))!.dataUpdatedAt;
    await changeState(requestDetailKey(REQUEST), {
      status: "error",
      error: new Error("synthetic read failure"),
    });
    expect(button("Send as TradeScout staff").disabled).toBe(true);
    expect(input("Staff reply").value).toBe("Synthetic staff assistance");
    expect(container.textContent).toContain("historical evidence");
    expect(client.getQueryState(requestDetailKey(REQUEST))!.dataUpdatedAt).toBe(savedAt);
    await flush(() => button("Refresh request detail").click());
    await flush();
    expect(button("Send as TradeScout staff").disabled).toBe(false);
    expect(input("Staff reply").value).toBe("Synthetic staff assistance");
    expect(
      api.mock.calls.filter(
        ([method, url]) =>
          method === "GET" &&
          url === `/api/admin/direct-connect/requests/${encodeURIComponent(REQUEST)}`
      )
    ).toHaveLength(1);
  });

  it.each([detail("other-request"), { ...detail(), assignments: [null] }])(
    "rejects mismatched or malformed detail context: %j",
    async (payload) => {
      seed(requestDetailKey(REQUEST), payload);
      await mount(<AdminDirectConnectRequestDetail requestId={REQUEST} />);
      await replyDraft();
      expect(container.textContent).toContain("No valid request detail is available");
      expect(button("Send as TradeScout staff").disabled).toBe(true);
      expect(posts()).toHaveLength(0);
    }
  );

  it("does not reuse staff drafts across request IDs", async () => {
    await mount(<AdminDirectConnectRequestDetail requestId={REQUEST} />);
    await replyDraft();
    const next = "next-request";
    seed(requestDetailKey(next), detail(next));
    seed(requestHistoryKey(next, 0), history());
    await mount(<AdminDirectConnectRequestDetail requestId={next} />);
    expect(input("Staff reply").value).toBe("");
    expect(input("Staff reply audit reason").value).toBe("");
  });

  it("sends a valid scoped invitation with its audit ID and encoded endpoint", async () => {
    await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
    await invitationDraft();
    expect(button("Invite selected provider").disabled).toBe(false);
    await flush(() => button("Invite selected provider").click());
    await flush();
    expect(posts()).toHaveLength(1);
    expect(posts()[0]).toEqual([
      "POST",
      `/api/admin/direct-connect/requests/${encodeURIComponent(REQUEST)}/assignments`,
      {
        providerId: "provider-record",
        reason: "Synthetic eligible provider review",
        operationId: expect.any(String),
      },
    ]);
    expect(container.textContent).toContain("Provider invited.");
    expect(input("Provider invitation audit reason").value).toBe("");
  });

  it("retains reply draft and the operation ID on network failure, then confirms a matching receipt", async () => {
    let attempt = 0;
    api.mockImplementation(async (method, url) => {
      if (method === "POST") {
        if (++attempt === 1) throw new Error("synthetic network failure");
        return replyReceipt;
      }
      return url.includes("/messages?") ? history() : detail();
    });
    await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
    await replyDraft();
    await flush(() => button("Send as TradeScout staff").click());
    await flush();
    expect(input("Staff reply").value).toBe("Synthetic staff assistance");
    await flush(() => button("Send as TradeScout staff").click());
    await flush();
    expect(posts()).toHaveLength(2);
    expect(posts()[0][2]).toEqual(posts()[1][2]);
    expect(posts()[1]).toEqual([
      "POST",
      `/api/admin/direct-connect/requests/${encodeURIComponent(REQUEST)}/replies`,
      {
        assignmentId: "accepted-assignment",
        content: "Synthetic staff assistance",
        reason: "Synthetic requested support",
        operationId: expect.any(String),
      },
    ]);
    expect(container.textContent).toContain("Reply saved as TradeScout staff");
    expect(input("Staff reply").value).toBe("");
  });

  it.each([{}, { ...replyReceipt, assignmentId: "other-assignment" }])(
    "does not confirm an unverified reply receipt or discard its retry ID: %j",
    async (receipt) => {
      api.mockImplementation(async (method, url) =>
        method === "POST" ? receipt : url.includes("/messages?") ? history() : detail()
      );
      await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
      await replyDraft();
      await flush(() => button("Send as TradeScout staff").click());
      await flush();
      expect(container.textContent).toContain("receipt could not be confirmed");
      expect(container.textContent).not.toContain("Reply saved as TradeScout staff");
      expect(input("Staff reply").value).toBe("Synthetic staff assistance");
      await flush(() => button("Send as TradeScout staff").click());
      await flush();
      expect(posts()[0][2]).toEqual(posts()[1][2]);
    }
  );

  it("does not confirm an unverified invitation receipt or discard its draft/ID", async () => {
    api.mockImplementation(async (method, url) =>
      method === "POST"
        ? {}
        : url.includes("/messages?")
          ? history()
          : url.includes("business-providers")
            ? providers
            : detail()
    );
    await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
    await invitationDraft();
    await flush(() => button("Invite selected provider").click());
    await flush();
    expect(container.textContent).toContain("receipt could not be confirmed");
    expect(container.textContent).not.toContain("Provider invited.");
    expect(input("Provider invitation audit reason").value).toBe(
      "Synthetic eligible provider review"
    );
    await flush(() => button("Invite selected provider").click());
    await flush();
    expect(posts()[0][2]).toEqual(posts()[1][2]);
  });

  it.each(["invite", "reply"])(
    "blocks %s when evidence expires between UI clock ticks",
    async (kind) => {
      await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
      if (kind === "invite") await invitationDraft();
      else await replyDraft();
      const action = button(
        kind === "invite" ? "Invite selected provider" : "Send as TradeScout staff"
      );
      expect(action.disabled).toBe(false);
      vi.setSystemTime(NOW + 90_001);
      await flush(() => action.click());
      await flush();
      expect(posts()).toHaveLength(0);
      expect(
        input(kind === "invite" ? "Provider invitation audit reason" : "Staff reply").value
      ).toBe(
        kind === "invite" ? "Synthetic eligible provider review" : "Synthetic staff assistance"
      );
    }
  );

  it.each(["invite context", "reply context", "providers", "messages"])(
    "withholds decisions while fresh %s evidence is fetching",
    async (source) => {
      await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
      const inviting = source === "invite context" || source === "providers";
      if (inviting) await invitationDraft();
      else await replyDraft();
      const action = button(inviting ? "Invite selected provider" : "Send as TradeScout staff");
      expect(action.disabled).toBe(false);
      const key = source.endsWith("context")
        ? requestDetailKey(REQUEST)
        : source === "providers"
          ? requestProviderKey(REQUEST, "12001", "Roof")
          : requestHistoryKey(REQUEST, 0);
      await changeState(key, { fetchStatus: "fetching" });
      expect(action.disabled).toBe(true);
      expect(posts()).toHaveLength(0);
    }
  );

  it("removes selected provider authority when refreshed results omit it", async () => {
    await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
    await invitationDraft();
    await flush(() => seed(requestProviderKey(REQUEST, "12001", "Roof"), []));
    expect(button("Invite selected provider").disabled).toBe(true);
    expect(container.textContent).toContain("selected provider is no longer");
    expect(input("Provider invitation audit reason").value).toBe(
      "Synthetic eligible provider review"
    );
    expect(posts()).toHaveLength(0);
  });

  it.each(["providers", "messages"])(
    "keeps saved %s historical on read failure and expiry",
    async (source) => {
      await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
      if (source === "providers") await invitationDraft();
      else await replyDraft();
      expect(
        button(source === "providers" ? "Invite selected provider" : "Send as TradeScout staff")
          .disabled
      ).toBe(false);
      const key =
        source === "providers"
          ? requestProviderKey(REQUEST, "12001", "Roof")
          : requestHistoryKey(REQUEST, 0);
      await changeState(key, { status: "error", error: new Error("synthetic unavailable") });
      expect(
        button(source === "providers" ? "Invite selected provider" : "Send as TradeScout staff")
          .disabled
      ).toBe(true);
      expect(container.textContent).toContain(
        source === "providers" ? "historical results" : "Previously loaded"
      );
      await changeState(key, { status: "success", error: null, dataUpdatedAt: NOW - 90_001 });
      expect(
        button(source === "providers" ? "Invite selected provider" : "Send as TradeScout staff")
          .disabled
      ).toBe(true);
      expect(container.textContent).toContain("stale");
      expect(
        input(source === "providers" ? "Provider invitation audit reason" : "Staff reply").value
      ).toBe(
        source === "providers" ? "Synthetic eligible provider review" : "Synthetic staff assistance"
      );
      expect(posts()).toHaveLength(0);
    }
  );

  it("uses updated cache state at dispatch before the UI receives a provider removal", async () => {
    await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
    await invitationDraft();
    const action = button("Invite selected provider");
    expect(action.disabled).toBe(false);
    await flush(() => {
      seed(requestProviderKey(REQUEST, "12001", "Roof"), []);
      action.click();
    });
    await flush();
    expect(posts()).toHaveLength(0);
    expect(input("Provider invitation audit reason").value).toBe(
      "Synthetic eligible provider review"
    );
  });

  it.each(["invite", "reply"])(
    "blocks %s from independently refreshed request lifecycle before cached supporting evidence expires",
    async (kind) => {
      await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
      if (kind === "invite") await invitationDraft();
      else await replyDraft();
      const action = button(
        kind === "invite" ? "Invite selected provider" : "Send as TradeScout staff"
      );
      expect(action.disabled).toBe(false);
      const changed =
        kind === "invite"
          ? { ...invitationDetail(), assignments: detail().assignments }
          : { ...detail(), request: { ...detail().request, status: "completed" } };
      await flush(() => {
        seed(requestDetailKey(REQUEST), changed);
        action.click();
      });
      await flush();
      expect(posts()).toHaveLength(0);
      expect(action.disabled).toBe(true);
      expect(
        input(kind === "invite" ? "Provider invitation audit reason" : "Staff reply").value
      ).toBe(
        kind === "invite" ? "Synthetic eligible provider review" : "Synthetic staff assistance"
      );
      expect(
        client.getQueryState(
          kind === "invite"
            ? requestProviderKey(REQUEST, "12001", "Roof")
            : requestHistoryKey(REQUEST, 0)
        )!.dataUpdatedAt
      ).toBe(NOW);
    }
  );

  it.each([{ payload: "bad" }, { payload: [null] }])(
    "withholds malformed providers without mapping crashes: %j",
    async ({ payload }) => {
      seed(requestProviderKey(REQUEST, "12001", "Roof"), payload);
      seed(requestDetailKey(REQUEST), invitationDetail());
      await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
      await type("Search providers in request county", "Roof");
      expect(container.textContent).toContain("Current provider results unavailable");
      expect(container.querySelector('input[type="radio"]')).toBeNull();
      expect(button("Invite selected provider").disabled).toBe(true);
      expect(container.textContent).not.toContain("No providers found");
    }
  );

  it.each([
    { ...history(), messages: [null] },
    { ...history(), page: 1 },
    { ...history(), replyAssignmentId: "other-assignment" },
  ])("withholds malformed or unbound messages: %j", async (payload) => {
    seed(requestHistoryKey(REQUEST, 0), payload);
    await mount(<AdminDirectConnectOperations requestId={REQUEST} />);
    await replyDraft();
    expect(button("Send as TradeScout staff").disabled).toBe(true);
    expect(posts()).toHaveLength(0);
    expect(container.textContent).not.toContain("No linked messages yet");
  });
});
