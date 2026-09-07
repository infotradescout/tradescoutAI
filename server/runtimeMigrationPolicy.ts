export type MigrationHashDisposition = "current" | "adopt" | "apply" | "refuse";

// Exact identities of the reviewed 0126 absent-target-only repair. Existing
// business effects are unchanged, so an actually completed predecessor needs
// neither SQL replay nor a fabricated second completion record. Binding BOTH
// sides prevents this exception from accepting unrelated future SQL changes.
const publicationRepairHashes = new Set([
  "b8607b0d8cfcdbb054cbcdbf22dd2b85ed6d5c4d1e013941d6e609e17f24963b",
  "6f9b9263cd66550eb5f881075a55ad9449b8f041f1c632cd56ea1f80d290a93e",
]);
const completedPublicationHashes = new Set([
  "3c897157558522274755a3032dee2157f45cf64815b8f976a0649ac152650f00",
  "23c7e6cb06e116450ec3b064ede08438ab4d63f3a174df95c7e0120777fc88ff",
]);

export function classifyMigrationHashDisposition(input: {
  currentHash: string;
  predecessorHashes: string[];
  recordedHash: string | null;
  preexistingDatabase: boolean;
}): MigrationHashDisposition {
  if (input.recordedHash === input.currentHash) return "current";
  if (
    input.recordedHash &&
    publicationRepairHashes.has(input.currentHash) &&
    completedPublicationHashes.has(input.recordedHash) &&
    input.predecessorHashes.includes(input.recordedHash)
  ) return "current";
  if (input.recordedHash && input.predecessorHashes.includes(input.recordedHash)) return "adopt";
  if (input.preexistingDatabase && input.predecessorHashes.length > 0) return "refuse";
  return "apply";
}
