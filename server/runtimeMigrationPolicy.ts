export type MigrationHashDisposition = "current" | "adopt" | "apply" | "refuse";

export function classifyMigrationHashDisposition(input: {
  currentHash: string;
  predecessorHashes: string[];
  recordedHash: string | null;
  preexistingDatabase: boolean;
}): MigrationHashDisposition {
  if (input.recordedHash === input.currentHash) return "current";
  if (input.recordedHash && input.predecessorHashes.includes(input.recordedHash)) return "adopt";
  if (input.preexistingDatabase && input.predecessorHashes.length > 0) return "refuse";
  return "apply";
}
