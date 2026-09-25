/** Direct discovery, detail, and request visits already have their own task context. */
export function shouldAutoOpenStartGuideAtLocation(
  location: string,
  isTopLevelWindow: boolean
): boolean {
  if (!isTopLevelWindow) return false;
  const path = location.split(/[?#]/, 1)[0];
  const isScoutDealDetail =
    /^\/deals\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path);
  const isToolListingDetail = /^\/exchange\/tools\/[a-z0-9_-]{1,160}\/?$/i.test(path);
  const ownsTask =
    path === "/scout" ||
    path.startsWith("/scout/") ||
    path === "/contractors" ||
    path === "/find-local-businesses" ||
    path === "/direct-connect" ||
    path.startsWith("/direct-connect/") ||
    /^\/business\/[^/]+$/i.test(path) ||
    /^\/community\/posts\/[^/]+$/i.test(path);
  return !ownsTask && !isScoutDealDetail && !isToolListingDetail;
}
