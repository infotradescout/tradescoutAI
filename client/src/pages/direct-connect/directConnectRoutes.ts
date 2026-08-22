export const DIRECT_CONNECT_SECTIONS = [
  "post",
  "board",
  "employment",
  "inbox",
  "pros",
  "engagements",
] as const;

export type DirectConnectSection = (typeof DIRECT_CONNECT_SECTIONS)[number];

export function getDirectConnectPathOnly(path: string): string {
  return path.split("?")[0].split("#")[0];
}

export function getDirectConnectEntry(path: string): string | null {
  const query = path.includes("?") ? path.split("?", 2)[1].split("#", 1)[0] : "";
  if (!query) return null;
  return new URLSearchParams(query).get("entry");
}

export function shouldResolveDirectConnectEntry(entry: string | null): entry is string {
  return Boolean(entry && ["default", "auth", "setup", "onboarding", "intent"].includes(entry));
}

export function getDirectConnectSection(path: string): DirectConnectSection {
  const pathOnly = getDirectConnectPathOnly(path);
  const match = pathOnly.match(/^\/direct-connect(?:\/(.+))?/);
  const raw = match?.[1]?.split("/")[0] ?? "";
  if (!raw) {
    const query = path.includes("?") ? path.split("?", 2)[1].split("#", 1)[0] : "";
    const params = new URLSearchParams(query);
    const mode = String(params.get("mode") || "")
      .trim()
      .toLowerCase();
    const intent = String(params.get("intent") || "")
      .trim()
      .toLowerCase();
    if (
      ["directory", "pros", "browse", "browse_only", "local_search"].includes(mode) ||
      ["directory", "browse_only", "local_search", "find_help", "find_person_business"].includes(
        intent
      )
    ) {
      return "pros";
    }
    return "post";
  }

  const aliases: Record<string, DirectConnectSection> = {
    active: "engagements",
    opportunities: "employment",
    businesses: "pros",
  };
  if (aliases[raw]) return aliases[raw];
  if (DIRECT_CONNECT_SECTIONS.includes(raw as DirectConnectSection)) {
    return raw as DirectConnectSection;
  }
  return "post";
}

export function buildDirectConnectHref(section: DirectConnectSection): string {
  if (section === "post") return "/direct-connect";
  const canonicalPaths: Partial<Record<DirectConnectSection, string>> = {
    engagements: "active",
    employment: "opportunities",
    pros: "businesses",
  };
  return `/direct-connect/${canonicalPaths[section] || section}`;
}

export function shouldRenderDirectConnectSectionChrome(section: DirectConnectSection): boolean {
  return section !== "post" && section !== "employment";
}
