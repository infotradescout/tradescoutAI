import { describe, expect, it } from "vitest";
import {
  buildJwStoneEmailTemplate,
  JW_STONE_EMAIL_PURPOSES,
} from "../services/jwStoneEmailTemplates";

describe("JW Stone email templates", () => {
  it("defines one branded template for every allow-listed durable purpose", () => {
    for (const purpose of JW_STONE_EMAIL_PURPOSES) {
      const template = buildJwStoneEmailTemplate({
        purpose,
        recipientName: "Avery",
        targetLabel: "Cristallo",
        amountCents: 125_000,
        offerStatus: "under_review",
        actionUrl: "https://jwstonelogistics.com/offer-action/example-token",
      });
      expect(template.subject).toBeTruthy();
      expect(template.text).toContain("JW Stone");
      expect(template.html).toContain("JW Stone");
      expect(`${template.text} ${template.html}`).not.toContain("TradeScout account");
      expect(`${template.text} ${template.html}`).not.toMatch(/outbid|leaderboard|your rank/i);
    }
  });

  it("keeps the staff alert free of customer contact and private amount", () => {
    const template = buildJwStoneEmailTemplate({
      purpose: "jw_stone_offer_staff_alert",
      recipientName: "customer@example.com",
      targetLabel: "Container 12",
      amountCents: 999_999,
      actionUrl: "https://www.thetradescout.com/admin/jw-stone-offers",
    });
    const rendered = `${template.subject}\n${template.text}\n${template.html}`;
    expect(rendered).not.toContain("customer@example.com");
    expect(rendered).not.toContain("$9,999.99");
    expect(rendered).toContain("intentionally omits");
  });

  it("escapes untrusted names and target labels in HTML", () => {
    const template = buildJwStoneEmailTemplate({
      purpose: "jw_stone_offer_confirmation",
      recipientName: "<script>alert(1)</script>",
      targetLabel: 'Stone \"A\" <img src=x>',
      amountCents: 100,
    });
    expect(template.html).not.toContain("<script>");
    expect(template.html).not.toContain("<img src=x>");
    expect(template.html).toContain("&lt;script&gt;");
  });

  it("fails closed for non-http action links", () => {
    expect(() =>
      buildJwStoneEmailTemplate({
        purpose: "jw_stone_express_verification",
        actionUrl: "javascript:alert(1)",
      })
    ).toThrow(/valid action URL/);
  });
});
