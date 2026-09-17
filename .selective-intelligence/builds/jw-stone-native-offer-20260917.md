# JW Stone native offer verification — in progress
Objective: Execute actual built-client, registered-server-route and native-PostgreSQL offer journeys for one stone and the mixed-material cart on desktop/touch.
Base branch/commit: jw-stone/build-a-bundle-20260916 at 1aefac428e7cfdde502d2375d160c00fb957f02c; main 6031a5a2.
Current branch/commit: This enclosing commit; resolve HEAD. No product behavior or production configuration changes.
Verified completed work: New native driver and journey are syntax-checked; git diff --check passed.
Changed but unverified work: scripts/jw-stone-offer.native.mjs, scripts/jw-stone-offer-journey.mjs, and an opt-in synthetic two-material/seven-slab mode in scripts/jw-stone-workflow-fixture.ts. Native execution has not yet run.
Tests/evidence already run: node --check on both new .mjs files; no native pass asserted. Prior mocked browser/build proof is indexed in jw-stone-offer-verification-20260917.md and is not being relabelled as native proof.
Tests/evidence invalidated by later changes: Native fixture typecheck and original-mode compatibility need verification. Original customer driver was not changed.
External side effects and retry safety: Source/test/checkpoint changes only. The driver uses a fresh asserted ts_jw_workflow_test loopback database, synthetic accounts, stripped provider credentials and blocked external browser networking; production data is excluded.
Next exact action: Prepare isolated native checkout using the existing Ubuntu Node/browser runtime; install the locked dependencies and run scripts/jw-stone-offer.native.mjs. Retain failure evidence and fix observed fixture/application failures without weakening assertions.
Known blockers/risks: Native results, strict release gate, confirmation/counteroffers and final payable quote/payment handoff are not yet established. Mixed-material rates are a draft interpretation, not owner-approved commercial policy.
Actions that must NOT be repeated: No account-harness rebuild, broad pricing audit, mocked browser rerun on unchanged source, pricing changes, safety-check bypass, real customer contacts, payment activation, or main merge without gate/GO.
