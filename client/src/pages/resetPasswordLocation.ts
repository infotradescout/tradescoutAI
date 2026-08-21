export function readResetPasswordParam(key: string, search?: string): string {
  try {
    const source =
      search ?? (typeof window !== "undefined" ? window.location.search : "");
    return String(new URLSearchParams(source).get(key) || "").trim();
  } catch {
    return "";
  }
}
