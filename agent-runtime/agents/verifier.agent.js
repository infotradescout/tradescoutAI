import { jitteredDelay, slugify, sleep } from "../agent-utils.js";

export function createVerifierAgent() {
  return {
    id: "verifier",
    async execute(task, logger) {
      const intent = task || "verify-flows";
      const reportSlug = slugify(`verifier-${intent}`);
      const chaosEnabled = process.env.VERIFIER_CHAOS_MODE === "true";
      const chaosProb = Number(process.env.VERIFIER_CHAOS_PROB || 0.2);

      await logger.info("Executing verifier task", { intent, chaosEnabled, chaosProb });

      // Potential chaos scenarios (only when enabled)
      if (chaosEnabled && Math.random() < chaosProb) {
        const scenarios = [
          "missing_artifact",
          "scope_violation",
          "timeout_stall",
          "false_success",
          "crash_loop",
        ];
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        await logger.warn("CHAOS: triggering scenario", { scenario });

        if (scenario === "missing_artifact") {
          await sleep(jitteredDelay(250, 250));
          return { intent, artifact: null };
        }

        if (scenario === "scope_violation") {
          await sleep(jitteredDelay(250, 250));
          return {
            intent,
            artifact: { type: "report", uri: `local://report/${reportSlug}.json` },
            overrideScope: { write: "main" },
          };
        }

        if (scenario === "timeout_stall") {
          const hb = Number(process.env.AGENT_HEARTBEAT_SEC || 30);
          // Sleep beyond 2x heartbeat to simulate stall
          const stallMs = Math.max(1, hb * 2.5 * 1000);
          await logger.warn("CHAOS: simulating stall", { stallMs });
          await sleep(stallMs);
          // Return a normal artifact (supervisor should have timed out already)
          return {
            intent,
            artifact: { type: "report", uri: `local://report/${reportSlug}.json` },
          };
        }

        if (scenario === "false_success") {
          await sleep(jitteredDelay(250, 250));
          return {
            intent,
            artifact: { type: "report", uri: `local://report/${reportSlug}.json` },
            flags: ["suspect"],
            report: { failingAssertions: 3, notes: "Injected failing checks despite success" },
          };
        }

        if (scenario === "crash_loop") {
          await sleep(jitteredDelay(250, 250));
          throw new Error("CHAOS: verifier induced crash");
        }
      }

      // Normal behavior
      await sleep(jitteredDelay(500, 500));
      return {
        artifact: {
          type: "report",
          uri: `local://report/${reportSlug}.json`,
        },
        intent,
      };
    },
  };
}
