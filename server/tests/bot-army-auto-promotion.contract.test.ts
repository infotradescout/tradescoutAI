import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("bot-army auto-promotion contracts", () => {
  it("wires automation runner and resolved-action safeguard in mission control service", () => {
    const source = read("server/services/missionControl.ts");

    expect(source).toContain("export async function runBotArmyAutoPromotion");
    expect(source).toContain("reopenResolved?: boolean");
    expect(source).toContain('if (existing && !reopenResolved && existing.status !== "open")');
    expect(source).toContain("skippedResolvedCount");
    expect(source).toContain("sourceId = `${item.route}::${item.failureType}`");
  });

  it("starts and reports bot-army auto-promotion in scheduler wiring", () => {
    const source = read("server/services/crawlerScheduler.ts");

    expect(source).toContain("startBotArmyAutoPromoteScheduler()");
    expect(source).toContain("BOT_ARMY_AUTO_PROMOTE_ENABLED");
    expect(source).toContain("BOT_ARMY_AUTO_PROMOTE_SCHEDULE");
    expect(source).toContain("botArmyAutoPromoteTask");
    expect(source).toContain("bot_army_auto_promote");
  });

  it("exposes trigger and status routes in mission control", () => {
    const source = read("server/routes/mission-control.ts");

    expect(source).toContain('"/bot-army/auto-promote/trigger"');
    expect(source).toContain('"/bot-army/auto-promote/status"');
    expect(source).toContain("getCrawlerSchedulerStatus");
    expect(source).toContain("runBotArmyAutoPromotion");
  });

  it("surfaces auto-promotion controls in Live Ops", () => {
    const source = read("client/src/pages/admin-live-stream.tsx");

    expect(source).toContain('"/api/admin/mission-control/bot-army/auto-promote/status"');
    expect(source).toContain('"/api/admin/mission-control/bot-army/auto-promote/trigger"');
    expect(source).toContain("Run Auto-Promote Now");
    expect(source).toContain("Auto-Promote Scheduler");
  });
});
