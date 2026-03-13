import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("partner county observation snapshot scheduler contracts", () => {
  it("registers the snapshot job in the crawler scheduler", () => {
    const source = read("server/services/crawlerScheduler.ts");

    expect(source).toContain("runPartnerCountyObservationSnapshotJob");
    expect(source).toContain("startPartnerCountyObservationSnapshotsScheduler");
    expect(source).toContain("PARTNER_COUNTY_OBSERVATION_SNAPSHOTS_SCHEDULE");
    expect(source).toContain("partnerCountyObservationSnapshots");
  });
});
