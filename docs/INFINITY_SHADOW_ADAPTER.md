# Infinity shadow adapter

Status: `temporary_exception`

Owner: TradeScout platform. Rationale: dual-write observations and preview
conversion evidence while local affiliate attribution remains authoritative.
Review/remove the exception after parity evidence is accepted; target review
date: 2026-10-18.

Configure `INFINITY_API_URL`, `INFINITY_API_KEY`, `INFINITY_TENANT_ID`, and
`INFINITY_PROGRAM_ID` to enable delivery. Missing configuration disables the
adapter. Delivery failures and the 1.5-second timeout fail open and never alter
redirect, signup, Direct Connect, reward, wallet, or payout behavior.

Only affiliate tags, route identifiers, event types, and opaque object hashes
are sent. IP addresses, user agents, email addresses, and payment values are not
sent.

This adapter does not send or apply profile inheritance. TradeScout's real
account-to-business-to-profile inheritance remains TradeScout-owned product
behavior with its existing human confirmation gates. Selective Intelligence
governs future convergence and drift review rather than acting as a central
product-data mutation runtime.
