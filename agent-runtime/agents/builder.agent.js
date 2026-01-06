import { jitteredDelay, slugify, sleep } from "../agent-utils.js";

export function createBuilderAgent() {
  return {
    id: "builder",
    async execute(task, logger) {
      const intent = task || "build-feature";
      const branchSlug = slugify(`builder-${intent}`);
      await logger.info("Executing builder task", { intent, branch: branchSlug });
      await sleep(jitteredDelay(500, 500));
      return {
        artifact: {
          type: "git-branch",
          uri: `local://branch/${branchSlug}`,
        },
        intent,
      };
    },
  };
}
