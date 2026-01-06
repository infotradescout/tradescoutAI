import { jitteredDelay, slugify, sleep } from "../agent-utils.js";

export function createSynthesizerAgent() {
  return {
    id: "synthesizer",
    async execute(task, logger) {
      const intent = task || "seed-data";
      const seedSlug = slugify(`synth-${intent}`);
      await logger.info("Executing synthesizer task", { intent, seed: seedSlug });
      await sleep(jitteredDelay(500, 500));
      return {
        artifact: {
          type: "seed-preview",
          uri: `local://seed/${seedSlug}.json`,
        },
        intent,
      };
    },
  };
}
