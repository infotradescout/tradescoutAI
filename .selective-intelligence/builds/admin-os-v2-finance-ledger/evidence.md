# TradeScout Admin OS v2 — Finance Ledger

## Owner outcome

Finance must be a clear transaction-evidence workspace, not a summary card wrapped around a second card containing a wide table.

The operator needs to:

- Select the server time window
- Separate credits and debits
- Filter by transaction type
- Search returned records by account, counterparty, reference, memo, type, or transaction identifier
- Inspect one transaction's complete stored evidence
- Keep wallet movement distinct from bank balances and recognized revenue

## Native workspace

The `finance` tool now uses:

- One finance summary strip
- One server-filter toolbar
- One local evidence search
- One expandable transaction list
- One direct path to Vault Contributions
- Honest loading, empty, and unavailable states

## Existing read authority

The workspace preserves:

- `GET /api/admin/finance/ledger`

The existing query parameters remain:

- `limit`
- `from`
- `to`
- `direction`
- `transactionType`

The page continues to display stored transaction ID, account user ID, counterparty user ID, direction, amount, transaction type, reference type, reference ID, memo, and creation time.

## Read-only boundary

The Finance Ledger remains read-only. It creates no wallet transaction, adjustment, payout, refund, contribution, invoice, commission, escrow event, or bank movement.

Vault Contributions remains a separate registered finance workspace at:

- `/admin/vault-contributions`

No Vault Contribution write path was moved into the ledger.

## Financial meaning

The server summary fields remain authoritative:

- Transaction count
- Total credits
- Total debits
- Balance delta

Balance delta is presented as credits minus debits inside the selected ledger window. It is not represented as:

- A bank account balance
- Available cash
- FDIC-insured funds
- Recognized revenue
- Net income
- Escrow balance
- Partner payout liability

The local unique-user, transaction-type, and reference-coverage values are presentation-only calculations over the returned transaction rows.

## Honest unavailable states

A failed ledger source remains unavailable. The page does not replace missing transactions, credits, debits, net movement, users, or transaction types with a successful zero.

## Preserved boundaries

This release does not change:

- Admin roles or permission middleware
- Wallet transaction schema
- Ledger amount units
- Credit or debit direction
- Reference ownership
- Transaction creation authority
- Vault Contributions
- Invoices
- Marketplace sales
- Affiliate commissions
- Partner payouts
- Procurement payments
- TradeScout Vault behavior
- Bank or payment-provider integration
- Partner records
- HomeID records
- Stone Core or inventory
- Marketplace approval records

## Release proof

Release requires:

- `finance` registered as a native Admin OS v2 surface
- Existing ledger route and filters preserved
- No finance mutation in the ledger component
- Financial meaning statement retained
- Production client and server bundle completion
- Schema preflight with no critical drift
- Production service startup
- Authenticated desktop and mobile inspection before final visual approval
