export type ProviderSearchScope =
  | { kind: "county"; countyQuery: string; requestedStateCode: string | null }
  | { kind: "state"; stateCode: string }
  | { kind: "none" }
  | { kind: "invalid"; message: string };

export function parseProviderSearchScope(input: {
  county: unknown;
  state: unknown;
}): ProviderSearchScope {
  const countyProvided = input.county !== undefined && input.county !== null;
  if (countyProvided && typeof input.county !== "string") {
    return { kind: "invalid", message: "Invalid county" };
  }

  const stateProvided = input.state !== undefined && input.state !== null;
  if (stateProvided && typeof input.state !== "string") {
    return { kind: "invalid", message: "Invalid state" };
  }

  const countyQuery = typeof input.county === "string" ? input.county.trim() : "";
  const stateCode = typeof input.state === "string" ? input.state.trim().toUpperCase() : "";

  if (stateProvided && !/^[A-Z]{2}$/.test(stateCode)) {
    return { kind: "invalid", message: "Invalid state" };
  }

  if (countyQuery) {
    return {
      kind: "county",
      countyQuery,
      requestedStateCode: stateCode || null,
    };
  }

  if (stateCode) {
    return { kind: "state", stateCode };
  }

  return { kind: "none" };
}
