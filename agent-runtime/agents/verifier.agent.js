import { jitteredDelay, slugify, sleep } from "../agent-utils.js";

export function createVerifierAgent() {
  return {
    id: "verifier",
    async execute(task, logger) {
      const intent = task || "verify-flows";
      const reportSlug = slugify(`verifier-${intent}`);
      await logger.info("Executing verifier task", { intent, report: reportSlug });
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
