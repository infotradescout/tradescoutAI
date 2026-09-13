/** Inventory staffing is assigned by JW Stone, never inferred from customer membership. */
export const JW_STONE_EMPLOYEE_SCOPES = [
  "inventory_read",
  "inventory_write",
  "inventory_publish",
] as const;
export type JwStoneEmployeeAccount = Readonly<{
  userId: string;
  email: string;
  name: string;
  allowed: boolean;
  source: "owner" | "platform_admin" | "manual" | "server_configuration" | "none";
  revision: string | null;
  expired: boolean;
}>;
export type JwStoneEmployeeAccessChange = Readonly<{
  userId: string;
  allowed: boolean;
  expectedRevision: string | null;
  confirmed: true;
}>;
export class JwStoneEmployeeAccessError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "JwStoneEmployeeAccessError";
    this.status = status;
  }
}
export function jwStoneActorId(user: unknown): string {
  const account = user as { id?: unknown; claims?: { sub?: unknown } } | undefined;
  const id = account?.id || account?.claims?.sub;
  return typeof id === "string" ? id.trim() : "";
}
export function isJwStonePlatformManager(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;
  const account = user as { isSuperAdmin?: unknown; role?: unknown; roles?: unknown };
  const roles = [account.role, ...(Array.isArray(account.roles) ? account.roles : [])]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase());
  return (
    account.isSuperAdmin === true || roles.includes("super_admin") || roles.includes("head_admin")
  );
}
export function jwStoneConfiguredEmployeeIds(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).filter(Boolean))];
}
export function parseJwStoneEmployeeAccessChange(value: unknown): JwStoneEmployeeAccessChange {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new JwStoneEmployeeAccessError(
      "Choose an existing account and confirm the access change."
    );
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => !["userId", "allowed", "expectedRevision", "confirmed"].includes(key)
    ) ||
    typeof input.userId !== "string" ||
    !input.userId.trim() ||
    input.userId.length > 256 ||
    /[\u0000-\u001f\u007f]/.test(input.userId) ||
    typeof input.allowed !== "boolean" ||
    input.confirmed !== true ||
    !(
      input.expectedRevision === null ||
      (typeof input.expectedRevision === "string" &&
        input.expectedRevision.length > 0 &&
        input.expectedRevision.length <= 100)
    )
  ) {
    throw new JwStoneEmployeeAccessError(
      "Choose an existing account and explicitly confirm the access change."
    );
  }
  return {
    userId: input.userId.trim(),
    allowed: input.allowed,
    expectedRevision: input.expectedRevision,
    confirmed: true,
  };
}
export function parseJwStoneEmployeeLookup(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new JwStoneEmployeeAccessError("Enter the account's exact sign-in email.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 1 || typeof input.email !== "string")
    throw new JwStoneEmployeeAccessError("Enter the account's exact sign-in email.");
  const email = input.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new JwStoneEmployeeAccessError("Enter the account's exact sign-in email.");
  return email;
}
