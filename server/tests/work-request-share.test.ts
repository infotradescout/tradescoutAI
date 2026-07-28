import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildWorkRequestPreviewTitle,
  buildWorkRequestScopeSummary,
  redactContactDetails,
  serializeDirectConnectCardContactGatePayload,
} from "../utils/workRequestShare";

describe("work request share redaction", () => {
  const rawContact = {
    name: "Jane Provider",
    phone: "555-123-9876",
    email: "provider@example.test",
    address: "123 Provider Lane",
  };

  it("redacts email and phone from free text", () => {
    const input = "Call me at (555) 123-9876 or email me at owner@example.com";
    const redacted = redactContactDetails(input);
    expect(redacted).not.toContain("555");
    expect(redacted).not.toContain("owner@example.com");
    expect(redacted).toContain("[hidden]");
  });

  it("builds a redacted scope summary", () => {
    const input =
      "Kitchen remodel in Tangipahoa. Contact: 985-555-0000 and demo@tradescout.test for access.";
    const summary = buildWorkRequestScopeSummary(input);
    expect(summary).toContain("Kitchen remodel");
    expect(summary).not.toContain("985-555-0000");
    expect(summary).not.toContain("demo@tradescout.test");
  });

  it("builds a redacted preview title", () => {
    const title = "Roof leak - text me at 225-555-1212";
    const previewTitle = buildWorkRequestPreviewTitle(title, "Shared request");
    expect(previewTitle).toContain("Roof leak");
    expect(previewTitle).not.toContain("225-555-1212");
  });

  it("removes exact-address, URL, bare-domain, and social-handle vectors from public metadata", () => {
    const unsafe =
      "Kitchen at 123 Provider Lane. See https://provider.example/work, provider.example, or @provider_team.";
    const summary = buildWorkRequestScopeSummary(unsafe);
    const title = buildWorkRequestPreviewTitle(unsafe);

    for (const publicText of [summary, title]) {
      expect(publicText).not.toContain("123 Provider Lane");
      expect(publicText).not.toContain("https://provider.example");
      expect(publicText).not.toContain("provider.example");
      expect(publicText).not.toContain("@provider_team");
      expect(publicText).toContain("Continue through TradeScout");
    }
  });

  it("omits released contact from serialized card payloads before release", () => {
    for (const contactGateState of [
      undefined,
      "",
      "locked",
      "contractor_requested",
      "user_approved",
      "provider_requested_contact",
      "requester_approved",
      "contact_hidden",
      "mystery_state",
      "denied",
      "closed",
    ]) {
      const payload = serializeDirectConnectCardContactGatePayload({
        contactGateState,
        releasedContact: rawContact,
      });
      const serialized = JSON.stringify(payload);

      expect(payload).not.toHaveProperty("releasedContact");
      expect(serialized).not.toContain("555-123-9876");
      expect(serialized).not.toContain("provider@example.test");
      expect(serialized).not.toContain("123 Provider Lane");
    }
  });

  it("keeps truthy releasedContact payload fail-closed unless state is released/contact_released", () => {
    const truthyPayload = {
      phone: "555-123-9876",
      email: "provider@example.test",
      address: "123 Provider Lane",
    };

    for (const contactGateState of [
      "contact_hidden",
      "provider_requested_contact",
      "requester_approved",
      "unknown_contact_state",
      undefined,
    ]) {
      const payload = serializeDirectConnectCardContactGatePayload({
        contactGateState,
        releasedContact: truthyPayload,
      });
      expect(payload.releasedContact).toBeUndefined();
    }
  });

  it("serializes released contact only from released server states", () => {
    expect(
      serializeDirectConnectCardContactGatePayload({
        contactGateState: "released",
        releasedContact: rawContact,
      })
    ).toEqual({
      contactGateState: "released",
      releasedContact: rawContact,
    });
    expect(
      serializeDirectConnectCardContactGatePayload({
        contactGateState: "contact_released",
        releasedContact: rawContact,
      })
    ).toEqual({
      contactGateState: "contact_released",
      releasedContact: rawContact,
    });
  });

  it("lets non-affiliate /r tokens reach the public Direct Connect share renderer", () => {
    const routesSource = fs.readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
    const indexSource = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf8");
    const affiliateRoute = routesSource.slice(routesSource.indexOf('app.get("/r/:slug"'));

    expect(affiliateRoute.slice(0, 1_500)).toContain("return next()");
    expect(indexSource).toContain('app.get("/r/:shareToken"');
    expect(indexSource).toContain("buildWorkRequestShareHtml");
  });
});
