/** A direct Scout visit or embedded work area already has its own task context. */
export function shouldAutoOpenStartGuideAtLocation(
  location: string,
  isTopLevelWindow: boolean
): boolean {
  if (!isTopLevelWindow) return false;
  const path = location.split(/[?#]/, 1)[0];
  const isScoutDealDetail =
    /^\/deals\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path);
  return path !== "/scout" && !path.startsWith("/scout/") && !isScoutDealDetail;
}
