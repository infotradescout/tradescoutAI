const GIT_COMMIT_SHA = /^[a-f0-9]{40}$/;
const MIGRATION_ID = /^[a-z0-9][a-z0-9-]*$/;

export function migrationArgumentsForReadiness(markerReady, alwaysVerify = false) {
  if (!markerReady) return [];
  return alwaysVerify ? ["--verify-only"] : null;
}

export function deploymentRevisionFromEnvironment(environment = process.env) {
  const revision = String(environment.RENDER_GIT_COMMIT || "")
    .trim()
    .toLowerCase();
  if (!revision) return null;
  if (!GIT_COMMIT_SHA.test(revision)) {
    throw new Error("RENDER_GIT_COMMIT is not a full Git commit identity");
  }
  return revision;
}

export function deploymentMarkerObjectKey(manifest, deploymentRevision) {
  const migrationId = String(manifest?.migrationId || "");
  if (!MIGRATION_ID.test(migrationId)) throw new Error("Unsafe public media migration id");
  if (!GIT_COMMIT_SHA.test(String(deploymentRevision || ""))) {
    throw new Error("Invalid public media deployment revision");
  }
  return `public-media/deployments/${deploymentRevision}/${migrationId}.json`;
}

export function createDeploymentVerificationMarker(
  manifest,
  summary,
  deploymentRevision,
  verifiedAt = new Date().toISOString()
) {
  return {
    version: 1,
    migrationId: manifest.migrationId,
    deploymentRevision,
    entryDigestSha256: summary.digest,
    files: summary.files,
    bytes: summary.bytes,
    verifiedAt,
  };
}

export function deploymentVerificationMarkerMatches(marker, manifest, summary, deploymentRevision) {
  return (
    marker?.version === 1 &&
    marker?.migrationId === manifest.migrationId &&
    marker?.deploymentRevision === deploymentRevision &&
    marker?.entryDigestSha256 === summary.digest &&
    marker?.files === summary.files &&
    marker?.bytes === summary.bytes &&
    typeof marker?.verifiedAt === "string" &&
    Number.isFinite(Date.parse(marker.verifiedAt))
  );
}
