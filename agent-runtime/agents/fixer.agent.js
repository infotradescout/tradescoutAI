import { jitteredDelay, slugify, sleep } from "../agent-utils.js";

export function createFixerAgent() {
  return {
    id: "fixer",
    async execute(task, logger) {
      const intent = task || "fix-build";
      const patchSlug = slugify(`fixer-${intent}`);
      await logger.info("Executing fixer task", { intent, patch: patchSlug });
      await sleep(jitteredDelay(500, 500));
      return {
        artifact: {
          type: "git-branch",
          uri: `local://branch/${patchSlug}`,
        },
        intent,
      };
    },
  };
}
