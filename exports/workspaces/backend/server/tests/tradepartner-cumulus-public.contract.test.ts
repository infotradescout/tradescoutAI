import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Cumulus public campaign wiring", () => {
  it("exposes meeting city, time, and address fields from the public campaign route", () => {
    const source = read("server/routes/tradepartner-campaigns.ts");
    expect(source).toContain("meeting_city");
    expect(source).toContain("time_label");
    expect(source).toContain("address_line1");
    expect(source).toContain("address_line2");
    expect(source).toContain("meetingCity:");
    expect(source).toContain("timeLabel:");
    expect(source).toContain("addressLine1:");
    expect(source).toContain("addressLine2:");
  });

  it("seeds multiple Cumulus session slots instead of a single county row", () => {
    const source = read("server/db/ensureTradePartnerTables.ts");
    expect(source).toContain("mobile-2026-03-24-1145");
    expect(source).toContain("mobile-2026-03-24-1400");
    expect(source).toContain("escambia-2026-03-25-1145");
    expect(source).toContain("escambia-2026-03-25-1400");
    expect(source).toContain("okaloosa-2026-03-26-1145");
    expect(source).toContain("okaloosa-2026-03-26-1400");
  });

  it("backfills older campaign tables with newly required Cumulus columns", () => {
    const source = read("server/db/ensureTradePartnerTables.ts");
    expect(source).toContain("ALTER TABLE tradepartner_campaign_meetings");
    expect(source).toContain("ADD COLUMN IF NOT EXISTS meeting_city");
    expect(source).toContain("ADD COLUMN IF NOT EXISTS time_label");
    expect(source).toContain("ADD COLUMN IF NOT EXISTS address_line1");
    expect(source).toContain("ADD COLUMN IF NOT EXISTS address_line2");
    expect(source).toContain("ALTER TABLE tradepartner_campaigns");
    expect(source).toContain("ALTER TABLE tradepartner_campaign_focus_counties");
  });
});
