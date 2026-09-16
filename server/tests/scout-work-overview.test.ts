import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { loadScoutWorkOverview, projectScoutWorkItem } from "../scout/scoutWorkOverview";
import { createScoutWorkHandler } from "../scout/scoutWorkRoutes";

const owner = "work-owner-a";
const row = { id: "item-1", title: "Kitchen renovation", status: "draft", updated_at: "2026-09-16T12:00:00Z" };
function response() {
  const res = { set: vi.fn(), vary: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("Scout actual work projection", () => {
  it("opens the selected request in the canonical county workspace without sending it", () => {
    const item = projectScoutWorkItem("requests", { ...row, county_fips: "12033" });
    const to = new URL(item!.nextAction.to, "https://example.invalid");
    expect(to.pathname).toBe("/direct-connect/active");
    expect(to.searchParams.get("selected")).toBe(row.id);
    expect(to.searchParams.get("county")).toBe("12033");
    expect(item?.state).toBe("attention");
    expect(item?.statusLabel).toBe("Draft saved");
  });
  it("preserves the exact supply-run record, not a generic start page", () => {
    const item = projectScoutWorkItem("supply_runs", { ...row, order_number: "SR-17", status: "submitted" });
    expect(item?.nextAction.to).toBe("/utilities/supply-run/item-1");
    expect(item?.title).toBe("Supply run SR-17");
    expect(item?.state).toBe("active");
  });
  it("preserves home and project identity together", () => {
    const item = projectScoutWorkItem("home_projects", { ...row, user_home_id: "home-1", status: "planning" });
    const to = new URL(item!.nextAction.to, "https://example.invalid");
    expect(to.pathname).toBe("/homes");
    expect(to.searchParams.get("homeId")).toBe("home-1");
    expect(to.searchParams.get("projectId")).toBe("item-1");
  });
  it("does not create a home-project continuation without its home", () => {
    expect(projectScoutWorkItem("home_projects", row)).toBeNull();
  });
  it.each(["pending", "unconfirmed", "unexpected"])("does not call %s Scout execution complete", (status) => {
    const item = projectScoutWorkItem("scout_actions", { ...row, status, execution_confirmed: true });
    expect(item?.state).toBe("attention");
    expect(item?.statusLabel).toBe("Check result");
    expect(item?.nextAction.to).toBe("/profile-settings");
    expect(item?.detail).toContain("will not repeat");
  });
  it.each([false, null, undefined, "true"])("requires a positive typed completion receipt: %s", (execution_confirmed) => {
    expect(projectScoutWorkItem("scout_actions", { ...row, status: "completed", execution_confirmed })?.state).toBe("attention");
  });
  it("presents an acknowledged save as historical profile work, not a completed job", () => {
    const item = projectScoutWorkItem("scout_actions", { ...row, status: "completed", execution_confirmed: true });
    expect(item?.state).toBe("complete");
    expect(item?.title).toBe("Profile update");
    expect(item?.detail).toContain("was saved");
  });
  it.each(["completed", "complete"])("attributes %s to the owning workspace", (status) => {
    const item = projectScoutWorkItem("requests", { ...row, status });
    expect(item?.statusLabel).toBe("Marked completed");
    expect(item?.detail).toContain("owning workspace");
  });
  it.each(["canceled", "cancelled", "closed", "archived"])("retains %s as closed, not success", (status) => {
    expect(projectScoutWorkItem("requests", { ...row, status })?.state).toBe("closed");
  });
  it("does not invent completion for a new or missing status", () => {
    for (const status of ["new_state", "", null]) expect(projectScoutWorkItem("requests", { ...row, status })?.state).toBe("unknown");
  });
  it("never substitutes a fabricated update time", () => {
    for (const updated_at of [null, "invalid", undefined]) expect(projectScoutWorkItem("requests", { ...row, updated_at })?.updatedAt).toBeNull();
  });
  it("drops source secrets and control characters rather than spreading raw rows", () => {
    const item = projectScoutWorkItem("requests", { ...row, title: "Kitchen\u202e\nupdate", private_token: "SECRET", phone: "PRIVATE", metadata: { secret: true } });
    expect(item?.title).toBe("Kitchenupdate");
    expect(JSON.stringify(item)).not.toMatch(/SECRET|PRIVATE|metadata|private_token|phone/);
  });
  it("encodes record identifiers and only emits internal destinations", () => {
    const item = projectScoutWorkItem("requests", { ...row, id: "x&county=99999", county_fips: "bad" });
    const to = new URL(item!.nextAction.to, "https://example.invalid");
    expect(to.origin).toBe("https://example.invalid");
    expect(to.searchParams.get("selected")).toBe("x&county=99999");
    expect(to.searchParams.has("county")).toBe(false);
  });
});

describe("owner-scoped work reads", () => {
  it("executes four bounded parameterized reads, never a mutation", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const result = await loadScoutWorkOverview(owner, { query });
    expect(query).toHaveBeenCalledTimes(4);
    for (const [sql, values] of query.mock.calls) {
      expect(sql.trim()).toMatch(/^SELECT /);
      expect(sql).not.toMatch(/SELECT \*|\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
      expect(sql).toContain("$1"); expect(sql).toContain("LIMIT $2");
      expect(values).toEqual([owner, 9]); expect(sql).not.toContain(owner);
    }
    expect(result.ownerId).toBe(owner); expect(result.partial).toBe(false);
    expect(result.sections).toHaveLength(4);
  });
  it("retains the home owner's authorization as well as project ownership", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await loadScoutWorkOverview(owner, { query });
    const sql = query.mock.calls.find(([text]) => text.includes("FROM home_projects"))?.[0];
    expect(sql).toContain("h.owner_user_id = $1"); expect(sql).toContain("p.owner_user_id = $1");
  });
  it("distinguishes unavailable sources from empty sources", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM procurement_orders")) throw new Error("secret SQL diagnostic");
      return { rows: [] };
    });
    const result = await loadScoutWorkOverview(owner, { query });
    expect(result.partial).toBe(true);
    expect(result.sections.find((section) => section.kind === "supply_runs")?.availability).toBe("unavailable");
    expect(result.sections.find((section) => section.kind === "requests")?.availability).toBe("ready");
    expect(JSON.stringify(result)).not.toContain("secret SQL");
  });
  it("keeps the display bounded and marks additional records without fake totals", async () => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes("FROM work_requests")
      ? Array.from({ length: 9 }, (_, index) => ({ ...row, id: `r-${index}` })) : [] }));
    const result = await loadScoutWorkOverview(owner, { query });
    expect(result.sections[0].items).toHaveLength(8); expect(result.sections[0].hasMore).toBe(true);
    expect(result).not.toHaveProperty("total");
  });
  it("rejects missing ownership before touching a data source", async () => {
    const query = vi.fn(); await expect(loadScoutWorkOverview("", { query })).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});

describe("actual Scout work HTTP handler", () => {
  it("guests cannot access or query saved work", async () => {
    const database = vi.fn(); const res = response();
    await createScoutWorkHandler(database)({ query: { userId: owner }, body: { ownerId: owner } } as unknown as Request, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(401); expect(database).not.toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });
  it("ignores client-supplied owner IDs and varies private responses by session", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] }); const res = response();
    await createScoutWorkHandler(async () => ({ query }))({ user: { id: owner }, query: { ownerId: "other" }, body: { userId: "other" } } as unknown as Request, res as unknown as Response);
    expect(query.mock.calls.every(([, values]) => values[0] === owner)).toBe(true);
    expect(res.vary).toHaveBeenCalledWith("Cookie"); expect(res.vary).toHaveBeenCalledWith("Authorization");
    expect(res.json.mock.calls[0][0].ownerId).toBe(owner);
  });
  it("supports the authenticated claims identity without taking body identity", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] }); const res = response();
    await createScoutWorkHandler(async () => ({ query }))({ user: { claims: { sub: owner } } } as unknown as Request, res as unknown as Response);
    expect(res.json.mock.calls[0][0].ownerId).toBe(owner);
  });
  it("returns a failure rather than an empty success when all data sources fail", async () => {
    const res = response();
    await createScoutWorkHandler(async () => ({ query: vi.fn().mockRejectedValue(new Error("private error")) }))({ user: { id: owner } } as unknown as Request, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain("private error");
  });
});
