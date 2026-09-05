// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ManagedPartnerIntakeCreateInput,
  ManagedPartnerIntakeRecord,
  ManagedPartnerIntakeReport,
} from "@shared/managedPartnerIntake";
import { TRADESCOUT_MANAGED_CONTACT } from "@shared/tradeScoutManagedContact";
import AdminManagedPartnerIntakesPage from "./admin-managed-partner-intakes";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), toast: vi.fn() }));

vi.mock("@/lib/queryClient", () => ({ apiRequest: mocks.apiRequest }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

const savedFields = {
  displayName: "Louisiana Stone Solutions",
  slug: "louisiana-stone-solutions",
  sourceUrls: ["https://example.test/business"],
  archetype: "contractor",
  controlMode: "admin_stewarded_pending_claim",
  contactMode: "tradescout_managed",
  exposureMode: "direct_only",
  requestMode: "profile_request_flow",
  requestRecipientSlug: "louisiana-stone-solutions",
  expectedPrimaryCta: "Start a Request",
  expectedPhone: TRADESCOUT_MANAGED_CONTACT.phone,
  expectedEmail: TRADESCOUT_MANAGED_CONTACT.email,
  expectedNotificationEmail: TRADESCOUT_MANAGED_CONTACT.email,
  relationshipLabel: null,
  notes: "Business handles requests; owner access remains pending.",
  stage: "routing_review",
  priority: "normal",
  latestAction: null,
  blockerNote: null,
} satisfies ManagedPartnerIntakeCreateInput;

function intakeRecord(
  overrides: Partial<ManagedPartnerIntakeRecord> = {}
): ManagedPartnerIntakeRecord {
  return {
    ...savedFields,
    id: "intake-lss",
    latestAction: "Mailbox review started",
    createdByUserId: "admin-1",
    assignedToUserId: null,
    createdAt: "2026-09-04T12:00:00.000Z",
    updatedAt: "2026-09-04T12:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

describe("managed partner intake contact mode changes", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let originalScrollIntoView: typeof Element.prototype.scrollIntoView;

  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.toast.mockReset();
    originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    Element.prototype.scrollIntoView = originalScrollIntoView;
    vi.unstubAllGlobals();
  });

  function button(label: string) {
    const control = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === label
    );
    expect(control, `button ${label}`).toBeDefined();
    return control!;
  }

  async function editRecord(item: ManagedPartnerIntakeRecord) {
    const report: ManagedPartnerIntakeReport = {
      generatedAt: item.updatedAt,
      summary: { total: 1, incoming: 0, activeBuilds: 1, readyToPublish: 0, live: 0, blocked: 0 },
      items: [item],
    };
    queryClient.setQueryData(["/api/admin/managed-partner-intakes"], report);
    mocks.apiRequest.mockImplementation(async (method: string) =>
      method === "GET" ? report : { item }
    );
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AdminManagedPartnerIntakesPage />
        </QueryClientProvider>
      );
    });
    act(() => button("Edit intake").click());
  }

  async function chooseContactMode(label: string) {
    const fieldLabel = Array.from(container.querySelectorAll("label")).find(
      (candidate) => candidate.textContent === "Contact handling"
    );
    const trigger = fieldLabel?.parentElement?.querySelector<HTMLElement>('[role="combobox"]');
    expect(trigger).toBeTruthy();
    await act(async () => {
      trigger!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (candidate) => candidate.textContent === label
    );
    expect(option, `contact mode ${label}`).toBeDefined();
    await act(async () => {
      option!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
  }

  function setInput(id: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function saveAndExpect(payload: ManagedPartnerIntakeCreateInput) {
    await act(async () => button("Save intake").click());
    const saves = mocks.apiRequest.mock.calls.filter(([method]) => method === "PATCH");
    expect(saves).toEqual([["PATCH", "/api/admin/managed-partner-intakes/intake-lss", payload]]);
  }

  it.each([
    "tradescout_managed",
    "business_phone_tradescout_email",
    "pending_owner_contact",
  ] as const)(
    "clears inherited destinations in the full saved payload when switching from %s",
    async (contactMode) => {
      await editRecord(intakeRecord({ contactMode }));
      await chooseContactMode("Business Managed");
      await saveAndExpect({
        ...savedFields,
        contactMode: "business_managed",
        expectedPhone: null,
        expectedEmail: null,
        expectedNotificationEmail: null,
      });
    }
  );

  it("saves newly entered business inboxes after switching without inheriting a phone", async () => {
    await editRecord(intakeRecord());
    await chooseContactMode("Business Managed");
    setInput("partner-email", "business@example.test");
    setInput("partner-notification-email", "requests@example.test");
    await saveAndExpect({
      ...savedFields,
      contactMode: "business_managed",
      expectedPhone: null,
      expectedEmail: "business@example.test",
      expectedNotificationEmail: "requests@example.test",
    });
  });

  it("preserves saved business contact details when editing the same mode", async () => {
    const businessContact = {
      contactMode: "business_managed",
      expectedPhone: "+1 225 555 0100",
      expectedEmail: "business@example.test",
      expectedNotificationEmail: "requests@example.test",
    } as const;
    await editRecord(intakeRecord(businessContact));
    await chooseContactMode("Business Managed");
    setInput("partner-latest-action", "Business account access still needs confirmation.");
    await saveAndExpect({
      ...savedFields,
      ...businessContact,
      latestAction: "Business account access still needs confirmation.",
    });
  });
});
