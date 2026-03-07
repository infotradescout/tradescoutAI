import base, { expect as baseExpect } from "@playwright/test";
import { buildBotFindingPayload, reportBotUiFinding } from "../utils/missionControlReporter";
import { readFile } from "node:fs/promises";

type CapturedNetworkError = {
  url: string;
  status: number;
  statusText: string;
  requestMethod: string;
  timestamp: string;
};

type CapturedConsoleLog = {
  type: string;
  text: string;
  location: string;
  timestamp: string;
};

async function readAttachmentText(attachment: any): Promise<string | null> {
  if (!attachment) return null;
  if (typeof attachment.body === "string") return attachment.body;
  if (attachment.body && Buffer.isBuffer(attachment.body)) {
    return attachment.body.toString("utf8");
  }
  if (attachment.path) {
    try {
      return await readFile(attachment.path, "utf8");
    } catch {
      return null;
    }
  }
  return null;
}

async function buildAttachmentErrors(testInfo: any): Promise<Array<{ message: string }>> {
  const attachmentErrors: Array<{ message: string }> = [];

  const networkAttachment = (testInfo.attachments || []).find(
    (att: any) => att.name === "network-errors"
  );
  const consoleAttachment = (testInfo.attachments || []).find(
    (att: any) => att.name === "console-logs"
  );

  const networkText = await readAttachmentText(networkAttachment);
  if (networkText) {
    try {
      const networkRows = JSON.parse(networkText);
      if (Array.isArray(networkRows) && networkRows.length > 0) {
        const sample = networkRows
          .slice(0, 6)
          .map((row: any) => `${row?.requestMethod || "GET"} ${row?.url || ""} -> ${row?.status || ""}`)
          .join(" | ");
        attachmentErrors.push({
          message: `Network errors (${networkRows.length}): ${sample}`,
        });
      }
    } catch {
      attachmentErrors.push({ message: `Network errors attachment unreadable: ${networkText}` });
    }
  }

  const consoleText = await readAttachmentText(consoleAttachment);
  if (consoleText) {
    try {
      const consoleRows = JSON.parse(consoleText);
      if (Array.isArray(consoleRows)) {
        const errorRows = consoleRows.filter((row: any) => String(row?.type || "") === "error");
        if (errorRows.length > 0) {
          const sample = errorRows
            .slice(0, 4)
            .map((row: any) => String(row?.text || "").slice(0, 220))
            .join(" | ");
          attachmentErrors.push({
            message: `Console errors (${errorRows.length}): ${sample}`,
          });
        }
      }
    } catch {
      attachmentErrors.push({ message: `Console logs attachment unreadable: ${consoleText}` });
    }
  }

  return attachmentErrors;
}

const test = base.extend<{ missionControlFinding: void }>({
  missionControlFinding: [
    async ({ page }, use, testInfo) => {
      const networkErrors: CapturedNetworkError[] = [];
      const consoleLogs: CapturedConsoleLog[] = [];

      const onResponse = (response: any) => {
        try {
          if (!response.ok() && response.status() >= 400) {
            networkErrors.push({
              url: response.url(),
              status: response.status(),
              statusText: response.statusText(),
              requestMethod: response.request().method(),
              timestamp: new Date().toISOString(),
            });
          }
        } catch {
          // fail-soft
        }
      };

      const onConsole = (message: any) => {
        try {
          consoleLogs.push({
            type: message.type(),
            text: message.text(),
            location: message.location()?.url || "",
            timestamp: new Date().toISOString(),
          });
        } catch {
          // fail-soft
        }
      };

      const onPageError = (error: Error) => {
        consoleLogs.push({
          type: "error",
          text: `Uncaught: ${error.message}`,
          location: error.stack || "",
          timestamp: new Date().toISOString(),
        });
      };

      page.on("response", onResponse);
      page.on("console", onConsole);
      page.on("pageerror", onPageError);

      await use();
      page.off("response", onResponse);
      page.off("console", onConsole);
      page.off("pageerror", onPageError);

      if (networkErrors.length > 0) {
        await testInfo.attach("network-errors", {
          body: JSON.stringify(networkErrors, null, 2),
          contentType: "application/json",
        });
      }
      if (consoleLogs.length > 0) {
        await testInfo.attach("console-logs", {
          body: JSON.stringify(consoleLogs, null, 2),
          contentType: "application/json",
        });
      }

      // Only log genuine failures; bots never influence success paths
      if (testInfo.status !== "failed" && testInfo.status !== "timedOut") {
        return;
      }

      const botName = process.env.BOT_ARMY_BOT_NAME || `${testInfo.project.name || "chromium"}-bot`;
      const lastUrl = page?.url?.() || "/";
      const titlePathValue =
        typeof (testInfo as any).titlePath === "function"
          ? (testInfo as any).titlePath()
          : Array.isArray((testInfo as any).titlePath)
            ? (testInfo as any).titlePath
            : [];
      const testPath = titlePathValue.length > 0 ? titlePathValue.join(" > ") : testInfo.title;
      const screenshotPath = (testInfo.attachments || []).find(
        (att) =>
          att.path && (att.contentType?.startsWith("image/") || att.name?.includes("screenshot"))
      )?.path;
      const attachmentErrors = await buildAttachmentErrors(testInfo);
      const mergedErrors = [...(testInfo.errors || []), ...attachmentErrors];

      const payload = buildBotFindingPayload({
        url: lastUrl,
        testTitle: testInfo.title,
        testPath,
        errors: mergedErrors,
        screenshotPath,
        botName,
      });

      await reportBotUiFinding(payload);
    },
    { auto: true },
  ],
});

export { test, baseExpect as expect };
