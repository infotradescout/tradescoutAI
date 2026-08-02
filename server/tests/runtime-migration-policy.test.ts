import { describe, expect, it } from "vitest";
import { classifyMigrationHashDisposition } from "../runtimeMigrationPolicy";

const currentHash = "current";
const predecessorHashes = ["old-one", "old-two"];

describe("runtime migration hash policy", () => {
  it("skips a migration whose current hash is already recorded", () => {
    expect(
      classifyMigrationHashDisposition({
        currentHash,
        predecessorHashes,
        recordedHash: currentHash,
        preexistingDatabase: true,
      })
    ).toBe("current");
  });

  it("adopts a repaired hash when an explicit predecessor is recorded", () => {
    expect(
      classifyMigrationHashDisposition({
        currentHash,
        predecessorHashes,
        recordedHash: "old-two",
        preexistingDatabase: true,
      })
    ).toBe("adopt");
  });

  it("refuses historical replay on an existing ledger with no known hash", () => {
    expect(
      classifyMigrationHashDisposition({
        currentHash,
        predecessorHashes,
        recordedHash: null,
        preexistingDatabase: true,
      })
    ).toBe("refuse");
  });

  it("allows a repaired migration during a fresh empty-ledger install", () => {
    expect(
      classifyMigrationHashDisposition({
        currentHash,
        predecessorHashes,
        recordedHash: null,
        preexistingDatabase: false,
      })
    ).toBe("apply");
  });

});
