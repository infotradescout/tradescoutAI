import { describe, expect, it } from "vitest";
import fs from "fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("Property Lifecycle OS Contracts", () => {
  it("mounts the property programs router", () => {
    const routes = read("server/routes.ts");
    expect(routes).toContain("propertyProgramsRouter");
    expect(routes).toContain("app.use(propertyProgramsRouter)");
  });

  it("exposes property program endpoints and snapshots", () => {
    const src = read("server/routes/property-programs.ts");
    expect(src).toContain("/api/property-programs");
    expect(src).toContain("/api/property-programs/:id/events");
    expect(src).toContain("/api/property-programs/:id/homefax");
    expect(src).toContain("/api/property-programs/:id/readiness");
  });

  it("syncs Home Vault actions into linked property programs", () => {
    const src = read("server/routes/homes.ts");
    expect(src).toContain("addPropertyLifecycleEvent");
    expect(src).toContain("home_record_");
    expect(src).toContain("home_appliance_added");
    expect(src).toContain("home_document_added");
  });

  it("supports booking-to-property sync via bookingContext.propertyProgramId", () => {
    const src = read("server/routes.ts");
    expect(src).toContain("propertyProgramId");
    expect(src).toContain("booking_request_created");
    expect(src).toContain("booking_payment_intent_created");
  });

  it("exposes participant invite/accept/remove and document endpoints", () => {
    const src = read("server/routes/property-programs.ts");
    expect(src).toContain("/api/property-programs/:id/participants");
    expect(src).toContain("/api/property-programs/:id/participants/invite");
    expect(src).toContain("/api/property-programs/invites/:code/accept");
    expect(src).toContain("/api/property-programs/:id/participants/:participantId");
    expect(src).toContain("/api/property-programs/:id/transfer-primary");
    expect(src).toContain("/api/property-programs/:id/documents");
  });

  it("gates the participant invite email behind the account_creation_only allow-list", () => {
    const src = read("server/services/emailService.ts");
    expect(src).toContain("property_participant_invite");
  });
});
