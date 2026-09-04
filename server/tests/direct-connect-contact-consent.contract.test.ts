import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Direct Connect submission contact consent", () => {
  it("requires the public-profile request to collect a name and complete phone number", () => {
    const route = read("server/routes/tradepartner-express.ts");

    expect(route).toContain('name: z.string().trim().min(2).max(120)');
    expect(route).toContain('refine((value) => hasDirectConnectPhone(value)');
    expect(route).toContain('purpose: "tradepartner_request_notification"');
    expect(route).toContain('requestId: String(created.id)');
  });

  it("delivers the requester name and phone to the selected business when the request is sent", () => {
    const emailService = read("server/services/emailService.ts");

    expect(emailService).toContain(
      'DIRECT_CONNECT_BUSINESS_NOTIFICATION_PURPOSE = "tradepartner_request_notification"'
    );
    expect(emailService).toContain("FROM work_requests request");
    expect(emailService).toContain("INNER JOIN users owner ON owner.id = request.created_by_user_id");
    expect(emailService).toContain("owner.first_name");
    expect(emailService).toContain("owner.phone");
    expect(emailService).toContain("<strong>Name:</strong>");
    expect(emailService).toContain("<strong>Phone:</strong>");
    expect(emailService).toContain("authorized TradeScout to share these details");
    expect(emailService).toContain(
      "Direct Connect business notification requires the requester's name and phone number"
    );
  });

  it("removes the old withheld-contact statement and makes the requester email replyable", () => {
    const emailService = read("server/services/emailService.ts");

    expect(emailService).toContain("WITHHELD_DIRECT_CONNECT_CONTACT_COPY");
    expect(emailService).toContain(
      "existingHtml.replace(WITHHELD_DIRECT_CONNECT_CONTACT_COPY, contactHtml)"
    );
    expect(emailService).toContain("replyTo: params.replyTo || requesterEmail || undefined");
    expect(emailService).not.toContain(
      'params = await attachConsentedDirectConnectContact(params, purpose);\n\n    console.info("[email] send start"'
    );
  });
});