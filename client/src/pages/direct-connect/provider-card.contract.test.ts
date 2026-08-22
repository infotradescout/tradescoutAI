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

  it("is used once by the selected-business inspector instead of a repeated card wall", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectPros.tsx");
    expect(source).toContain(
      'import { ProviderCard, type ProviderCardProvider } from "@/components/contractor-card"'
    );
    expect(source).toContain(
      '<ProviderCard contractor={selectedProvider} compact action="connect" />'
    );
    expect(source.match(/<ProviderCard\b/g)).toHaveLength(1);
    expect(source).toMatch(/<ul\r?\n\s+aria-label="Business results"/);
    expect(source).toContain("aria-pressed={selected}");
    expect(source).not.toContain('role="listbox"');
    expect(source).not.toContain('role="option"');
    expect(source).not.toContain("onKeyDown");
    expect(source).toContain("providers={distanceFirstProviders}");
    expect(source).not.toContain("xl:grid-cols-3");
    expect(source).not.toContain("Strongest trust evidence nearby");
  });

  it("persists a user-and-route-scoped workspace and fails closed on stale selection", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectPros.tsx");
    const stateSource = read("client/src/pages/direct-connect/businessesWorkspaceState.ts");

    expect(source).toContain("resolveBusinessesWorkspaceState({");
    expect(source).toContain("writeBusinessesWorkspaceState({");
    expect(source).toContain("selectedProviderId && !selectedProvider");
    expect(source.match(/setSelectedProviderId\(""\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(source).toContain("resolveBusinessesWorkspaceCountyChange({");
    expect(source).toContain("resolveBusinessesWorkspaceEffectiveArea({");
    expect(source).toContain("if (!value) {");
    expect(source).toContain("resolveBusinessesWorkspaceViewerCoordinates({");
    expect(source).toContain("lat: undefined");
    expect(source).toContain("lng: undefined");
    expect(stateSource).toContain("authenticatedUserId");
    expect(stateSource).toContain("encodeURIComponent(routePath)");
    expect(stateSource).toContain("route.explicit.searchQuery");
    expect(stateSource).toContain("resolveSelectedWorkspaceProvider");
  });

  it("keeps the compact card dense and its interactions semantically separate", () => {
    const source = read("client/src/components/contractor-card.tsx");
    expect(source).toContain("grid-cols-[6.75rem_minmax(0,1fr)]");
    expect(source).toContain("aria-label={`View ${businessName} profile`}");
    expect(source).not.toContain('role="link"');
    expect(source).not.toContain("onKeyDown");
    expect(source).not.toContain("requestOnly");
  });

  it("wires the selected provider into the chooser-preservation policy", () => {
    const cardSource = read("client/src/components/contractor-card.tsx");
    const shellSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(cardSource).toContain('intent: "hire"');
    expect(shellSource).toContain("resolveDirectConnectDispatchSelection({");
    expect(shellSource).toContain("prefillTargetProviderId,");
  });

  it("uses one semantic listing link in both fallback directory branches", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectPros.tsx");

    expect(source.match(/<DirectoryListingLink slug=\{business\.slug\}/g)).toHaveLength(2);
    expect(source).not.toMatch(
      /<Link href=\{`\/business\/\$\{encodeURIComponent\(business\.slug\)\}`\}>\s*<Button/
    );
  });
});
