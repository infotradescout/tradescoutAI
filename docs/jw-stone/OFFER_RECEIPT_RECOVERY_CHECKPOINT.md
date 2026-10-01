# JW offer receipt recovery — resumable source checkpoint
Objective: Prevent sequential resubmission of a JW member offer when delivery or its receipt is uncertain. Preserve private fabricator access, Exchange-only homeowner rates, mixed-material bundle rules, contact gates, and payment-disabled pending offers.
Base branch/commit: GitHub main f086f181e2dd597d85eff0b5b7be60b5d4cbdac4, preserving About, stone, released email/JW, native receiver and ISSA changes.
Current branch/commit: jw-stone/offer-payment-acceptance-20261001; this checkpoint travels with the candidate commit. Parent remains f086f181.
Verified completed work: Independent source challenge reproduced the prior control-flow defect. Correction source has a synchronous mounted-draft retry guard, canonical semantic draft identity, strict nonempty string receipt ID, uncertain-state disabled CTA, and existing My Requests reconciliation link.
Changed but unverified work: All candidate runtime behavior and ten newly added regression cases. No test, typecheck, build, browser or production acceptance has run for this candidate.
Files changed:
- client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx — JW offer-only uncertain-receipt handling; generic request behavior retained.
- client/src/features/jw-stone/JwStoneOffer.test.tsx — ten added uncertain-receipt/rejection/equivalent-context cases.
- docs/jw-stone/OFFER_RECEIPT_RECOVERY_CHECKPOINT.md — this continuity record.
Tests/evidence already run: Source inspection only. Reviewer /root/jw_purchase_objector, independent fresh-context API GPT-6.1 Sol. Exact reviewed component blob a5e91ae88a1178c6958bdb988fb3add01e55dba0; test blob a939b94a095da0b46535671497eceb12e5407261.
Objections/dispositions:
- P2 sequential retry after malformed accepted receipt: sustained; corrected in source within mounted-draft scope.
- P2 recreated equivalent context released the lock: sustained; semantic key correction source-reviewed.
- P2 truthy malformed receipt requestId falsely confirmed success: sustained; string/trim validation source-reviewed.
Final Objector verdict: Pass for source checkpoint only. No further material source defect found within the bounded correction; runtime proof and release readiness unestablished.
Tests/evidence invalidated by later changes: Previous email/JW release evidence does not prove this new candidate. It remains historical evidence for unchanged behavior, not a new test pass.
Known blockers/risks: Unified exec transport disconnected after the clean new worktree was created. No repeated retries. Existing Desktop Commander lists the matching TSCommandCenter device Offline; no authentication/setup attempted. Therefore no usable execution/browser route was available.
External side effects and retry safety: Isolated GitHub task-branch source checkpoint only. No main merge/deploy, customer/order/stock/approval write, real email send, money movement, credentials/grants change, new infrastructure or paid service.
Limits: This prevents retries within a mounted semantic draft, including equivalent context recreation. It does not provide server-wide, reload or component-remount idempotency. It adds no commercial confirmation or payment integration and invents no payable total.
Local continuity: C:\Users\flavo\Documents\Codex\2026-09-30\task-11\jw-purchase-source is a clean worktree initially at f086f181 on the same named branch; the remote checkpoint was prepared through the authorized GitHub connector after local execution disconnected. Original jw-stone-source remains at e4587ee3, unchanged.
Next exact action: When execution is observed working, fetch this branch and checkout the exact checkpoint candidate in the isolated worktree. Run the real JwStoneOffer.test.tsx cases and affected Direct Connect component checks, then typecheck. Serve an isolated compiled fixture to prove uncertain accepted receipt produces one POST, pause/reconciliation and no success/payment claim on desktop and touch; prove known409 rejection can retry and valid receipt succeeds. Run the minimum release gate at the final integration boundary and obtain independent exact-source/rendered review before coordinating the shared TradeScout release window with parent.
Actions that must NOT be repeated: Old unchanged35/70 or prior email/JW release suites; local-mirror origin as production main; authentication loops; customer/provider sends as proof; inventory decrement; invented tax/freight/payable totals; release without fresh gates and shared-window coordination.
