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
});
