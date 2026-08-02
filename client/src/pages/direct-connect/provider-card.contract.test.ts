import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("canonical provider card", () => {
  it("exports ProviderCard while preserving the compatibility default", () => {
    const source = read("client/src/components/contractor-card.tsx");
    expect(source).toContain("export function ProviderCard");
    expect(source).toContain("export default ProviderCard");
  });

  it("is used by the Direct Connect business directory", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectPros.tsx");
    expect(source).toContain('import { ProviderCard } from "@/components/contractor-card"');
    expect(source).toContain('<ProviderCard contractor={contractor} compact action="connect" />');
    expect(source).toContain("providers={visibleProviders}");
    expect(source).not.toContain("Strongest trust evidence nearby");
  });

  it("keeps the compact card dense and its interactions semantically separate", () => {
    const source = read("client/src/components/contractor-card.tsx");
    expect(source).toContain("grid-cols-[6.75rem_minmax(0,1fr)]");
    expect(source).toContain("aria-label={`View ${businessName} profile`}");
    expect(source).not.toContain('role="link"');
    expect(source).not.toContain("onKeyDown");
    expect(source).not.toContain("requestOnly");
  });
});
