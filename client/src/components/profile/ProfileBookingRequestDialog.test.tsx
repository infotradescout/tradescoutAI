// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileBookingRequestDialog } from "./ProfileBookingRequestDialog";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
}));

const baseProps = {
  ownerUserId: "directory-business-id",
  businessProfileSlug: "directory-business",
  profileName: "Directory Business",
  timezone: "America/Chicago",
  pricingRows: [],
  paidBookings: false,
  bookingPriceUsd: 0,
  bookingCategory: "plumbing",
  bookingStateCode: "FL",
  viewerCanManage: false,
  signInHref: "/pre-scout-setup?mode=create&ts_discovery=signed.token",
  platformBaseHref: "",
};

describe("ProfileBookingRequestDialog acquisition CTA callbacks", () => {
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
    vi.restoreAllMocks();
  });

  it("records the booking-entry CTA when an authenticated viewer opens the request", async () => {
    const onBookingRequest = vi.fn();
    const onAccountCreate = vi.fn();
    await act(async () => {
      root.render(
        <ProfileBookingRequestDialog
          {...baseProps}
          hasViewerSession
          onBookingRequest={onBookingRequest}
          onAccountCreate={onAccountCreate}
        />
      );
    });

    const trigger = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Request a booking")
    );
    expect(trigger).toBeTruthy();
    await act(async () => trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(onBookingRequest).toHaveBeenCalledTimes(1);
    expect(onAccountCreate).not.toHaveBeenCalled();
  });

  it("records booking entry and the actual account-create handoff for an anonymous viewer", async () => {
    const onBookingRequest = vi.fn();
    const onAccountCreate = vi.fn();
    await act(async () => {
      root.render(
        <ProfileBookingRequestDialog
          {...baseProps}
          hasViewerSession={false}
          signInHref="#create-account"
          onBookingRequest={onBookingRequest}
          onAccountCreate={onAccountCreate}
        />
      );
    });

    const trigger = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Request a booking")
    );
    expect(trigger).toBeTruthy();
    await act(async () => trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(onBookingRequest).toHaveBeenCalledTimes(1);
    expect(onAccountCreate).toHaveBeenCalledTimes(1);
  });
});
