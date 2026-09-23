/** A direct Scout visit already gives the user a place to state their goal. */
export function shouldAutoOpenStartGuideAtLocation(location: string): boolean {
  const path = location.split(/[?#]/, 1)[0];
  return path !== "/scout" && !path.startsWith("/scout/");
}
