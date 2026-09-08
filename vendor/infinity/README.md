# Infinity text contract

`shared/communityPostShare.ts` imports `cleanString` from
`@tradescout-infinity/contracts/text`. The source owner is Infinity's existing
`packages/contracts/src/text.ts`. This function trims primitive strings and
returns an empty string for other values; it does not coerce, sanitize, or
truncate content.

The dependency is an npm package archive pinned by its content hash and lockfile
integrity. Docker receives the archive before dependency installation, and both
generated workspaces copy it. The browser-safe `/text` export avoids the package
root's Node crypto dependency. The production server bundles this module.

`provenance.json` identifies the archive, source and compiled module hashes, and
the pre-migration consumer revision. The archive was built from an uncommitted
Infinity worktree; its recorded base revision alone does not reproduce that
source. Preserve and promote that source checkpoint before release. This is a
local adoption draft, with no registry publication or production rollout.

To refresh the package, build `@tradescout-infinity/contracts` in its owning
repository, run `npm pack` from `packages/contracts`, record the new archive and
source hashes, update the consumer dependency and lockfile, then run the package
distribution and community-sharing tests. Do not edit the archive or create a
second helper in the consumer.

`reuse-proof.json` records this migration's checks and remaining release gaps.
