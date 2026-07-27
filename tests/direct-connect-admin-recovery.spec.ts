import { expect, test, type Page, type TestInfo } from "@playwright/test";

const requestId = String(process.env.E2E_DIRECT_CONNECT_REQUEST_ID || "").trim();
const authenticatedEmail = String(
  process.env.E2E_EMAIL || process.env.MASTER_ADMIN_EMAIL || ""
).trim();
const authenticatedPassword = String(
  process.env.E2E_PASSWORD || process.env.MASTER_ADMIN_PASSWORD || ""
).trim();
const missingProofInputs = [
  !String(process.env.TEST_DATABASE_URL || "").trim() ? "TEST_DATABASE_URL" : "",
  !requestId ? "E2E_DIRECT_CONNECT_REQUEST_ID" : "",
  !authenticatedEmail ? "E2E_EMAIL or MASTER_ADMIN_EMAIL" : "",
  !authenticatedPassword ? "E2E_PASSWORD or MASTER_ADMIN_PASSWORD" : "",
].filter(Boolean);

type AdminRecoveryAssignment = {
  contractorSlug?: string | null;
  contractorName?: string | null;
  providerName?: string | null;
  providerProfileUrl?: string | null;
  profileUrl?: string | null;
  providerUserId?: string | null;
  responderName?: string | null;
  responderUserId?: string | null;
  workerId?: string | null;
  workerName?: string | null;
  provider?: {
    name?: string | null;
    profileUrl?: string | null;
  } | null;
};

function resolveAssignmentProfileUrl(assignment: AdminRecoveryAssignment): string {
  const explicitUrl =
    assignment.provider?.profileUrl || assignment.profileUrl || assignment.providerProfileUrl;
  if (explicitUrl) return String(explicitUrl);
  if (assignment.contractorSlug) {
    return `/contractors/${encodeURIComponent(String(assignment.contractorSlug))}`;
  }
  if (assignment.workerId) {
    return `/helpers/${encodeURIComponent(String(assignment.workerId))}`;
  }
  const providerUserId = assignment.providerUserId || assignment.responderUserId;
  return providerUserId ? `/profile/${encodeURIComponent(String(providerUserId))}` : "";
}

test.describe("Direct Connect operator recovery", () => {
  test.beforeAll(() => {
    expect(
      missingProofInputs,
      `Authenticated Direct Connect recovery proof requires: ${missingProofInputs.join(", ")}`
    ).toEqual([]);
  });

  const verifyRequestDetail = async (
    page: Page,
    viewport: { width: number; height: number },
    proofLabel: "desktop" | "mobile",
    testInfo: TestInfo
  ) => {
    await page.setViewportSize(viewport);
    const detailResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes(`/api/admin/direct-connect/requests/${requestId}`)
    );
    await page.goto(`/admin/direct-connect-requests?requestId=${encodeURIComponent(requestId)}`);
    const detailResponse = await detailResponsePromise;
    expect(detailResponse.ok()).toBe(true);
    const detail = await detailResponse.json();
    const requestStatus = String(detail.request?.status || "").trim();
    expect(
      ["open", "routed"],
      `Proof request ${requestId} must remain open or routed so assignment controls are actionable.`
    ).toContain(requestStatus);
    const requesterId = String(detail.requester?.id || "").trim();
    expect(requesterId, `Proof request ${requestId} must resolve its requester.`).not.toBe("");
    const originatingProfileSlug = String(detail.originatingProfile?.slug || "").trim();
    expect(
      originatingProfileSlug,
      `Proof request ${requestId} must retain its originating profile linkage.`
    ).not.toBe("");
    const assignments: AdminRecoveryAssignment[] = Array.isArray(detail.assignments)
      ? detail.assignments
      : [];
    expect(
      assignments.length,
      `Proof request ${requestId} must have at least one provider assignment.`
    ).toBeGreaterThan(0);
    const linkedAssignment = assignments
      .map((assignment) => ({
        assignment,
        profileUrl: resolveAssignmentProfileUrl(assignment),
      }))
      .find(({ profileUrl }) => Boolean(profileUrl));
    expect(
      linkedAssignment,
      `Proof request ${requestId} must have an assignment with a provider profile link.`
    ).toBeTruthy();
    if (!linkedAssignment) {
      throw new Error(`Proof request ${requestId} is missing a linked provider assignment.`);
    }

    await expect(page.getByRole("heading", { name: "Direct Connect Operations" })).toBeVisible();
    const selectedRequest = page.getByRole("region", {
      name: "Selected Direct Connect request",
    });
    await expect(selectedRequest).toBeVisible();
    await expect(
      selectedRequest.getByText(String(detail.request.title), { exact: true })
    ).toBeVisible();

    const requesterLink = selectedRequest.locator(
      `a[href="/profile/${encodeURIComponent(requesterId)}"]`
    );
    await expect(requesterLink).toBeVisible();

    await expect(
      selectedRequest.locator(`a[href="/u/${encodeURIComponent(originatingProfileSlug)}"]`)
    ).toBeVisible();
    const providerLink = selectedRequest
      .locator(`a[href="${linkedAssignment.profileUrl}"]`)
      .first();
    await expect(providerLink).toBeVisible();

    await expect(selectedRequest.getByText("Assign a specific provider")).toBeVisible();
    const providerSearch = selectedRequest.getByLabel("Search provider for manual assignment");
    const manualReason = selectedRequest.getByLabel("Reason for manual provider assignment");
    await expect(providerSearch).toBeVisible();
    await expect(providerSearch).toBeEditable();
    await expect(manualReason).toBeVisible();
    await expect(manualReason).toBeEditable();

    const providerSearchTerm = String(
      linkedAssignment.assignment.provider?.name ||
        linkedAssignment.assignment.providerName ||
        linkedAssignment.assignment.contractorName ||
        linkedAssignment.assignment.workerName ||
        linkedAssignment.assignment.responderName ||
        (await providerLink.textContent()) ||
        ""
    ).trim();
    expect(
      providerSearchTerm.length,
      `Linked provider for request ${requestId} must expose a searchable name.`
    ).toBeGreaterThanOrEqual(2);
    const providerSearchResponsePromise = page.waitForResponse((response) => {
      if (response.request().method() !== "GET") return false;
      const url = new URL(response.url());
      return (
        url.pathname === "/api/business-providers/search" &&
        url.searchParams.get("query") === providerSearchTerm
      );
    });
    await manualReason.fill(`Authenticated ${proofLabel} recovery proof`);
    await expect(manualReason).toHaveValue(`Authenticated ${proofLabel} recovery proof`);
    await providerSearch.fill(providerSearchTerm);
    await expect(providerSearch).toHaveValue(providerSearchTerm);
    const providerSearchResponse = await providerSearchResponsePromise;
    expect(
      providerSearchResponse.ok(),
      `Provider search failed with HTTP ${providerSearchResponse.status()}.`
    ).toBe(true);
    const providerCandidates = await providerSearchResponse.json();
    expect(
      Array.isArray(providerCandidates) ? providerCandidates.length : 0,
      `Provider search for "${providerSearchTerm}" must return an actionable candidate.`
    ).toBeGreaterThan(0);
    const assignProviderButton = selectedRequest
      .getByRole("button", { name: "Assign provider" })
      .first();
    await expect(assignProviderButton).toBeVisible();
    await expect(assignProviderButton).toBeEnabled();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    await testInfo.attach(`direct-connect-admin-recovery-${proofLabel}-success`, {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
  };

  test("shows actionable request, business, and provider detail on desktop", async ({
    page,
  }, testInfo) => {
    await verifyRequestDetail(page, { width: 1440, height: 900 }, "desktop", testInfo);
  });

  test("keeps the same operator controls usable on mobile", async ({ page }, testInfo) => {
    await verifyRequestDetail(page, { width: 390, height: 844 }, "mobile", testInfo);
  });
});
