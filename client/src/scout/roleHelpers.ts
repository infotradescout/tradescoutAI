import { getCurrentUser } from "../contexts/SessionContext";

export function getCurrentUserRole(): string | undefined {
  try {
    const user = getCurrentUser?.();
    return (user as any)?.role as string | undefined;
  } catch {
    return undefined;
  }
}
