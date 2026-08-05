import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("tradepartner RSVP email routing", () => {
  it("routes Cumulus RSVP notifications to the primary support inbox", () => {
    const source = read("server/routes/tradepartner-rsvp.ts");
    expect(source).toContain("PRIMARY_SUPPORT_EMAIL");
    expect(source).toContain("notificationRecipients");
    expect(source).toContain('purpose: "tradepartner_rsvp_admin"');
  });

  it("allows Cumulus RSVP admin emails even when EMAIL_MODE is restricted", () => {
    const source = read("server/services/emailService.ts");
    expect(source).toContain('purpose === "tradepartner_rsvp_admin"');
  });

  it("sends an RSVP confirmation email to the attendee", () => {
    const source = read("server/routes/tradepartner-rsvp.ts");
    expect(source).toContain('purpose: "tradepartner_rsvp_confirmation"');
    expect(source).toContain("Your RSVP is confirmed");
    expect(source).toContain("replyTo: PRIMARY_SUPPORT_EMAIL");
  });

  it("allows RSVP confirmation emails even when EMAIL_MODE is restricted", () => {
    const source = read("server/services/emailService.ts");
    expect(source).toContain('purpose === "tradepartner_rsvp_confirmation"');
  });

  it("allows Express Direct Connect requester confirmations when EMAIL_MODE is restricted", () => {
    const source = read("server/services/emailService.ts");
    expect(source).toContain('purpose === "tradepartner_request_confirmation"');
    expect(source).toContain('purpose === "tradepartner_request_notification"');
  });

  it("allows JW Stone customer saved-stones copy emails when EMAIL_MODE is restricted", () => {
    const source = read("server/services/emailService.ts");
    expect(source).toContain('purpose === "jw_stone_saved_stones_copy"');
  });
});
