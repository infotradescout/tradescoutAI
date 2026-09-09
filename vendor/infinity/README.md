# Infinity text contract

Eleven shared modules import `cleanString` from
`@tradescout-infinity/contracts/text`. These cover community, contractor photo
and promotion, handmade product, home listing, profile gallery, offer, portfolio
and service sharing, public business listings, and live-readiness checks. The
initial caller and ten additional paths are recorded in `provenance.json`.
The source owner is Infinity's existing
`packages/contracts/src/text.ts`. This function trims primitive strings and
returns an empty string for other values; it does not coerce, sanitize, or
truncate content.

The dependency is an npm package archive pinned by its content hash and lockfile
integrity. Docker receives the archive before dependency installation, and both
generated workspaces copy it. The `/text` export imports only the portable text
module. The production server bundles this module.

`provenance.json` identifies the archive, source and compiled module hashes, and
the pre-migration consumer revision. The archive is built from clean Infinity
commit `8898e5a94722be2bf55351dd9772af7bd2ca173d`, preserved in
[Infinity PR #14](https://github.com/infotradescout/tradescout-infinity/pull/14).
This is a reviewed-source adoption draft, with no registry publication, merge,
or production rollout.

To refresh the package, build `@tradescout-infinity/contracts` in its owning
repository, run `npm pack` from `packages/contracts`, record the new archive and
source hashes, update the consumer dependency and lockfile, then run the package
distribution and community-sharing tests. Do not edit the archive or create a
second helper in the consumer.

`reuse-proof.json` records the initial one-caller checkpoint. The current PR
description records validation for the latest commit and the wider adoption.
