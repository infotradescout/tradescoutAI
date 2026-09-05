# TradeScout recovery truth — September 5, 2026

Authority: Thomas's request to trace the system from its creation and recover a coherent, usable product against current intent. This is an evidence record, not approval to release.

## Scope observed

- Full available Git history and remote references fetched: 5,469 commits across 513 remote branches; 4,126 commits reachable from main at inspection.
- Main contains two initial histories, August 10, 2025 and December 3, 2025. Repository creation metadata alone does not describe the product's start.
- Recovery starts from `641052d772b1ab2e2dd5fa1dcbd1a78aa9ccba7c`; the existing Release 2 source is `0a72863b7285248a92df360c0da1624e26dfce5a`.
- Main inspected at `1db99fb635d04dddb0103266e14c354474ea7369`.
- 3,326 tracked text files scanned for UTF-8 validity. This is coverage of encoding and metadata, not a claim that every line or journey has been semantically verified.
- Live anonymous browser inspection covers the homepage, business finder, and request entry. No customer request or business contact was submitted.

## Confirmed compounded failures

1. **Corrupted saved recovery source.** The September 2 route-extraction commit `a562dd3e51eadf70226d514853f23229eae86dc3` changes `server/routes.ts` into invalid binary data at byte 393,216. The same blob survives at the required recovery starting head. TypeScript reports TS1490 (binary file), TS1128, and TS1005. The apparent loss of about 17,000 readable lines is not evidence that those routes were successfully extracted.
2. **Checks missed the broken application.** Fourteen focused identity tests passed while the complete TypeScript check failed to read that routing file. Source-string contracts alone cannot prove a working application.
3. **Live request navigation fails.** From the live finder, “Start a Tangipahoa request” opens the Businesses directory. Clicking “Start request” changes the address to `/direct-connect` but leaves that directory visible. Draft PR #574 already owns the query-navigation repair; its existence does not make the live journey repaired.
4. **Public entry demands extensive reading.** At a 1,363 × 936 desktop viewport, the homepage had 6,876 whitespace-delimited words, 221 heading elements, and 40,574 CSS pixels of document height. These are measurements, not a mobile usability verdict. The primary labels also vary between “Make A Request” and “Start request.”
5. **Shared intent record is scoped to one partner feature.** The repository-root Selective Intelligence intent contract identifies “JW Stone 2.0” and an August 15 planner release. That file cannot govern whole-TradeScout recovery or supersede Thomas's later pricing/source/contact decisions.
6. **Permission integration has additional interactions.** Independent execution of the real middleware with synthetic users reproduced trusted-device replacement of the effective target, an admin router intercepting impersonation exits, and a profile-account bypass using a stale session role. These require behavioral regression proof.

## Recovery of the corrupted source

The surviving route prefix was compared with the exact pre-corruption parent. Its intentional changes import three extracted owners and remove the local lead-routing helper. The unreadable suffix is recovered from that same parent, with the existing extracted Admin controls and business-owner projection retained as their sole implementations. The Admin-control body is compared exactly before replacing it with its registration. The local import projection is replaced with its existing extracted service, passing the previously captured context explicitly.

This is reconstruction of damaged source against the actual extraction artifacts. The older Release 2 route file is not copied over Release 0. Direct Connect, professional application storage, schema, lead routing, and Admin owner extractions remain in place. No feature is discarded to make the routing file appear smaller. Further route decomposition remains separate work.

## Release boundary

Keep the existing recovery pull request draft. No merge to main, deployment, production data, new hosting service, or GitHub Actions gate. Compile, build, database, behavior, browser, and live proof are separate states; any incomplete state stays explicit.
