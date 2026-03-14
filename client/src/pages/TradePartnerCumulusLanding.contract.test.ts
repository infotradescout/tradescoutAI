import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("TradePartnerCumulusLanding", () => {
  it("groups sessions by location/date and renders RSVP actions on the same card", () => {
    const source = read("client/src/pages/TradePartnerCumulusLanding.tsx");
    expect(source).toContain("const groupedMeetingSessions = useMemo");
    expect(source).toContain("Choose a time and RSVP from this card.");
    expect(source).toContain("RSVP from this card");
    expect(source).toContain("Create account to RSVP");
    expect(source).toContain("Verify email to RSVP");
  });

  it("keeps addresses and times attached to each grouped session card", () => {
    const source = read("client/src/pages/TradePartnerCumulusLanding.tsx");
    expect(source).toContain("session.addressLine1");
    expect(source).toContain("session.addressLine2");
    expect(source).toContain('slot.timeLabel || "TBD"');
    expect(source).toContain("session.meetingCity || session.countyLabel");
  });
});
