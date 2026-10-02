import { describe, expect, it } from "vitest";
import { sanitizePublicProfileText } from "@shared/publicListingSafety";
import { readPublicProfileServiceDetails } from "./publicProfileServiceDetails";

const services = (items: unknown[]) => [{ type: "services", data: { items } }];

describe("public service scopes", () => {
  it("keeps visible name order and the first real explicit description", () => {
    const blocks = services([
      { title: "Repair", description: "Repair" },
      { name: "Repair", description: "Existing fixture scope." },
      { label: "Repair", description: "Later duplicate." },
      { title: "Install", description: "Existing install scope." },
      { title: "Unknown", description: "Not a visible service." },
      "String-only service",
    ]);
    expect(
      readPublicProfileServiceDetails(blocks, ["Install", "Repair", "String-only service"])
    ).toEqual([
      { name: "Install", description: "Existing install scope." },
      { name: "Repair", description: "Existing fixture scope." },
    ]);
  });

  it("reads only public services item descriptions, never other fields or malformed records", () => {
    const item = { title: "Repair", description: "Public scope." };
    expect(
      readPublicProfileServiceDetails(
        [
          null,
          [],
          new Date(),
          { type: "internalServices", data: { items: [item] } },
          { type: "services", private: true, data: { items: [item] } },
          { type: "services", visibility: "private", data: { items: [item] } },
          { type: "services", data: { internal: true, items: [item] } },
          { type: "services", data: [] },
          ...services([
            null,
            [],
            1,
            "Repair",
            { ...item, public: false },
            { ...item, internal: true },
            { title: "Repair", notes: "Private notes.", internalDescription: "Internal scope." },
            { title: 123, name: "Repair", description: "Invalid title wins precedence." },
            { title: "Repair", description: { text: "Nested content." } },
          ]),
        ],
        ["Repair"]
      )
    ).toEqual([]);
    expect(readPublicProfileServiceDetails(null, ["Repair"])).toEqual([]);
    expect(
      readPublicProfileServiceDetails(services([{ ...item, notes: "Private notes." }]), ["Repair"])
    ).toEqual([item].map(({ title, description }) => ({ name: title, description })));
  });

  it("aligns sanitized names and bounds descriptions while removing contact vectors", () => {
    const title = `Repair ${"a".repeat(200)}`;
    const description = `Existing scope. owner@example.com 850-555-0123 https://example.com ${"b".repeat(900)}`;
    const name = sanitizePublicProfileText(title, 180);
    const details = readPublicProfileServiceDetails(services([{ title, description }]), [name]);
    expect(details).toEqual([{ name, description: sanitizePublicProfileText(description, 800) }]);
    expect(details[0].description.length).toBeLessThanOrEqual(800);
    expect(details[0].description).not.toMatch(/owner@example|850-555|https:/);
    expect(readPublicProfileServiceDetails(services([{ description: title }]), [name])).toEqual([]);
  });
});
