export class RuntimeCapabilityUnavailableError extends Error {
  readonly code = "RUNTIME_CAPABILITY_UNAVAILABLE";

  constructor(
    readonly capability: string,
    readonly reason: string
  ) {
    super(capability + " is unavailable: " + reason);
    this.name = "RuntimeCapabilityUnavailableError";
  }
}

export function unavailableRuntimeCapability(
  capability: string,
  reason: string
): never {
  throw new RuntimeCapabilityUnavailableError(capability, reason);
}
