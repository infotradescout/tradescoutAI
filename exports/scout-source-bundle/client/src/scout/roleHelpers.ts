export function getCurrentUserRole(): string | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const role = window.sessionStorage.getItem("scout:sessionRole");
    return role || undefined;
  } catch {
    return undefined;
  }
}
