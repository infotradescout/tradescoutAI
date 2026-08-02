# Security and Operations

## Trust boundaries, threat and abuse cases, access/session lifecycle

The public route trusts only checked-in canonical inventory and explicitly parsed URL values. Query parameters are allowlisted and length-bounded before use. Stone labels originate from safe public-name helpers; anonymous internal labels are excluded from URLs, storage, metadata, accessible text, analytics labels, and inquiry copy.

Wishlist storage is untrusted input. Parsing validates the version and string ID list, enforces a maximum, deduplicates, intersects with eligible canonical IDs, and catches read and write failures. No account, session, entitlement, or cross-user data is introduced.

Direct Connect remains a separate deliberate trust boundary. Opening its panel is not submission. The existing authenticated or guest contact lifecycle and server validation remain authoritative.

## Secrets, dependencies, privacy lifecycle, telemetry, and compliance owner

No secret, cookie, identity field, contact record, analytics event, or new dependency is required for discovery or wishlist persistence. Local storage contains stable eligible stone IDs only. The UI makes no tracking, reservation, or ordering claim.

Existing TradeScout privacy and Direct Connect owners retain responsibility for inquiry records. This feature does not add public phone or email surfaces, price data, or personally identifiable wishlist content.

## Capacity, SLOs, RPO/RTO, deployment, rollback, restore, and incident response

The catalog is static and bounded to the current inventory scale. Image loading uses browser-native lazy behavior outside the leading visual. Wishlist size is capped. No new backend capacity or recovery objective is created.

The build stops at an unmerged draft pull request. A later release must confirm exact-head production build, full regression suite, desktop and mobile render evidence, route/profile separation, and production health. Rollback is a normal application revert; there is no database rollback. Any synthetic-name, price, origin, route, or forced-contact leak is release-blocking and requires immediate route rollback or feature disablement.
