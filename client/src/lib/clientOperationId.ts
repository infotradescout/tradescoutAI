export function createClientOperationId(prefix: string): string {
  const normalizedPrefix =
    prefix.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24) || "operation";
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;

  return `${normalizedPrefix}:${randomPart}`;
}
