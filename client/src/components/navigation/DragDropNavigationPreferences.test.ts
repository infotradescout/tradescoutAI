import { describe, expect, it } from "vitest";
import { ROUTES } from "@/lib/routes";
import { getDefaultNavigationItems } from "./DragDropNavigationPreferences";

describe("generated admin navigation preferences", () => {
  it.each(["ops_admin", "owner"])(
    "keeps dashboard and panel IDs bound to their distinct canonical owners for %s",
    (role) => {
      const adminItems = getDefaultNavigationItems(role).filter(({ id }) =>
        ["admin-dashboard", "admin-panel"].includes(id)
      );

      expect(ROUTES.ADMIN_DASHBOARD).toBe("/admin");
      expect(ROUTES.ADMIN_PANEL).toBe("/admin/panel");
      expect(ROUTES.ADMIN_DASHBOARD).not.toBe(ROUTES.ADMIN_PANEL);
      expect(adminItems.map(({ id, href }) => ({ id, href }))).toEqual([
        { id: "admin-dashboard", href: ROUTES.ADMIN_DASHBOARD },
        { id: "admin-panel", href: ROUTES.ADMIN_PANEL },
      ]);
    }
  );

  it("does not generate either admin destination for a non-admin role", () => {
    const generatedIds = new Set(getDefaultNavigationItems("homeowner").map(({ id }) => id));

    expect(generatedIds.has("admin-dashboard")).toBe(false);
    expect(generatedIds.has("admin-panel")).toBe(false);
  });
});
