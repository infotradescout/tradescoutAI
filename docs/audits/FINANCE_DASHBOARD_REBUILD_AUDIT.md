# Finance Dashboard Rebuild Audit

Date: 2026-05-13
Owner: TradeScout product/engineering
Scope: `/finances`, finance subpages, accounting APIs, and Scout finance handoff language.
Product target: TradeScout Finances should become a practical QuickBooks replacement for local operators, contractors, and sellers.

## Law Integrity

| Statement | Classification | Notes |
| --- | --- | --- |
| Scout and finance surfaces must not imply invoices, payments, records, payroll, tax filings, or bank movement happened without explicit user approval. | enforced | Current write APIs require authenticated user actions; UI copy still needs tighter review language. |
| Finance visibility must not create contact access or lead sale behavior. | enforced | Finance pages are owner workspaces and must not bypass Intent -> Decision Card -> Contact. |
| Finance dashboards may show business summaries from the user's own documents, but must not present unfinished bookkeeping as full accounting automation. | policy_target | Current dashboard copy mixes "ledger", "workspace", "reports", and "payroll" before the system is complete. The long-term target is QuickBooks replacement, but claims must follow shipped capability. |
| TradeScout monetization for every on-platform purchase, now and in the future, is a flat $1 transaction fee paid to TradeScout, not paid access, paid ranking, lead selling, or percentage take-rate economics. | enforced | Profile-offer purchases attach the $1 fee as `platform_fee`, receipt line, order status line, and accounting metadata. Procurement and inspection checkouts include the same line-item fee; legacy payment paths are being normalized to the shared policy constant. |
| Payroll, banking, tax, reconciliation, and true double-entry bookkeeping are not complete production systems yet. | temporary_exception | Owner: product/engineering. Rationale: current pages are placeholders or document summaries. Removal date: 2026-08-01, after rebuild plan chooses ship scope or removes claims. |

## Current Reality

The `/finances` landing page is still `client/src/pages/accounting.tsx`. It is not a focused dashboard. It is a long legacy workspace that contains:

- summary cards
- chart
- recent invoices
- recent money activity
- embedded clients section
- embedded materials handoff
- embedded estimates handoff
- embedded invoice creation/listing
- embedded jobs area
- embedded employees/payroll/expenses/vendors/bank/reports/settings sections

Most of those now have dedicated routes:

- `/finances/invoices`
- `/finances/expenses`
- `/finances/clients`
- `/finances/materials`
- `/finances/estimates`
- `/finances/jobs`
- `/finances/employees`
- `/finances/payroll`
- `/finances/vendors`
- `/finances/bank-accounts`
- `/finances/reports`
- `/finances/records`
- `/finances/settings`

So the current dashboard is trying to be both a landing dashboard and a tabbed application. That makes it feel unfocused, stale, and heavier than the actual state of the bookkeeping system.

## Backend Reality

The available accounting backend is document-centered, not a full bookkeeping engine.

Existing useful surfaces:

- `/api/accounting/reports/summary`
  - invoice count
  - paid/unpaid count
  - billed amount
  - paid amount
  - unpaid amount
  - total expenses
  - simple net
  - monthly billed/paid trend
- `/api/accounting/job-flows`
  - job groups from accounting documents
  - stage
  - invoiced/paid/unpaid/expenses/simple net
  - document counts
- `/api/accounting/standalone-invoices`
- `/api/accounting/expenses`
- `/api/accounting/records`
- `/api/accounting/clients`
- `/api/accounting/books-foundation`
  - initializes the user's finance profile
  - seeds starter chart-of-accounts records
  - reports ledger/reconciliation/automation readiness
  - exposes proposed accounting automation from connected surfaces

Missing for a serious bookkeeping product:

- cash basis vs accrual basis mode
- accounts chart
- double-entry journal validation
- reconciliation status
- bank feed import/sync
- accounts payable aging
- accounts receivable aging with due dates
- sales tax handling
- payroll liabilities
- contractor/vendor tax docs
- receipt attachment integrity
- audit trail per record
- close period/month-end workflow
- category rules and review queue
- profit by job with labor/material allocation

## Product Problem

The current dashboard answers "what pages exist?" better than "what should I do with my money today?"

That is the wrong center of gravity. A contractor, seller, or local operator needs a working cockpit:

- What am I owed?
- What do I owe?
- What did I collect?
- Which jobs are profitable or bleeding?
- Which records are missing information?
- What needs review before I send, mark paid, post, export, or pay?
- What can Scout help organize, without taking irreversible action?

If the goal is QuickBooks replacement, the current system is missing the accounting core. The existing product can record finance documents, but it does not yet maintain books.

## QuickBooks Replacement Bar

TradeScout Finances needs to cover these first-class systems before it can credibly replace QuickBooks:

- company setup: legal name, business type, fiscal year, tax settings, accounting basis
- chart of accounts: assets, liabilities, equity, income, cost of goods sold, expenses
- double-entry ledger: every money event posts balanced debits and credits
- accounts receivable: estimates, invoices, payments, credits, aging, statements
- accounts payable: bills, vendors, purchase orders, bill payments, aging
- banking: connected/imported transactions, matching, categorization, reconciliation
- job costing: revenue, labor, materials, subcontractors, overhead, margin by job
- sales tax: taxable items, rates, liabilities, filings/export support
- payroll boundary: employees, contractors, wages, reimbursements, payroll liabilities, tax docs
- inventory/materials: purchases, stock, job allocation, cost tracking
- audit trail: who changed what, when, before/after values, source document
- reporting: P&L, balance sheet, cash flow, AR aging, AP aging, general ledger, trial balance
- accountant mode: exports, close periods, lock dates, adjusting entries, review notes
- permissions: owner, bookkeeper, accountant, employee, client/vendor-limited roles

The rebuild should not imitate QuickBooks' clutter. It should replace the jobs-to-books workflow with a cleaner TradeScout model:

- job and county context built in
- invoices, materials, Exchange purchases, Direct Connect jobs, and HomeScout work can become books-ready records
- Scout can classify, flag missing context, and prepare drafts
- user or authorized bookkeeper approves every post, payment, send, export, and reconciliation

## Connected Automation Target

Hiring and collaboration events must become accounting drafts automatically.

Initial connected source:

- Direct Connect provider acceptance creates an `accounting_automation_events` proposal tied to the accepted assignment and work request.
- Fixed-price profile offers create accounting proposals from buyer intent:
  - service purchases create guided Scout work requests plus seller review events
  - item purchases create receipt and shipping/fulfillment records plus seller review events

Required connected sources:

- Connections/contact acceptance: create a relationship-ready customer/vendor context, but no invoice until work exists.
- Scout: create reviewable bookkeeping prep when Scout helps scope a job, invoice, expense, material run, or record.
- Exchange/profile sales: create draft purchase/sale, receipt, shipping, and inventory records from approved marketplace transactions.
- HomeScout/Home Vault: connect inspection, repair, sell-prep, and property work to job costing.
- Procurement/Supply Run: connect material orders to job costs and AP.

## Target Dashboard

The `/finances` landing page should become a command center, not a mini version of every subpage.

Recommended first viewport:

1. Money snapshot
   - Collected
   - Outstanding
   - Expenses
   - Simple net
   - Explicit label: "simple document summary", not "full books"

2. Action queue
   - draft invoices to review
   - unpaid invoices
   - expenses missing category/vendor/job
   - records missing reference or job link
   - jobs with expenses but no invoice
   - jobs with invoice but no payment/receipt

3. Job profitability
   - latest jobs
   - invoiced
   - expenses
   - simple net
   - next action

4. Records health
   - invoices
   - expenses
   - bills
   - purchase orders
   - payments
   - journal entries
   - missing fields count

5. Rebuild banner
   - Honest note that chart of accounts, bank sync, payroll, taxes, reconciliation, and full ledger automation are not finished.
   - Buttons to Records, Reports, Invoices, Expenses, Jobs.

6. Books foundation
   - Accounting basis
   - Chart of accounts status
   - Bank reconciliation status
   - Tax/payroll readiness
   - Accountant export readiness

## UX Direction

The finance dashboard should feel operational and quiet:

- dense but readable
- no marketing hero
- no giant decorative cards
- no fake "AI finance" claims
- fewer nav descriptions
- more status, aging, review, and next actions
- all irreversible actions stay behind review

The landing page should not contain full create forms for every finance object. Creation belongs in the dedicated pages unless the dashboard is showing a focused "needs review" item.

## Rebuild Plan

Phase 1: Stabilize the current dashboard

- Replace `accounting.tsx` first viewport with a focused command center.
- Keep all existing feature routes alive.
- Remove embedded duplicate sections from the dashboard only after each route has equivalent access.
- Add honest "bookkeeping rebuild" status copy.
- Add action cards from existing document data.
- Add books-foundation migration/API for profiles, accounts, journal entries, journal lines, reconciliation sessions, audit events, and automation proposals.
- Wire Direct Connect accepted assignments into proposed accounting automation events.
- Add fixed-price profile offers so seller services/items can be purchased from profiles and flow into work requests, receipts, shipping status, and accounting review.
- Connect provider onboarding to the finance foundation by showing books readiness and profile-offer setup in `/offer-services`.
- Surface profile purchase review back in provider setup so sellers can see job/receipt/shipping/bookkeeping status after buyer intent.
- Capture buyer quantity and required shipping details on public profile item purchases before creating receipt/shipping/accounting-review records.

Phase 2: Make the data useful

- Add a dashboard API that returns:
  - snapshot totals
  - action queue
  - recent job profitability rows
  - record health
  - unsupported capability flags
- Stop recomputing dashboard intelligence separately in each page.

Phase 3: Rebuild bookkeeping

- Choose cash/accrual scope.
- Add chart of accounts.
- Add journal entry model and balanced-entry validation.
- Add reconciliation and bank import strategy.
- Add vendor/payable flows.
- Add tax/payroll boundary rules.
- Add export formats that match real accountant workflows.

Phase 4: Replace QuickBooks for real

- Add accountant roles and firm/client access.
- Add lock periods and audit trail.
- Add full financial statements.
- Add bank matching and reconciliation workflows.
- Add recurring invoices, bills, and rules.
- Add sales tax liability tracking.
- Add payroll/provider integration or explicitly bounded payroll module.
- Add migration/import from CSV and common accounting exports.

## Immediate Next Work

1. Turn `/finances` into a clean command center using existing APIs.
2. Keep `/finances/invoices`, `/finances/expenses`, `/finances/records`, `/finances/jobs`, and `/finances/reports` as the real work pages.
3. Add a visible rebuild-status panel so the product is honest about what is not finished.
4. Add a "Books foundation" panel that names the QuickBooks-replacement gaps directly.
5. Add Scout handoff copy that says "organize/review/open" instead of implying finance automation.
