import { describe, expect, it } from "vitest";
import { HOME_IDENTITY_FIELDS, HOME_IDENTITY_TYPES, homeIdentityDraft, homeIdentityChanges, homeIdentityUpdateSchema, parseHomeIdentitySnapshot, type HomeIdentity } from "@shared/homeIdentity";
const identity: HomeIdentity = { id: "property-one", nickname: "House", propertyType: "single_family", yearBuilt: 2001, address1: "Test address", address2: null, city: "Test city", stateCode: "FL", countyFips: "12033", zipCode: "32501" };
const revision = "a".repeat(64);
const update = (changes: Record<string, unknown>) => homeIdentityUpdateSchema.safeParse({ revision, changes });

describe("property identity editing", () => {
  it("has all canonical editable fields, including county and address line 2", () => {
    expect(HOME_IDENTITY_FIELDS).toEqual(["nickname", "propertyType", "yearBuilt", "address1", "address2", "city", "stateCode", "countyFips", "zipCode"]);
    expect(HOME_IDENTITY_TYPES).toHaveLength(13);
  });
  it("only sends changed fields and makes clearing deliberate", () => {
    const draft = homeIdentityDraft(identity);
    expect(homeIdentityChanges(identity, draft)).toEqual({});
    expect(homeIdentityChanges(identity, { ...draft, nickname: " New property name ", address1: "", yearBuilt: "" })).toEqual({ nickname: "New property name", address1: null, yearBuilt: null });
    expect(homeIdentityChanges(identity, { ...draft, stateCode: "fl" })).toEqual({});
  });
  it.each(["ownerUserId", "id", "verified", "status", "createdByUserId", "sharing", "authority"])("rejects authority/mass assignment through %s", (field) => {
    expect(update({ nickname: "New", [field]: "attacker" }).success).toBe(false);
  });
  it.each([{ yearBuilt: 1599 }, { yearBuilt: 2101 }, { yearBuilt: 2001.5 }, { yearBuilt: "2001" }, { yearBuilt: NaN }, { zipCode: "abc" }, { countyFips: "12" }, { stateCode: "Florida" }, { nickname: "" }, { city: "a\nb" }, { propertyType: "not-a-type" }])("rejects malformed changed fields %j", (changes) => {
    expect(update(changes).success).toBe(false);
  });
  it("accepts known types, nullable fields, and ZIP+4 without adding a verification claim", () => {
    for (const [propertyType] of HOME_IDENTITY_TYPES) expect(update({ propertyType }).success).toBe(true);
    expect(update({ yearBuilt: null, zipCode: "32501-1234", stateCode: "fl" }).success).toBe(true);
    expect(homeIdentityUpdateSchema.parse({ revision, changes: { stateCode: "fl" } }).changes.stateCode).toBe("FL");
  });
  it("requires the original revision and a nonempty patch", () => {
    expect(homeIdentityUpdateSchema.safeParse({ changes: { nickname: "Name" } }).success).toBe(false);
    expect(homeIdentityUpdateSchema.safeParse({ revision, changes: {}, extra: true }).success).toBe(false);
    expect(update({}).success).toBe(false);
  });
  it("matches the requested record exactly and handles legacy read data separately from edits", () => {
    expect(parseHomeIdentitySnapshot({ identity, revision }, identity.id)).toEqual({ identity, revision });
    expect(() => parseHomeIdentitySnapshot({ identity, revision }, "other-property")).toThrow();
    expect(() => parseHomeIdentitySnapshot({ identity: { ...identity, city: {} }, revision }, identity.id)).toThrow();
    expect(parseHomeIdentitySnapshot({ identity: { ...identity, zipCode: "legacy", propertyType: "older-custom-type" }, revision }, identity.id).identity.propertyType).toBe("older-custom-type");
    expect(update({ nickname: "Rename only" }).success).toBe(true);
  });
});
