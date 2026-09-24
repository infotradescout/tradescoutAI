/** A direct Scout visit or embedded work area already has its own task context. */
export function shouldAutoOpenStartGuideAtLocation(
  location: string,
  isTopLevelWindow: boolean
): boolean {
  if (!isTopLevelWindow) return false;
  const path = location.split(/[?#]/, 1)[0];
  return path !== "/scout" && !path.startsWith("/scout/");
}
