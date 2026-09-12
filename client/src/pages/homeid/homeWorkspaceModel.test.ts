import { describe, expect, it } from "vitest";
import {
  HOME_SECTIONS, PACKAGE_HOME_ID, resolveHomeView, homeHref, collection, readHomeDetail,
  readPersistence, dueMaintenance, recentRecords, homeName, homeAddress, dateLabel,
} from "./homeWorkspaceModel";

describe("property-first Homes navigation", () => {
  it("does not substitute a special operations dashboard merely because this HomeID was selected", () => {
    expect(resolveHomeView(`homeId=${PACKAGE_HOME_ID}`, PACKAGE_HOME_ID)).toBe("overview");
    expect(resolveHomeView("", PACKAGE_HOME_ID)).toBe("overview");
    expect(resolveHomeView("", "another-home")).toBe("overview");
  });
  it.each(["workspace=launch", "launchTab=control", "launchTab=scope", "launchTab=packages", "launchTab=partners", "launchTab=evidence", "launchTab=release"])(
    "retains explicit specialist entry %s without routing other homes there", (search) => {
      expect(resolveHomeView(search, PACKAGE_HOME_ID)).toBe("launch");
      expect(resolveHomeView(search, "another-home")).toBe("overview");
    }
  );
  it.each(["property", "build", "systems", "documents", "timeline", "maintenance", "requests", "sale"])(
    "preserves the existing %s tools and every selected property ID", (tab) => {
      const section = HOME_SECTIONS.find((item) => item.id === tab)!;
      const url = new URL(homeHref(PACKAGE_HOME_ID, section.id), "https://example.invalid");
      expect(url.pathname).toBe("/homes");
      expect(url.searchParams.get("homeId")).toBe(PACKAGE_HOME_ID);
      expect(url.searchParams.get("tab")).toBe(tab);
      expect(resolveHomeView(url.search, PACKAGE_HOME_ID)).toBe("record");
      expect(resolveHomeView(`tab=${tab}`, PACKAGE_HOME_ID)).toBe("record");
    }
  );
  it("retains the complete nine-section property workspace", () => {
    expect(HOME_SECTIONS.map((section) => section.id)).toEqual(["overview", "property", "build", "systems", "documents", "timeline", "maintenance", "requests", "sale"]);
  });
  it("keeps full-passport links and the selected project without allowing stale launch intent", () => {
    expect(resolveHomeView("mode=passport&launchTab=scope", PACKAGE_HOME_ID)).toBe("record");
    expect(resolveHomeView("workspace=record", PACKAGE_HOME_ID)).toBe("record");
    const project = new URL(homeHref(PACKAGE_HOME_ID, "build", "project&other=2"), "https://example.invalid");
    expect(project.searchParams.get("projectId")).toBe("project&other=2");
    expect(project.searchParams.has("other")).toBe(false);
    expect(homeHref(PACKAGE_HOME_ID)).toBe(`/homes?homeId=${PACKAGE_HOME_ID}`);
    expect(resolveHomeView("tab=unknown&launchTab=unknown", PACKAGE_HOME_ID)).toBe("overview");
  });
});

describe("saved records, not fabricated readiness", () => {
  it("distinguishes empty responses from missing or failed collections", () => {
    expect(collection({ projects: [] }, "projects")).toEqual([]);
    expect(() => collection({}, "projects")).toThrow();
    expect(() => collection({ projects: null }, "projects")).toThrow();
    expect(() => collection({ projects: 17 }, "projects")).toThrow();
    expect(() => readPersistence({})).toThrow();
  });
  it("requires the exact requested home and keeps files separate from evidence references", () => {
    const detail = { home: { id: PACKAGE_HOME_ID }, records: [], documents: [] };
    expect(readHomeDetail(detail, PACKAGE_HOME_ID).documents).toEqual([]);
    expect(() => readHomeDetail(detail, "another-home")).toThrow();
    const saved = readPersistence({ persistence: { propertyDetails: [], components: [], evidence: [{ id: "reference" }], requestPackets: [] } });
    expect(saved.evidence).toHaveLength(1);
    expect(saved.components).toHaveLength(0);
  });
  it("uses actual maintenance dates, ignores paused and completed work, and does not fabricate a due date", () => {
    const items = [
      { id: "due", nextDueAt: "2026-09-11", status: "active" },
      { id: "today", nextDueAt: "2026-09-12", status: "active" },
      { id: "future", nextDueAt: "2026-10-01", status: "active" },
      { id: "paused", nextDueAt: "2026-01-01", status: "paused" },
      { id: "done", nextDueAt: "2026-01-01", status: "completed" },
      { id: "invalid", nextDueAt: "broken", status: "active" },
      { id: "undated", status: "active" },
    ];
    expect(dueMaintenance(items, new Date(2026, 8, 12, 8)).map((item) => item.id)).toEqual(["due", "today"]);
    expect(dateLabel("2026-09-12")).toBe("Sep 12, 2026");
    expect(dateLabel("broken")).toBe("Date not recorded");
  });
  it("excludes internal metadata and sorts history without mutating the saved list", () => {
    const items = [
      { id: "older", title: "Roof inspected", occurredAt: "2026-09-01" },
      { id: "metadata", title: "homeid:creation", occurredAt: "2026-09-12" },
      { id: "newer", title: "Filter changed", occurredAt: "2026-09-10" },
    ];
    expect(recentRecords(items).map((item) => item.id)).toEqual(["newer", "older"]);
    expect(items[0].id).toBe("older");
  });
  it("shows missing identity and address data honestly", () => {
    expect(homeName({ id: "new-home" })).toBe("Untitled property");
    expect(homeAddress({ id: "new-home" })).toBe("");
    expect(homeName({ id: "home", nickname: "My house" })).toBe("My house");
  });
});
