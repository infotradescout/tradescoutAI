# Shared TradeScout Exchange public discovery — implementation checkpoint

Objective: Make every legitimately public Exchange listing discoverable regardless of seller or category. Owner clarified this is the general marketplace competing with Facebook Marketplace, eBay and OfferUp, not a JW/stone feature. Public viewing is not contact or purchase authorization.

Base branch/commit: main / ccfc116d9893107a6b1fda7fae1d211862b61a50 (completed logging repair; do not repeat it).
Current branch: fix/exchange-public-discovery-all-sellers-20260928; use the exact commit containing this checkpoint and recheck the PR before continuing.

Implemented source in this candidate: Shared public listing reader and projections using existing active/expiry/category and Trust/CVS exposure rules; same canonical Exchange detail URLs; visible first-response HTML with public facts and source-backed prices/schema; indexable hub/category pages with native pagination; a partitioned sitemap and LLM-readable listing index; a safe public photo path for signed retail publication photos. Registration precedes buyer-market filtering but leaves inquiry/contact/payment owners untouched. No seller-tier or named-owner discovery exception.

Changed but unverified: server integration, actual data/source parity, browser/hydration behavior, sitemap scale/withdrawal, and complete release acceptance. Prepared client detail changes remain local until the next commit; do not call this intermediate server slice deployable. Raw query/private data is not added to discovery. Existing signed public retail prices remain distinct from private supplier/member prices.

Files: server/services/exchangePublicDiscovery.ts; server/publicExchangeDiscoveryHtml.ts; server/routes/exchange-public-discovery.ts; server/routes/public-metadata.ts; server/tests/exchange-public-discovery.behavior.test.ts; this checkpoint. Client changes will follow on this same branch, not a parallel project.

Executed checks: TypeScript transpileModule syntax parsing of the seven prepared TS/TSX files passed locally. That is syntax-only, not a typecheck/build/test pass. No repository npm ci, full check/build, Vitest, native DB/browser or minimum-release gate has run on this candidate yet.
Tests invalidated: none count as integration/release evidence; any candidate changes require relevant checks.

Risks to resolve: all registry categories and ordinary/profile-offer/profile-catalog sources must be tested, not only stone. Withdrawal and inaccessible/publication-ineligible rows must stay out of pages/API/sitemaps. UI must not revert to noindex or require a market/account merely to read. Buyer-market selection and the existing Pensacola purchase exclusion remain action constraints, not global public discovery gates. Search engine or LLM inclusion cannot be guaranteed. No per-user profile/plan privilege is introduced. No stock assertion may be inferred merely from active publication.

External effects: feature branch and source objects only, plus one read-only source-inspection run on the existing isolated Render runner. No production config/data, accounts, offers, emails, prices, stock, payments or orders changed. No Desktop Commander or new service. Runner srv-dakrnom7bikc73fog3og has no provider/customer credentials; source clones belong in temporary directories and must be cleaned up. Do not run commands against the wrapper's old bootstrap commit as though it were the candidate.

Next exact action: publish the prepared client changes; run npm ci, full typecheck and targeted renderer/publication/client/contact regression tests on an exact candidate clone in the existing isolated runner. Then verify actual compiled app with an owned loopback database and desktop/mobile browser; run the unchanged strict minimum release contract before merge. Full git history/current origin/main is necessary for historical registry validation. Never weaken the gate or create workflows.

Do NOT repeat: PR729 logging recovery; arbitrary submissions as demand evidence; obsolete 0-of-96 publication diagnosis; broad repository rediscovery; stone-only storefront redesign; raw customer data in public evidence; production test submissions; additional hosted proof service.
