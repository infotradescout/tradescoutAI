export type CommunityBuilderActivationPayload = Record<string, unknown>;

export class CommunityBuilderActivationError extends Error {
  readonly code?: string;
  readonly action?: string;

  constructor(message: string, details?: { code?: string; action?: string }) {
    super(message);
    this.name = "CommunityBuilderActivationError";
    this.code = details?.code;
    this.action = details?.action;
  }
}

export async function activateCommunityBuilder(
  fetchImpl: typeof fetch = fetch
): Promise<CommunityBuilderActivationPayload> {
  const response = await fetchImpl("/api/community-builder/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const payload = (await response.json().catch(() => null)) as
    | CommunityBuilderActivationPayload
    | null;

  if (!response.ok) {
    const error =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to activate Community Builder.";
    throw new CommunityBuilderActivationError(error, {
      code: payload && typeof payload.code === "string" ? payload.code : undefined,
      action: payload && typeof payload.action === "string" ? payload.action : undefined,
    });
  }

  return payload ?? {};
}
