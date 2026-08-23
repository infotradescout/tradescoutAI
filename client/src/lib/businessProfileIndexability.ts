export type BusinessProfileSource = "published" | "directory" | null;

/**
 * Hydration may only keep robots=index for the directory source whose API has
 * already passed the canonical publication contract. Legacy preference-backed
 * pages remain exact-link/noindex.
 */
export function shouldNoIndexBusinessProfile(args: {
  profileSource: BusinessProfileSource;
  directoryCrawlable?: boolean | null;
}): boolean {
  return args.profileSource !== "directory" || args.directoryCrawlable !== true;
}
