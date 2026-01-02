import base, { expect as baseExpect } from "@playwright/test";
import { buildBotFindingPayload, reportBotUiFinding } from "../utils/missionControlReporter";

const test = base.extend<{ missionControlFinding: void }>({
  missionControlFinding: [
    async ({ page }, use, testInfo) => {
      await use();

      // Only log genuine failures; bots never influence success paths
      if (testInfo.status !== "failed" && testInfo.status !== "timedOut") {
        return;
      }

      const botName = process.env.BOT_ARMY_BOT_NAME || `${testInfo.project.name || "chromium"}-bot`;
      const lastUrl = page?.url?.() || "/";
      const testPath = testInfo.titlePath().join(" › ");
      const screenshotPath = (testInfo.attachments || []).find(
        (att) => att.path && (att.contentType?.startsWith("image/") || att.name?.includes("screenshot")),
      )?.path;

      const payload = buildBotFindingPayload({
        url: lastUrl,
        testTitle: testInfo.title,
        testPath,
        errors: testInfo.errors,
        screenshotPath,
        botName,
      });

      await reportBotUiFinding(payload);
    },
    { auto: true },
  ],
});

export { test, baseExpect as expect };
