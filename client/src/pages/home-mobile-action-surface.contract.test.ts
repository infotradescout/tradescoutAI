import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("TradeScout mobile action surface", () => {
  it("renders the primary prompt, service shortcuts, and Direct Connect CTA copy", () => {
    const source = read("client/src/pages/home.tsx");

    expect(source).toContain("What do you need done?");
    expect(source).toContain("Describe the job");
    expect(source).toContain("Popular services");
    expect(source).toContain("Plumbing");
    expect(source).toContain("Electrical");
    expect(source).toContain("Handyman");
    expect(source).toContain("Roofing");
    expect(source).toContain("Landscaping");
    expect(source).toContain("Start a Direct Connect request");
    expect(source).toContain("Send your job details to local pros who match this work.");
    expect(source).toContain("Your contact details stay private until you choose the next step.");
  });

  it("does not introduce forbidden assistant, fake trust, or non-TradeScout language", () => {
    const source = read("client/src/pages/home.tsx").toLowerCase();

    expect(source).not.toContain("ask scout");
    expect(source).not.toContain("scout assistant");
    expect(source).not.toContain("chatbot");
    expect(source).not.toContain("verified pros");
    expect(source).not.toContain("licensed and insured");
    expect(source).not.toContain("guaranteed");
    expect(source).not.toContain(["meal", "scout"].join(""));
    expect(source).not.toContain("food truck");
    expect(source).not.toContain("restaurant");
  });
});
