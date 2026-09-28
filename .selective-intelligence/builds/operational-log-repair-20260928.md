# TradeScout operational log recovery — 2026-09-28

Objective: Restore detailed, correlated TradeScout/JW Stone operational logs. No Desktop Commander, new Render services, GitHub Actions, or customer/provider transactions.
Base branch/commit: main / bbb2a2420e5935aa07855cb227823fc6c63c6f93.
Current branch: fix/restore-operational-log-detail-20260928, PR #729. This commit continues 201026a1c902d1735fd868fbf2026b3c61d103eb. Recheck current PR head before continuing.

## Verified completed work

The existing production service received only API_LOG_ALL=true in an earlier turn. Deployment dep-datcnbmk1f9s73fovlsg was verified live at unchanged bbb2a242 source. It restored fast successful API lines, not all diagnostic context. Do not repeat that configuration deployment.

The prepared continuation is now integrated into actual server/index.ts and the testable server/app.ts. Diagnostics attach before custom-domain routing, redirects, CORS and body parsers. The old selective API-only line is removed, while metrics/crawler recording is preserved. Shared logger calls inherit asynchronous request context. Server-generated correlation IDs remain separate from work request IDs. Completion/abort, host/path, session actor IDs, explicitly unverified UA hints, health probes, stable response error codes, validation paths and trusted business result IDs are recorded without copying raw request/response bodies or query values.

Actual tradepartner-express request validation and business branches annotate their diagnostic reason without changing public JSON or contact authority. Saved request IDs link to owner/business/requester notification outcomes, skip/failure reasons and provider acknowledgment IDs. A sent/provider-accepted state is not recipient delivery or a completed sale. Existing detailed provider logs remain.

The original serializer fix preserves Error message/stack/cause/code, AggregateError failures, falsy values and non-circular siblings. Recognized credential fields and common credential strings remain redacted. Direct console calls elsewhere are not globally rewritten or audited.

## Executed evidence

- Local Node 22.16.0: 45 logging/context tests passed (original 16 + 29 continuation cases).
- Reused existing isolated Render service srv-dakrnom7bikc73fog3og, no new service. It runs the supplied validation step in temporary source and forbids inherited provider/database credentials.
- Isolated deployment dep-datdloc9v7es738afv1g: applied the saved manifest to exact baseline blobs and copied hash-verified continuation files. npm ci with npm10.8.2 passed; 45 Node tests passed; full repository npm run check passed; 112 actual-route/notification regression tests passed. LOG729_INTEGRATION_CHECKED emitted 2026-09-28T21:25:49Z.
- Actual-route tests use the real Express route with synthetic DB/provider boundaries, not live customer or provider data. They prove matching X-Request-Id, committed workRequestId, email state, preserved 401 authority, precise phone validation issue, and no submitted contact in diagnostic records.
- Immutable uploaded entry/helper objects checked against the exact tested manifest in dep-date0uc9v7es738bjh1g: index blob ad46e68fc15e7f873bbe6eab444500ea7a26955a; app cc1a35a402a16180535cba65f6f95e1f345e270f; logger 0c97b93df0430cad199003b5587fb627fc3c94e8; context b42db7c9e8cc52e1e28cf4edf41bb21c08051f5e — all byte-identical.

Files changed: server/services/logger.ts; server/services/operationalRequestContext.ts; server/index.ts; server/app.ts; server/routes/tradepartner-express.ts; scripts/tests/logger-detail.test.mjs; scripts/tests/operational-request-context.test.mjs; server/tests/express-request-contact-delivery.behavior.test.ts; this checkpoint.

Changed but unverified work: strict exact-commit release/build/disposable-DB/browser acceptance and production deployment. Uploaded route/test source needs exact-candidate readback. Working-tree integration evidence is not a passing strict release gate.
Tests invalidated: original 16-test serializer-only evidence is superseded by 45-test integrated evidence. No further business behavior changes were made after the successful working-tree run; exact published candidate must still be checked.
Known risks: Historical omitted fields cannot be reconstructed from missing logs. Browser UA is not proof of a human, and a successful inquiry is not proof of a sale. The logger records all requests including health/assets; use probe/path filters rather than silently suppressing useful records. Field redaction is scoped, not a guarantee covering every direct console log in the repository.
External side effects: isolated runner DC_REQUESTER_STEP changed to execute temporary verification, which triggers only that runner's deployments. Public source Git blobs/PR branch updated. No customer messages/accounts/requests, production stock/prices/orders/payments or production environment changed in this continuation. Runner git push has no credentials; publish through connected GitHub writers only. Do not retry desktop or runner push.
Next exact action: Verify this immutable candidate's route/test bytes, execute the unchanged minimum-release contract with owned loopback Postgres and actual compiled-application/browser evidence, then merge PR #729 and verify the exact automatically deployed source plus live correlated GET logs. Record final release receipt in the PR.
Actions not to repeat: no broad architecture rediscovery, no checkout/payment detour, no new proof service, no GitHub Actions, no raw body dumps, no customer counts inferred from this log stream, no repeat API_LOG_ALL configuration deploy.
