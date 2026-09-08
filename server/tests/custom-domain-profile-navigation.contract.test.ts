import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("custom-domain public Profile navigation contract", () => {
  const profileView = read("client/src/pages/ProfileSiteView.tsx");
  const bookingDialog = read("client/src/components/profile/ProfileBookingRequestDialog.tsx");
  const expressPanel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
  const profileFooter = read("client/src/pages/profile-sites/TradeScoutProfileHandoff.tsx");
  const manageChrome = read("client/src/components/profile/ProfileSiteManageChrome.tsx");
  const wholesalerTheme = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");
  const localServiceTheme = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");
  const trustActions = read("client/src/components/profile/PublicProfileTrustActions.tsx");

  it("qualifies existing platform-owned Profile actions against the platform origin", () => {
    expect(profileView).toContain("const directConnectPath =");
    expect(profileView).toContain("const directConnectHref = qualifyPublicProfileItemDestination(");
    expect(profileView).toContain("const bookingSignInHref = qualifyPublicProfileItemDestination(");
    expect(bookingDialog).toContain(
      "qualifyPublicProfileItemDestination(checkoutPath, platformBaseHref)"
    );
    expect(profileView).toContain("const subjectHref = entry.contractor?.slug");
    expect(profileView).toContain("subjectHref,");
    expect(profileView).toContain("platformBaseHref={platformBaseHref}");
    expect(wholesalerTheme).toContain('qualifyPublicProfileItemDestination("/", platformBaseHref)');
    expect(profileFooter).toContain('qualifyPublicProfileItemDestination("/", platformBaseHref)');
    expect(localServiceTheme).toContain(
      'qualifyPublicProfileItemDestination("/", platformBaseHref)'
    );
  });

  it("uses document navigation after an existing action becomes cross-host", () => {
    expect(bookingDialog).toContain("window.location.assign(signInHref)");
    expect(bookingDialog).toContain("window.location.assign(qualifyPublicProfileItemDestination(");
    expect(trustActions).toContain("window.location.assign(signInHref)");
    expect(manageChrome).toContain("requiresDocumentNavigation(editorHref)");
    expect(wholesalerTheme).toContain("window.location.assign(ctaHref)");
  });

  it("keeps Express Direct Connect management links on the platform", () => {
    expect(expressPanel).toContain("platformBaseHref?: string;");
    expect(expressPanel).toContain(
      "const requestHref = qualifyPublicProfileItemDestination(requestPath, platformBaseHref);"
    );
    expect(expressPanel).toContain("requiresDocumentNavigation(requestHref)");
    expect(expressPanel).not.toContain("<Link href={requestPath}>");
    expect(expressPanel).not.toContain("postCallSignupHref");
    expect(expressPanel).not.toContain("manageRequestHref");
  });
});
