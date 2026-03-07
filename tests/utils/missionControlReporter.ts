import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

type TestError = { message?: string; value?: unknown };

type FailureType = "broken" | "stub" | "confusing" | "misleading" | "permission_block";

interface BotFindingPayload {
  botName: string;
  route: string;
  actionAttempted: string;
  expectedOutcome: string;
  actualOutcome: string;
  failureType: FailureType;
  severity: number;
  screenshotUrl?: string;
}

function normalizeRoute(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || "/";
  } catch {
    return url || "/";
  }
}

function extractErrorMessage(errors: TestError[] | undefined): string {
  if (!errors || errors.length === 0) return "Unknown failure";
  return errors
    .map((err) => err.message || (typeof err.value === "string" ? err.value : ""))
    .filter(Boolean)
    .join(" | ")
    .slice(0, 4000);
}

function deriveFailureType(errors: TestError[] | undefined): FailureType {
  const combined = extractErrorMessage(errors).toLowerCase();
  if (combined.includes("403")) return "permission_block";
  if (combined.includes("stub")) return "stub";
  if (combined.includes("misleading") || combined.includes("unexpected")) return "misleading";
  if (
    combined.includes("500") ||
    combined.includes("503") ||
    combined.includes("service unavailable") ||
    combined.includes("uncaught")
  ) {
    return "broken";
  }
  if (combined.includes("timeout") || combined.includes("failed")) return "broken";
  return "broken";
}

async function persistLocalBotFinding(
  payload: BotFindingPayload & { errors?: TestError[] }
): Promise<void> {
  try {
    const outDir = path.join(process.cwd(), "tests", "artifacts");
    await mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, "bot-ui-findings.ndjson");
    await appendFile(
      outFile,
      `${JSON.stringify({ ...payload, capturedAt: new Date().toISOString() })}\n`,
      "utf8"
    );
  } catch (err) {
    console.warn("[BotArmy] Failed to persist local bot finding", err);
  }
}

export async function reportBotUiFinding({
  botName,
  route,
  actionAttempted,
  expectedOutcome,
  actualOutcome,
  failureType,
  severity,
  screenshotUrl,
  errors,
}: BotFindingPayload & { errors?: TestError[] }): Promise<void> {
  const baseUrl = process.env.E2E_BASE_URL || process.env.BASE_URL || "http://localhost:5000";
  const token = process.env.MISSION_CONTROL_BOT_TOKEN;

  const payload: BotFindingPayload = {
    botName,
    route: normalizeRoute(route),
    actionAttempted,
    expectedOutcome,
    actualOutcome,
    failureType: deriveFailureType(errors) || failureType,
    severity: Math.min(5, Math.max(1, Math.round(severity))),
    screenshotUrl,
  };

  if (!token) {
    console.warn("[BotArmy] Missing MISSION_CONTROL_BOT_TOKEN; writing local bot finding artifact");
    await persistLocalBotFinding({ ...payload, errors });
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/api/admin/mission-control/bot-ui-findings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mc-bot-token": token,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn("[BotArmy] Failed to persist bot_ui_findings row", res.status, body);
      await persistLocalBotFinding({ ...payload, errors });
    }
  } catch (err) {
    console.warn("[BotArmy] Error reporting bot UI finding", err);
    await persistLocalBotFinding({ ...payload, errors });
  }
}

export function buildBotFindingPayload({
  url,
  testTitle,
  testPath,
  errors,
  screenshotPath,
  botName,
}: {
  url: string;
  testTitle: string;
  testPath: string;
  errors?: TestError[];
  screenshotPath?: string;
  botName: string;
}): BotFindingPayload & { errors?: TestError[] } {
  const actualOutcome = extractErrorMessage(errors);
  return {
    botName,
    route: normalizeRoute(url),
    actionAttempted: testPath,
    expectedOutcome: testTitle,
    actualOutcome,
    failureType: deriveFailureType(errors),
    severity: 3,
    screenshotUrl: screenshotPath,
    errors,
  };
}
