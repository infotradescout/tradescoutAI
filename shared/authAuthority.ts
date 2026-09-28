export const TRADESCOUT_AUTHORITY_ORIGIN = "https://www.thetradescout.com" as const;

export function isTradeScoutPrimaryAuthHost(hostname: unknown): boolean {
  const host = String(hostname || "").trim().toLowerCase().split(":")[0];
  return host === "thetradescout.com" || host === "www.thetradescout.com" || host.endsWith(".thetradescout.com");
}

export function canonicalAuthEntryUrl(args: {
  provider?: "google" | "facebook";
  next?: string;
  returnOrigin?: string;
}): string {
  const path = args.provider ? `/api/auth/${args.provider}` : "/pre-scout-setup";
  const target = new URL(path, TRADESCOUT_AUTHORITY_ORIGIN);
  if (!args.provider) target.searchParams.set("mode", "signin");
  if (args.next?.startsWith("/") && !args.next.startsWith("//")) target.searchParams.set("next", args.next);
  if (args.returnOrigin) {
    try {
      const origin = new URL(args.returnOrigin).origin;
      if (origin.startsWith("https://")) target.searchParams.set("returnOrigin", origin);
    } catch {
      // Ignore malformed caller origins.
    }
  }
  return target.toString();
}
