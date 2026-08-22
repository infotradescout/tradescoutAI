import { describe, expect, it } from "vitest";
import { doesMobileAppBarItemMatch, getMobileAppBarPathOnly } from "./MobileAppBar";

describe("MobileAppBar active route matching", () => {
  it("matches a queried navigation href by its path while preserving child-route activity", () => {
    const resumeHref = "/direct-connect?resume=last-task";

    expect(getMobileAppBarPathOnly(resumeHref)).toBe("/direct-connect");
    expect(doesMobileAppBarItemMatch("/direct-connect", resumeHref)).toBe(true);
    expect(doesMobileAppBarItemMatch("/direct-connect/inbox", resumeHref)).toBe(true);
    expect(doesMobileAppBarItemMatch("/direct-connect/active", resumeHref)).toBe(true);
    expect(doesMobileAppBarItemMatch("/community", resumeHref)).toBe(false);
  });

  it("keeps the existing inbox compatibility aliases query-safe", () => {
    const inboxHref = "/direct-connect/inbox?source=taskbar";

    expect(doesMobileAppBarItemMatch("/direct-connect/inbox", inboxHref)).toBe(true);
    expect(doesMobileAppBarItemMatch("/direct-connect/engagements", inboxHref)).toBe(true);
    expect(doesMobileAppBarItemMatch("/direct-connect/active", inboxHref)).toBe(false);
  });
});
