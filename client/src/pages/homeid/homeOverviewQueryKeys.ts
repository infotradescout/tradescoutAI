/** Preserve canonical endpoint prefixes so saves in the existing editors invalidate the overview.
 * The viewer suffix prevents a different signed-in user from receiving cached property data.
 */
export function homeOverviewQueryKeys(homeId: string, viewerId: string) {
  const encoded = encodeURIComponent(homeId);
  return {
    detail: [`/api/homes/${encoded}`, "overview", viewerId] as const,
    projects: [`/api/homes/${encoded}/projects`, "overview", viewerId] as const,
    schedules: [`/api/homes/${encoded}/maintenance-schedules`, "overview", viewerId] as const,
    persistence: [`/api/homeid/${encoded}/persistence`, "overview", viewerId] as const,
  };
}
