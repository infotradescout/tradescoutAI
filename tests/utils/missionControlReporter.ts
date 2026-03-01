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
  if (combined.includes("timeout") || combined.includes("failed")) return "broken";
  return "broken";
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

  if (!token) {
    console.warn("[BotArmy] Missing MISSION_CONTROL_BOT_TOKEN; skipping mission control ingest");
    return;
  }

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
    }
  } catch (err) {
    console.warn("[BotArmy] Error reporting bot UI finding", err);
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
