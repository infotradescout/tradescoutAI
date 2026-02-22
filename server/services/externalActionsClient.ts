type ExternalActionsConfig = {
  baseUrl: string;
  token: string;
  timeoutMs: number;
};

function getExternalActionsConfig(): ExternalActionsConfig | null {
  const baseUrl = String(
    process.env.EXTERNAL_ACTIONS_URL || process.env.PARTNER_ACTIONS_URL || ""
  ).trim();
  const token = String(
    process.env.EXTERNAL_ACTIONS_TOKEN || process.env.PARTNER_ACTIONS_TOKEN || ""
  ).trim();

  if (!baseUrl || !token) return null;

  const timeoutMsRaw = Number(process.env.EXTERNAL_ACTIONS_TIMEOUT_MS || 8000);
  const timeoutMs = Number.isFinite(timeoutMsRaw) ? Math.max(2000, timeoutMsRaw) : 8000;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    token,
    timeoutMs,
  };
}

export type ExternalActionRequest = {
  action: string;
  params?: Record<string, unknown>;
};

export type ExternalActionResponse = {
  success?: boolean;
  data?: unknown;
  results?: unknown[];
  count?: number;
  message?: string;
  error?: string;
  supportedActions?: string[];
};

export async function callExternalActions(
  payload: ExternalActionRequest
): Promise<{ ok: true; data: ExternalActionResponse } | { ok: false; error: string }> {
  const cfg = getExternalActionsConfig();
  if (!cfg) {
    return { ok: false, error: "External actions are not configured." };
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId =
    controller !== null ? globalThis.setTimeout(() => controller.abort(), cfg.timeoutMs) : null;

  try {
    const res = await fetch(`${cfg.baseUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });

    const text = await res.text();
    let json: ExternalActionResponse | null = null;
    try {
      json = text ? (JSON.parse(text) as ExternalActionResponse) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg =
        json?.message ||
        json?.error ||
        text ||
        `External actions request failed (status ${res.status}).`;
      return { ok: false, error: msg };
    }

    return { ok: true, data: json || { success: true, data: null } };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return { ok: false, error: "External actions request timed out." };
    }
    return { ok: false, error: "External actions request failed." };
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}
