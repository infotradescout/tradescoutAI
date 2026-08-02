import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { ProviderCard, type ProviderCardProvider } from "./contractor-card";
import { DirectoryListingLink } from "@/pages/direct-connect/DirectoryListingLink";
import {
  getDirectConnectIntent,
  parseDirectConnectEntryContext,
} from "@/pages/direct-connect/directConnectEntryContext";
import { resolveDirectConnectDispatchSelection } from "@/pages/direct-connect/directConnectDispatchSelection";

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

function readConnectHref(html: string): string {
  const href = html.match(/href="(\/direct-connect\?[^\"]+)"/)?.[1];
  if (!href) throw new Error("Expected a rendered Direct Connect href");
  return href.replaceAll("&amp;", "&");
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

  it("carries the generated Connect href through canonical intent parsing and chooser selection", () => {
    const connectHref = readConnectHref(renderCard(provider));
    const entryContext = parseDirectConnectEntryContext(connectHref);

    expect(getDirectConnectIntent(connectHref)).toBe("fix_improve");
    expect(entryContext.targetProviderId).toBe(provider.id);
    expect(
      resolveDirectConnectDispatchSelection({
        dispatchMode: "direct_pick",
        topCountIds: ["another-provider"],
        prefillTargetProviderId: entryContext.targetProviderId,
      })
    ).toEqual([provider.id]);
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
    expect(html).not.toContain("/direct-connect?");
  });
});

describe("DirectoryListingLink", () => {
  it("renders one named anchor without a nested button", () => {
    const html = renderToStaticMarkup(
      <Router ssrPath="/direct-connect/businesses">
        <DirectoryListingLink slug="acme-and-sons" businessName="Acme & Sons" />
      </Router>
    );

    expect(html).toContain('href="/business/acme-and-sons"');
    expect(html).toContain('aria-label="View Acme &amp; Sons listing"');
    expect(html).not.toContain("<button");
    expect(html.match(/<a\b/g)).toHaveLength(1);
  });
});
