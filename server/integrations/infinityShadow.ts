import { createHash } from "node:crypto";

type InfinityShadowResult = "sent" | "disabled" | "failed";

function config() {
  const baseUrl = String(process.env.INFINITY_API_URL || "").replace(/\/$/, "");
  const apiKey = String(process.env.INFINITY_API_KEY || "");
  const tenantId = String(process.env.INFINITY_TENANT_ID || "");
  const programId = String(process.env.INFINITY_PROGRAM_ID || "");
  return { baseUrl, apiKey, tenantId, programId };
}

function objectId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

async function post(
  path: string,
  body: unknown,
  idempotencyKey?: string
): Promise<InfinityShadowResult> {
  const current = config();
  if (!current.baseUrl || !current.apiKey || !current.tenantId || !current.programId) {
    return "disabled";
  }
  if (process.env.NODE_ENV === "production" && !current.baseUrl.startsWith("https://")) {
    console.warn("[infinity-shadow] disabled: production endpoint must use HTTPS");
    return "disabled";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(`${current.baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${current.apiKey}`,
        "content-type": "application/json",
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Infinity returned ${response.status}`);
    return "sent";
  } catch (error) {
    console.warn("[infinity-shadow] observation was not delivered", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

export async function mirrorInfinityTouch(input: {
  partnerId?: string;
  affiliateTag: string;
  canonicalPath: string;
  source: string;
  carrier: "query_ref" | "path_segment" | "redirect_code" | "cookie" | "session";
}): Promise<InfinityShadowResult> {
  const current = config();
  return post("/v1/attribution-touches", {
    programId: current.programId,
    partnerId: input.partnerId || input.affiliateTag,
    carrier: input.carrier,
    target: {
      object: {
        tenantId: current.tenantId,
        objectType: "tradescout_route",
        objectId: objectId(input.canonicalPath),
      },
      canonicalPath: input.canonicalPath,
    },
    evidence: { affiliateTag: input.affiliateTag, source: input.source },
  });
}

export async function mirrorInfinityConversion(input: {
  conversionEventId: string;
  conversionType: string;
  targetPath: string | null;
  targetId: string | null;
  attributionProofId: string;
}): Promise<InfinityShadowResult> {
  const current = config();
  const identity = input.targetId || input.targetPath || input.conversionEventId;
  return post(
    "/v1/conversion-evidence",
    {
      object: {
        tenantId: current.tenantId,
        objectType: "tradescout_conversion",
        objectId: objectId(identity),
      },
      eventType: input.conversionType,
      occurredAt: new Date().toISOString(),
      attributionProofId: input.attributionProofId,
    },
    `tradescout:${input.conversionEventId}`
  );
}
