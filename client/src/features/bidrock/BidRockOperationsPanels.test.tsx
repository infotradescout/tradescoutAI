// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BidRockListing } from "@shared/bidrock";
import type {
  BidRockOffer,
  BidRockOrder,
  BidRockOrderWorkspace,
  BidRockProviderHandoffWorkspace,
} from "./bidrockClient";
import {
  BidRockActivityPanel,
  BidRockAdminPanel,
  BidRockSellerPanel,
} from "./BidRockOperationsPanels";
import { BidRockOrderSheet } from "./BidRockOrderSheet";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const offer: BidRockOffer = {
  id: "offer-1",
  listingId: "listing-1",
  buyerUserId: "buyer-1",
  createdByUserId: "buyer-1",
  quantity: 2,
  totalAmountCents: 2_500,
  status: "submitted",
  message: "Need two slabs",
  createdAt: "2026-08-20T12:00:00.000Z",
  expiresAt: "2026-08-27T12:00:00.000Z",
  actions: { accept: true, counter: true, reject: true },
};

const order: BidRockOrder = {
  id: "order-1",
  listingId: "listing-1",
  reservationId: "reservation-1",
  buyerUserId: "buyer-1",
  sellerBusinessId: "seller-1",
  quantity: 2,
  subtotalCents: 2_500,
  status: "reservation_active",
  paymentMethod: "ach",
  reservationExpiresAt: "2026-08-22T12:00:00.000Z",
  effectiveExpired: false,
  canonicalMarketplaceTransactionId: null,
  canonicalProcurementOrderId: null,
  actions: {
    cancel: true,
    prepareAch: false,
    linkCanonical: false,
    settleAch: false,
    freight: false,
    custody: false,
    fabrication: false,
    installationHomeId: false,
    complete: false,
  },
};

const sellerListing: BidRockListing = {
  id: "brl_1234567890abcdefghijklmnop",
  sourceProfileSlug: "jw-stone",
  sourceProfileName: "JW Stone",
  assetKind: "slab",
  materialClass: "natural_stone",
  materialSlug: "blue-dunes",
  title: "Blue Dunes",
  materialFamily: "Granite",
  imageUrl: null,
  dimensions: { length: 133, height: 78.5, unit: "in" },
  quantity: 8,
  unit: "slabs",
  finishQuantities: [],
  status: "draft",
  fresh: true,
  saleReady: false,
  saved: false,
  lastConfirmedAt: "2026-08-20T12:00:00.000Z",
  confirmationExpiresAt: "2026-10-04T12:00:00.000Z",
  canManage: true,
  sellerCapabilities: { read: true, write: true, publish: true },
  canOffer: false,
};

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function input(element: HTMLInputElement | null, value: string) {
  if (!element) throw new Error("Expected an input");
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function buttonContaining(scope: ParentNode, label: string): HTMLButtonElement | null {
  return (
    Array.from(scope.querySelectorAll("button")).find((button) =>
      button.textContent?.includes(label)
    ) || null
  );
}

describe("BidRock actor-capability controls", () => {
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
    document.body
      .querySelectorAll('[data-testid="bidrock-order-detail-sheet"]')
      .forEach((node) => node.remove());
    document.body
      .querySelectorAll('[data-testid="bidrock-mobile-seller-editor"]')
      .forEach((node) => node.remove());
  });

  it("offers only the actions authorized by the server and submits a counteroffer", () => {
    const onCounter = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <BidRockActivityPanel
          offers={[offer]}
          orders={[order]}
          busy={false}
          onAccept={vi.fn().mockResolvedValue(undefined)}
          onCounter={onCounter}
          onReject={vi.fn().mockResolvedValue(undefined)}
          onPaymentReady={vi.fn().mockResolvedValue(undefined)}
          onCancel={vi.fn().mockResolvedValue(undefined)}
          onOpenOrder={vi.fn()}
        />
      );
    });

    expect(buttonContaining(container, "Accept")).not.toBeNull();
    expect(buttonContaining(container, "Reject")).not.toBeNull();
    expect(buttonContaining(container, "Prepare ACH")).toBeNull();
    expect(buttonContaining(container, "Cancel")).not.toBeNull();

    click(buttonContaining(container, "Counter"));
    input(container.querySelector<HTMLInputElement>('[aria-label="Counteroffer total"]'), "30");
    input(container.querySelector<HTMLInputElement>('[aria-label="Counteroffer note"]'), "Firm");
    click(buttonContaining(container, "Send"));
    expect(onCounter).toHaveBeenCalledWith("offer-1", "30", "Firm");
  });

  it("hides admin and handoff controls when the order capability map denies them", () => {
    const onCancel = vi.fn().mockResolvedValue(undefined);
    const workspace: BidRockOrderWorkspace = {
      kind: "order",
      order,
      listing: { title: "Blue Dunes", materialSlug: "blue-dunes", imageUrl: null },
      handoffs: [],
      payment: { method: "ach", ready: false, canonicalTransactionLinked: false },
    };
    act(() => {
      root.render(
        <BidRockOrderSheet
          open
          onOpenChange={vi.fn()}
          workspace={workspace}
          loading={false}
          busy={false}
          onPaymentReady={vi.fn().mockResolvedValue(undefined)}
          onCancel={onCancel}
          onLink={vi.fn().mockResolvedValue(undefined)}
          onSettle={vi.fn().mockResolvedValue(undefined)}
          onComplete={vi.fn().mockResolvedValue(undefined)}
          onHandoff={vi.fn().mockResolvedValue(undefined)}
        />
      );
    });

    const sheet = document.body.querySelector('[data-testid="bidrock-order-detail-sheet"]');
    expect(sheet).not.toBeNull();
    expect(buttonContaining(sheet!, "Cancel order")).not.toBeNull();
    expect(buttonContaining(sheet!, "Prepare ACH")).toBeNull();
    expect(buttonContaining(sheet!, "Verify and link")).toBeNull();
    expect(buttonContaining(sheet!, "Reconcile settled ACH")).toBeNull();
    expect(buttonContaining(sheet!, "Complete sale")).toBeNull();
    expect(sheet?.textContent).not.toContain("Handoff evidence");

    click(buttonContaining(sheet!, "Cancel order"));
    expect(onCancel).toHaveBeenCalledWith("order-1");
  });

  it("renders the seller editor in a mobile Sheet and honors exact capabilities", () => {
    act(() => {
      root.render(
        <BidRockSellerPanel
          listings={[sellerListing]}
          selectedId={sellerListing.id}
          busy={false}
          onSelect={vi.fn()}
          onSavePrice={vi.fn().mockResolvedValue(undefined)}
          onClearPrice={vi.fn().mockResolvedValue(undefined)}
          onPublication={vi.fn().mockResolvedValue(undefined)}
        />
      );
    });
    const mobileEditor = document.body.querySelector(
      '[data-testid="bidrock-mobile-seller-editor"]'
    );
    expect(mobileEditor).not.toBeNull();
    expect(buttonContaining(mobileEditor!, "Save price")).not.toBeNull();
    expect(mobileEditor?.textContent).toContain("Sale-ready publication");
  });

  it("renders explicit admin maintenance controls and reports their outcome", async () => {
    const project = vi.fn().mockResolvedValue(true);
    act(() => {
      root.render(
        <BidRockAdminPanel
          orders={[order]}
          busy={false}
          onProjectInventory={project}
          onExpireHolds={vi.fn().mockResolvedValue(true)}
          onCloseAuctions={vi.fn().mockResolvedValue(true)}
          onImportConfirmedStock={vi.fn().mockResolvedValue(true)}
          onDelegation={vi.fn().mockResolvedValue(true)}
        />
      );
    });
    await act(async () => {
      click(buttonContaining(container, "Sync Stone Core projection"));
      await Promise.resolve();
    });
    expect(project).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Inventory projection completed.");
  });

  it("shows providers only their scoped public references and next handoff action", () => {
    const onHandoff = vi.fn().mockResolvedValue(undefined);
    const workspace: BidRockProviderHandoffWorkspace = {
      kind: "provider_handoff",
      orderReference: "bro_1234567890abcdefghijklmnop",
      lotReference: sellerListing.id,
      listing: { title: sellerListing.title, imageUrl: null },
      handoffActions: [
        {
          handoffType: "freight",
          nextStatus: "pending",
          enabled: true,
          disabledReason: null,
        },
      ],
      handoffs: [],
    };
    act(() => {
      root.render(
        <BidRockOrderSheet
          open
          onOpenChange={vi.fn()}
          workspace={workspace}
          loading={false}
          busy={false}
          onPaymentReady={vi.fn().mockResolvedValue(undefined)}
          onCancel={vi.fn().mockResolvedValue(undefined)}
          onLink={vi.fn().mockResolvedValue(undefined)}
          onSettle={vi.fn().mockResolvedValue(undefined)}
          onComplete={vi.fn().mockResolvedValue(undefined)}
          onHandoff={onHandoff}
        />
      );
    });
    const provider = document.body.querySelector(
      '[data-testid="bidrock-provider-handoff-workspace"]'
    );
    expect(provider).not.toBeNull();
    expect(provider?.textContent).toContain(workspace.orderReference);
    expect(provider?.textContent).toContain(workspace.lotReference);
    expect(provider?.textContent).not.toContain("ACH");
    expect(provider?.textContent).not.toContain("Canonical");
    click(buttonContaining(provider!, "Record next handoff state"));
    expect(onHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: workspace.orderReference,
        handoffType: "freight",
        status: "pending",
      })
    );
  });

  it("uses the provider capability DTO as the only workflow-state action gate", () => {
    const onHandoff = vi.fn().mockResolvedValue(undefined);
    const disabledReason = "Settled ACH payment is required before fulfillment can begin.";
    const workspace: BidRockProviderHandoffWorkspace = {
      kind: "provider_handoff",
      orderReference: "bro_1234567890abcdefghijklmnop",
      lotReference: sellerListing.id,
      listing: { title: sellerListing.title, imageUrl: null },
      handoffActions: [
        {
          handoffType: "freight",
          nextStatus: "pending",
          enabled: false,
          disabledReason,
        },
      ],
      handoffs: [],
    };
    act(() => {
      root.render(
        <BidRockOrderSheet
          open
          onOpenChange={vi.fn()}
          workspace={workspace}
          loading={false}
          busy={false}
          onPaymentReady={vi.fn().mockResolvedValue(undefined)}
          onCancel={vi.fn().mockResolvedValue(undefined)}
          onLink={vi.fn().mockResolvedValue(undefined)}
          onSettle={vi.fn().mockResolvedValue(undefined)}
          onComplete={vi.fn().mockResolvedValue(undefined)}
          onHandoff={onHandoff}
        />
      );
    });
    const provider = document.body.querySelector(
      '[data-testid="bidrock-provider-handoff-workspace"]'
    );
    const action = buttonContaining(provider!, "Record next handoff state");
    expect(provider?.textContent).toContain(disabledReason);
    expect(action).toHaveProperty("disabled", true);
    click(action);
    expect(onHandoff).not.toHaveBeenCalled();
  });
});
