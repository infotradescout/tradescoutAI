import { describe, expect, it } from "vitest";
import type { NavItem } from "@/components/layout/AppShell";
import {
  doesMobileAppBarItemMatch,
  getMobileAppBarActiveHref,
  getMobileAppBarPathOnly,
  partitionMobileAppBarItems,
} from "./MobileAppBar";

const fixedApps: NavItem[] = [
  { label: "Scout", href: "/scout" },
  { label: "Direct Connect", href: "/direct-connect?resume=last-task" },
  { label: "Businesses", href: "/contractors" },
  { label: "Jobs", href: "/direct-connect/opportunities" },
  { label: "Community", href: "/community" },
];

const secondaryApps: NavItem[] = [
  { label: "Share", href: "/share" },
  { label: "Exchange", href: "/exchange" },
  { label: "Help", href: "/help" },
];

describe("MobileAppBar active route matching", () => {
  it("matches a queried navigation href by its path while preserving child-route activity", () => {
    const resumeHref = "/direct-connect?resume=last-task";

    expect(getMobileAppBarPathOnly(resumeHref)).toBe("/direct-connect");
    expect(doesMobileAppBarItemMatch("/direct-connect", resumeHref)).toBe(true);
    expect(doesMobileAppBarItemMatch("/direct-connect/inbox", resumeHref)).toBe(true);
    expect(doesMobileAppBarItemMatch("/direct-connect/active", resumeHref)).toBe(true);
    expect(doesMobileAppBarItemMatch("/community", resumeHref)).toBe(false);
    expect(getMobileAppBarActiveHref(resumeHref, fixedApps)).toBe(resumeHref);
  });

  it("chooses the most-specific Jobs destination over the Direct Connect parent", () => {
    expect(
      getMobileAppBarActiveHref("/direct-connect/opportunities?tab=hiring#selected-job", fixedApps)
    ).toBe("/direct-connect/opportunities");
    expect(getMobileAppBarActiveHref("/direct-connect/opportunities/posted/42", fixedApps)).toBe(
      "/direct-connect/opportunities"
    );
  });

  it("keeps the existing inbox compatibility aliases query-safe", () => {
    const inboxHref = "/direct-connect/inbox?source=taskbar";

    expect(doesMobileAppBarItemMatch("/direct-connect/inbox", inboxHref)).toBe(true);
    expect(doesMobileAppBarItemMatch("/direct-connect/engagements", inboxHref)).toBe(true);
    expect(doesMobileAppBarItemMatch("/direct-connect/active", inboxHref)).toBe(false);
  });

  it("keeps Community active across its canonical feed and post routes", () => {
    expect(getMobileAppBarActiveHref("/community-feed?tab=recent", fixedApps)).toBe("/community");
    expect(getMobileAppBarActiveHref("/community-post/post-42", fixedApps)).toBe("/community");
  });

  it("keeps all five primary app slots fixed when a secondary app is active", () => {
    const items = [...fixedApps, ...secondaryApps];
    const activeHref = getMobileAppBarActiveHref("/exchange/listing/42", items);
    const partition = partitionMobileAppBarItems(items, 5, activeHref, true);

    expect(partition.primaryItems.map((item) => item.label)).toEqual([
      "Scout",
      "Direct Connect",
      "Businesses",
      "Jobs",
      "Community",
    ]);
    expect(partition.overflowItems.map((item) => item.label)).toEqual([
      "Share",
      "Exchange",
      "Help",
    ]);
  });

  it("retains the existing active-overflow swap when stable primary mode is not enabled", () => {
    const items = [...fixedApps, ...secondaryApps];
    const activeHref = getMobileAppBarActiveHref("/exchange", items);
    const partition = partitionMobileAppBarItems(items, 5, activeHref);

    expect(partition.primaryItems.map((item) => item.label)).toEqual([
      "Scout",
      "Direct Connect",
      "Businesses",
      "Jobs",
      "Exchange",
    ]);
    expect(partition.overflowItems[0]?.label).toBe("Community");
  });
});
