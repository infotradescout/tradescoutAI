export function isOnboardingSurfacePath(value: unknown): boolean {
  const path =
    String(value || "")
      .split("?")[0]
      .split("#")[0]
      .replace(/\/+$/, "") || "/";
  return (
    path === "/onboarding" ||
    path === "/onboarding/profile" ||
    path === "/onboarding/intent" ||
    path === "/profile-setup"
  );
}
