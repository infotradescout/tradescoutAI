import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "server/routes/scout.ts"), "utf8");
const missionControl = fs.readFileSync(
  path.join(root, "server/services/missionControl.ts"),
  "utf8"
);

describe("Scout action and completion truthfulness", () => {
  it("does not count a successful Scout HTTP response as completed work", () => {
    expect(route).toContain('outcome: "handed_off"');
    expect(route).toContain(
      'scoutInteractionLog.outcome = res.statusCode >= 400 ? "blocked" : "handed_off"'
    );
    expect(route).not.toContain('outcome: "completed",\n      failureReason: null');
    expect(missionControl).toContain(
      'outcome === "blocked" || outcome === "abandoned"'
    );
  });

  it("distinguishes authorization from a real server-side mutation", () => {
    expect(route).toContain('if (action.type !== "SAVE_PROFILE")');
    expect(route).toContain("authorized: true");
    expect(route).toContain("executed: false");
    expect(route).toContain("executed: true");
    expect(route).not.toContain("Placeholder executor");
    expect(route).not.toContain('return { executed: true, action: act.type };');
  });
});
