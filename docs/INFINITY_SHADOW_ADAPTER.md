# Infinity shadow adapter

Status: `temporary_exception`

Owner: TradeScout platform. Rationale: dual-write observations and preview
Selective Inheritance evaluations while local affiliate attribution and profile
mutation remain authoritative. Review/remove the exception after parity evidence
is accepted; target review date: 2026-10-18.

Configure `INFINITY_API_URL`, `INFINITY_API_KEY`, `INFINITY_TENANT_ID`, and
`INFINITY_PROGRAM_ID` to enable delivery. Missing configuration disables the
adapter. Delivery failures and the 1.5-second timeout fail open and never alter
redirect, signup, Direct Connect, reward, wallet, or payout behavior.

Only affiliate tags, route identifiers, event types, and opaque object hashes
are sent. IP addresses, user agents, email addresses, and payment values are not
sent.

Selective Inheritance uses Infinity's shared policy/evidence contract. This
adapter declares TradeScout's public-profile field allowlist and protects Direct
Connect, contact access, county assignments, owner identity, ranking, and
Trust/CVS from inheritance. Evaluations are preview-only; Infinity cannot apply
profile mutations. A current authoritative Screen Pass can support an allowed
field, but cannot bypass the policy or TradeScout's owner/admin apply gate.
