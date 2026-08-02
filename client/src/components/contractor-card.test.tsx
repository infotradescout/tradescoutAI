import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { ProviderCard, type ProviderCardProvider } from "./contractor-card";

function renderCard(
  contractor: ProviderCardProvider,
  action: "connect" | "profile" | "none" = "connect"
) {
  return renderToStaticMarkup(
    <Router ssrPath="/direct-connect/pros">
      <ProviderCard contractor={contractor} compact action={action} />
    </Router>
  );
}

describe("ProviderCard", () => {
  const provider: ProviderCardProvider = {
    id: "provider-1",
    slug: "acme-roofing",
    companyName: "Acme Roofing",
    category: "roofing_contractor",
    city: "Pensacola",
    state: "FL",
    description: "Roof repair and replacement for local homes.",
    verifiedLicensed: true,
    totalRecommendations: 12,
    trustScore: 91,
  };

  it("renders a dense index-card layout with a real profile link and separate Connect action", () => {
    const html = renderCard(provider);

    expect(html).toContain("grid-cols-[6.75rem_minmax(0,1fr)]");
    expect(html).toContain('href="/business/acme-roofing"');
    expect(html).toContain("Connect");
    expect(html).toContain("Licensed");
    expect(html).toContain("12 recommendations");
    expect(html).not.toContain('role="link"');
  });

  it("does not expose the internal numeric CVS composite", () => {
    const html = renderCard(provider);

    expect(html).not.toContain("CVS");
    expect(html).not.toContain("91");
  });

  it("does not manufacture undefined profile or contractor routes", () => {
    const html = renderCard({
      id: "provider-2",
      companyName: "Profile Pending",
    });

    expect(html).not.toContain("/business/undefined");
    expect(html).not.toContain("contractor=undefined");
    expect(html).toContain("targetProviderId=provider-2");
  });

  it("supports a profile-only action without opening a contact path", () => {
    const html = renderCard(provider, "profile");

    expect(html).toContain("View profile");
    expect(html).not.toContain("intent=connect");
  });
});
