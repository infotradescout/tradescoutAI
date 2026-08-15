# Security and Operations — Spatial Studio 1.4.0

## Trust boundaries

Catalog modules and safe public-name helpers are the only trusted stone identity sources. Local storage, URL/share state, imported images, numeric dimensions, and all user text are untrusted. Parsers allowlist keys, bound collection and string lengths, reject non-finite numbers, intersect stone IDs with the current eligible catalog, and fall back per field.

Public share state cannot contain contact details, address, notes, price/cost, source counts, internal anonymous labels, job IDs, or an availability assertion. The request boundary uses the existing validation and explicit submit action. Local save, share generation, camera movement, and catalog selection never open or submit contact.

## Rendering and dependency risk

The WebGL renderer is client-only and performs no arbitrary shader/code evaluation from shared state. Texture sources come from canonical same-origin asset paths. Rendering dependencies are pinned and included in existing dependency/security checks. WebGL failure preserves an accessible non-canvas summary and retry path; resource disposal prevents repeated scene changes from leaking GPU objects.

## Operations and release

No secret, new cookie, identity mode, database record, analytics event, payment, or public price is introduced. Image loading remains bounded to visible/selected assets. The release stays blocked until exact-revision build/test results, desktop/mobile/keyboard captures, WebGL recovery proof, no-price/no-private-data scans, inventory reconciliation, and independent review are recorded. No push, PR, merge, deploy, or live claim is authorized by this definition amendment.
