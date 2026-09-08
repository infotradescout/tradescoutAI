import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("accounting job flow contracts", () => {
  it("requires explicit lineage on every null-FK accounting selector or mutation", () => {
    const source = read("server/invoicingDocumentsRouter.ts");
    const nullFkSelector = "job_id IS NULL";
    const standalonePredicate = "permissions->>'lineageKind' = 'standalone_accounting'";
    const selectorOffsets = [...source.matchAll(new RegExp(nullFkSelector, "g"))].map(
      (match) => match.index ?? -1
    );

    expect(selectorOffsets.length).toBeGreaterThanOrEqual(10);
    for (const offset of selectorOffsets) {
      const queryEnd = source.indexOf("`", offset);
      expect(queryEnd).toBeGreaterThan(offset);
      const query = source.slice(offset, queryEnd);
      const isStandalone = query.includes(standalonePredicate);
      const isCanonicalProfileOfferReceipt =
        query.includes("permissions->>'lineageKind' = 'profile_offer_purchase'") &&
        query.includes("permissions->>'source' = 'profile_offer_purchase'") &&
        query.includes("payload->>'profileOfferPurchaseId' = $4");
      expect(isStandalone || isCanonicalProfileOfferReceipt).toBe(true);
    }

    expect(source).toContain("documentLineagePermissions(PROFILE_OFFER_PURCHASE_LINEAGE");
    expect(source).toContain('source: "profile_offer_purchase"');
    expect(source).toContain(
      "AND (job_id IS NOT NULL OR permissions->>'lineageKind' = 'standalone_accounting')"
    );
    expect(source).toContain("left(payload->>'accountingGroupId', 5) = 'acct_'");
    expect(source).not.toContain("payload->>'accountingGroupId' LIKE 'acct_%'");
  });

  it("exposes a canonical accounting job-flow endpoint", () => {
    const source = read("server/invoicingDocumentsRouter.ts");

    expect(source).toContain('"/api/accounting/job-flows"');
    expect(source).toContain("resolveJobFlowStage");
    expect(source).toContain(
      "type IN ('ESTIMATE', 'CONTRACT', 'INVOICE', 'RECEIPT', 'EXPENSE', 'BILL', 'PURCHASE_ORDER', 'CREDIT_NOTE', 'PAYMENT', 'JOURNAL_ENTRY')"
    );
    expect(source).toContain("res.json({ jobs: flows });");
  });

  it("finance job and estimate pages consume the canonical job-flow endpoint", () => {
    const jobsPage = read("client/src/pages/finances-jobs.tsx");
    const estimatesPage = read("client/src/pages/finances-estimates.tsx");

    expect(jobsPage).toContain('queryKey: ["/api/accounting/job-flows"]');
    expect(jobsPage).toContain("stageLabelMap");
    expect(estimatesPage).toContain('queryKey: ["/api/accounting/job-flows"]');
    expect(estimatesPage).toContain("Estimate pipeline");
    expect(jobsPage).not.toContain("/deal-room/");
    expect(estimatesPage).not.toContain("/deal-room/");
  });

  it("supports linking standalone invoices and expenses to an existing accounting job", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const invoicesPage = read("client/src/pages/finances-invoices.tsx");
    const expensesPage = read("client/src/pages/finances-expenses.tsx");

    expect(serverSource).toContain("jobId: requestedJobId");
    expect(serverSource).toContain("INVALID_ACCOUNTING_JOB_ID");
    expect(serverSource).toContain("ACCOUNTING_JOB_NOT_FOUND");
    expect(invoicesPage).toContain("jobId: linkedJobId.trim() || undefined");
    expect(expensesPage).toContain("jobId: linkedJobId.trim() || undefined");
    expect(invoicesPage).toContain("Link existing job ID (optional)");
    expect(expensesPage).toContain("Link existing job ID (optional)");
  });

  it("supports finance-native estimate and contract creation", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const estimatesPage = read("client/src/pages/finances-estimates.tsx");

    expect(serverSource).toContain('"/api/accounting/standalone-estimate"');
    expect(serverSource).toContain('"/api/accounting/standalone-contract"');
    expect(serverSource).toContain("INVALID_ESTIMATE_TOTAL");
    expect(serverSource).toContain("INVALID_CONTRACT_TOTAL");
    expect(estimatesPage).toContain("Create estimate");
    expect(estimatesPage).toContain("Create contract draft");
    expect(estimatesPage).toContain('fetch("/api/accounting/standalone-estimate"');
    expect(estimatesPage).toContain('fetch("/api/accounting/standalone-contract"');
  });

  it("supports finance-native standalone receipt creation", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const invoicesPage = read("client/src/pages/finances-invoices.tsx");

    expect(serverSource).toContain('"/api/accounting/standalone-receipt"');
    expect(serverSource).toContain("INVALID_RECEIPT_TOTAL");
    expect(invoicesPage).toContain("Standalone receipt record");
    expect(invoicesPage).toContain('fetch("/api/accounting/standalone-receipt"');
  });

  it("supports additional bookkeeping record types beyond the core lifecycle", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const invoicesPage = read("client/src/pages/finances-invoices.tsx");
    const reportsPage = read("client/src/pages/finances-reports.tsx");

    expect(serverSource).toContain('"/api/accounting/standalone-record"');
    expect(serverSource).toContain('"/api/accounting/records"');
    expect(serverSource).toContain("UNSUPPORTED_ACCOUNTING_RECORD_TYPE");
    expect(serverSource).toContain("BILL");
    expect(serverSource).toContain("PURCHASE_ORDER");
    expect(serverSource).toContain("CREDIT_NOTE");
    expect(serverSource).toContain("PAYMENT");
    expect(serverSource).toContain("JOURNAL_ENTRY");
    expect(invoicesPage).toContain("Other bookkeeping records");
    expect(invoicesPage).toContain('fetch("/api/accounting/standalone-record"');
    expect(reportsPage).toContain("fetch(`/api/accounting/records?${params.toString()}`");
  });

  it("exposes a dedicated finances records ledger route", () => {
    const routesSource = read("client/src/AppRoutes.tsx");
    const recordsPage = read("client/src/pages/finances-records.tsx");

    expect(routesSource).toContain(
      'const FinancesRecords = React.lazy(() => import("./pages/finances-records"));'
    );
    expect(routesSource).toContain('<Route path="/finances/records">');
    expect(recordsPage).toContain("fetch(`/api/accounting/records?${params.toString()}`");
    expect(recordsPage).toContain('fetch("/api/accounting/standalone-record"');
  });

  it("supports dedicated accounting client management", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const clientsPage = read("client/src/pages/finances-clients.tsx");

    expect(serverSource).toContain('"/api/accounting/clients"');
    expect(serverSource).toContain('"/api/accounting/clients/:id"');
    expect(serverSource).toContain('"/api/accounting/clients/:id/rename-ledger"');
    expect(clientsPage).toContain("fetch(`/api/accounting/clients?${params.toString()}`");
    expect(clientsPage).toContain('fetch("/api/accounting/clients"');
    expect(clientsPage).toContain("fetch(`/api/accounting/clients/${opts.id}`");
    expect(clientsPage).toContain("fetch(`/api/accounting/clients/${opts.id}/rename-ledger`");
    expect(clientsPage).toContain("Add client profile");
  });

  it("starts the books foundation needed for a QuickBooks replacement", () => {
    const migration = read("migrations/0094_accounting_books_foundation.sql");
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const dashboard = read("client/src/pages/accounting.tsx");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS accounting_profiles");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS accounting_accounts");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS accounting_journal_entries");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS accounting_journal_lines");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS accounting_reconciliation_sessions");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS accounting_audit_events");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS accounting_automation_events");
    expect(migration).toContain("'direct_connect', 'connections', 'scout'");
    expect(migration).toContain(
      "automation_state IN ('proposed', 'reviewed', 'posted', 'skipped', 'error')"
    );

    expect(serverSource).toContain('"/api/accounting/books-foundation"');
    expect(serverSource).toContain("DEFAULT_ACCOUNTING_ACCOUNTS");
    expect(serverSource).toContain("sourceCoverage");
    expect(dashboard).toContain('queryKey: ["/api/accounting/books-foundation"]');
    expect(dashboard).toContain("Connected automation");
    expect(dashboard).toContain("Books foundation");
  });

  it("proposes accounting automation when a Direct Connect provider accepts work", () => {
    const directConnectSource = read("server/routes/direct-connect.ts");

    expect(directConnectSource).toContain("proposeAccountingAutomationFromDirectConnect");
    expect(directConnectSource).toContain("direct_connect:assignment_accepted");
    expect(directConnectSource).toContain(
      "'Provider accepted a Direct Connect request; prepare reviewable job accounting.'"
    );
    expect(directConnectSource).toContain(
      "Draft accounting work only. User review is required before posting"
    );
    expect(directConnectSource).toContain("source_surface");
    expect(directConnectSource).toContain("'direct_connect'");
  });

  it("exposes an automation review inbox that can skip or prepare draft invoices", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const recordsPage = read("client/src/pages/finances-records.tsx");

    expect(serverSource).toContain('"/api/accounting/automation-events"');
    expect(serverSource).toContain('"/api/accounting/automation-events/:id/skip"');
    expect(serverSource).toContain('"/api/accounting/automation-events/:id/prepare-invoice"');
    expect(serverSource).toContain('"/api/accounting/automation-events/:id/prepare-expense"');
    expect(serverSource).toContain("Prepared draft invoice for review.");
    expect(serverSource).toContain("Prepared expense record for review.");
    expect(serverSource).toContain("reviewRequired: true");
    expect(serverSource).toContain("proposeAccountingAutomationFromDocument");
    expect(serverSource).toContain("estimate_created");
    expect(serverSource).toContain("material_list_created");
    expect(serverSource).toContain("expense_created");
    expect(recordsPage).toContain("Automation review inbox");
    expect(recordsPage).toContain("/api/accounting/automation-events?state=proposed");
    expect(recordsPage).toContain("Prepare invoice");
    expect(recordsPage).toContain("Prepare expense");
    expect(recordsPage).toContain("Skip");
    expect(recordsPage).toContain("review before");
  });

  it("supports manual QuickBooks-style accounts and balanced journal entries", () => {
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const recordsPage = read("client/src/pages/finances-records.tsx");

    expect(serverSource).toContain('"/api/accounting/accounts"');
    expect(serverSource).toContain('"/api/accounting/journal-entries"');
    expect(serverSource).toContain("accounting_journal_lines");
    expect(serverSource).toContain("JOURNAL_ENTRY_NOT_BALANCED");
    expect(serverSource).toContain("manual_journal_entry_created");
    expect(recordsPage).toContain("Manual books tools");
    expect(recordsPage).toContain("Chart of accounts");
    expect(recordsPage).toContain("Manual journal entry");
    expect(recordsPage).toContain("General ledger entries");
    expect(recordsPage).toContain("Post journal entry");
    expect(recordsPage).toContain('queryKey: ["/api/accounting/accounts"]');
    expect(recordsPage).toContain('queryKey: ["/api/accounting/journal-entries"]');
  });

  it("connects fixed-price profile purchases to jobs, receipts, shipping, and accounting review", () => {
    const migration = read("migrations/0095_profile_offers_finance_bridge.sql");
    const serverSource = read("server/invoicingDocumentsRouter.ts");
    const profilePage = read("client/src/pages/PublicProfileView.tsx");
    const exchangeRoutes = read("server/routes.ts");
    const exchangeMainPage = read("client/src/pages/exchange.tsx");
    const exchangeCategoryPage = read("client/src/pages/exchange/ExchangeCategoryPage.tsx");
    const appRoutes = read("client/src/AppRoutes.tsx");
    const orderStatusPage = read("client/src/pages/profile-purchase-status.tsx");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS profile_offers");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS profile_offer_purchases");
    expect(migration).toContain("offer_type varchar");
    expect(migration).toContain("payment_status varchar");
    expect(migration).toContain("shipping_cost numeric");
    expect(migration).toContain("platform_fee numeric");
    expect(migration).toContain("CHECK (platform_fee = 1.00)");
    expect(migration).toContain("seller_amount numeric");
    expect(migration).toContain("work_request_id varchar REFERENCES work_requests");
    expect(migration).toContain("receipt_document_id varchar REFERENCES documents");
    expect(migration).toContain("shipping_status varchar");

    expect(serverSource).toContain('"/api/profile-offers"');
    expect(serverSource).toContain('"/api/profile-offers/mine"');
    expect(serverSource).toContain('"/api/profile-offers/:id"');
    expect(serverSource).toContain('"/api/profile-offers/:id/purchase"');
    expect(serverSource).toContain('"/api/profile-offer-purchases/:id"');
    expect(serverSource).toContain("viewerRole");
    expect(serverSource).toContain("Order status is visible to purchase participants only");
    expect(serverSource).toContain('"/api/profile-offer-purchases/:id/fulfillment-action"');
    expect(serverSource).toContain('"/api/profile-offer-purchases/:id/order-message"');
    expect(serverSource).toContain("containsContactLeak");
    expect(serverSource).toContain("ORDER_MESSAGE_CONTACT_DETAILS_BLOCKED");
    expect(serverSource).toContain("orderMessageBoundary");
    expect(serverSource).toContain("proposeProfileOfferFulfillmentAutomation");
    expect(serverSource).toContain("profile_offer_fulfillment_action");
    expect(serverSource).toContain("accept_order");
    expect(serverSource).toContain("mark_shipped");
    expect(serverSource).toContain("mark_refunded");
    expect(serverSource).toContain("Seller actions update review status only");
    expect(serverSource).toContain("service_duration_minutes");
    expect(serverSource).toContain("item_stock_quantity");
    expect(serverSource).toContain("shipping_cost");
    expect(serverSource).toContain("TRADESCOUT_TRANSACTION_FEE_USD");
    expect(serverSource).toContain("platformFeeLabel: TRADESCOUT_TRANSACTION_FEE_LABEL");
    expect(serverSource).toContain("sellerAmount");
    expect(serverSource).toContain("platformRevenueModel");
    expect(serverSource).toContain("normalizeProfileOfferMetadata");
    expect(serverSource).toContain("itemCategory");
    expect(serverSource).toContain("taxCategory");
    expect(serverSource).toContain("fulfillmentPolicy");
    expect(serverSource).toContain("returnPolicy");
    expect(serverSource).toContain("imageUrls");
    expect(serverSource).toContain("SHIPPING_ADDRESS_REQUIRED");
    expect(serverSource).toContain("postalCode");
    expect(serverSource).toContain("profile_offer_service_purchase");
    expect(serverSource).toContain("profile_offer_item_purchase");
    expect(serverSource).toContain("INSERT INTO work_requests");
    expect(serverSource).toContain("'scout'");
    expect(serverSource).toContain(
      "INSERT INTO documents (job_id, type, status, version, payload, permissions, created_by)"
    );
    expect(serverSource).toContain("'RECEIPT'");
    expect(serverSource).toContain("shippingStatus");
    expect(serverSource).toContain("contactBoundary");
    expect(serverSource).toContain("User review is required before posting");

    expect(profilePage).toContain("/api/profile-offers?sellerUserId=");
    expect(profilePage).toContain("fetch(`/api/profile-offers/${encodeURIComponent");
    expect(profilePage).toContain("Start Job");
    expect(profilePage).toContain("Buy");
    expect(profilePage).toContain("Review purchase");
    expect(profilePage).toContain("purchaseQuantity");
    expect(profilePage).toContain("shippingAddress");
    expect(profilePage).toContain("Shipping details needed");
    expect(profilePage).toContain("Not enough stock");
    expect(profilePage).toContain("Total for review");
    expect(profilePage).toContain("TRADESCOUT_TRANSACTION_FEE");
    expect(profilePage).toContain("TRADESCOUT_TRANSACTION_FEE_LABEL");
    expect(profilePage).toContain("Seller subtotal");
    expect(profilePage).toContain("Fulfillment:");
    expect(profilePage).toContain("Returns:");
    expect(profilePage).toContain("/profile-purchases/");
    expect(profilePage).toContain("No payment, contact release, posting, or shipping");
    expect(profilePage).toContain("Job flow created");

    expect(exchangeRoutes).toContain("listProfileOfferExchangeItems");
    expect(exchangeRoutes).toContain('sourceType: "profile_offer"');
    expect(exchangeRoutes).toContain("profile-offer-");
    expect(exchangeRoutes).toContain("publicProfilePath");
    expect(exchangeMainPage).toContain("isProfileOffer");
    expect(exchangeCategoryPage).toContain("isProfileOffer");

    const offerServicesPage = read("client/src/pages/offer-services.tsx");
    expect(offerServicesPage).toContain("fulfillmentActionMutation");
    expect(offerServicesPage).toContain("/fulfillment-action");
    expect(offerServicesPage).toContain("Confirm");
    expect(offerServicesPage).toContain("Mark paid");
    expect(offerServicesPage).toContain("Tracking #");
    expect(offerServicesPage).toContain("shipment handoff stay gated");
    expect(offerServicesPage).toContain("Item category");
    expect(offerServicesPage).toContain("Tax category");
    expect(offerServicesPage).toContain("Product image URLs");
    expect(offerServicesPage).toContain("Fulfillment policy");
    expect(offerServicesPage).toContain("Return policy");
    expect(offerServicesPage).toContain("TradeScout fee");
    expect(offerServicesPage).toContain("View order");
    expect(appRoutes).toContain(
      'const ProfilePurchaseStatus = React.lazy(() => import("./pages/profile-purchase-status"))'
    );
    expect(appRoutes).toContain('<Route path="/profile-purchases/:id">');
    expect(orderStatusPage).toContain("/api/profile-offer-purchases/");
    expect(orderStatusPage).toContain("Profile Purchase Status");
    expect(orderStatusPage).toContain("TRADESCOUT_TRANSACTION_FEE_LABEL");
    expect(orderStatusPage).toContain("Seller subtotal");
    expect(orderStatusPage).toContain("Tracking");
    expect(orderStatusPage).toContain("Order updates");
    expect(orderStatusPage).toContain("/order-message");
    expect(orderStatusPage).toContain("off-platform contact are blocked");
    expect(orderStatusPage).toContain(
      "Contact, payment movement, shipment handoff, and accounting posting remain review-gated"
    );
  });
});
