export const PRIVATE_APP_SHELL_PREFIXES = [
  "/scout",
  "/auth",
  "/dashboard",
  "/account",
] as const;

export const PRIVATE_APP_SHELL_ROBOTS = "noindex,nofollow,noarchive";

export function isPrivateAppShellPath(requestPath: string): boolean {
  let pathOnly =
    String(requestPath || "/")
      .split("?")[0]
      .split("#")[0]
      .replace(/\/+$/, "") || "/";
  try {
    pathOnly = decodeURIComponent(pathOnly);
  } catch {
    // Keep the raw path. A malformed escape cannot become a recognized route.
  }
  pathOnly = pathOnly.toLowerCase();
  return PRIVATE_APP_SHELL_PREFIXES.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)
  );
}

export function applyPrivateShellNoindex(templateHtml: string): string {
  const robotsTag = `<meta name="robots" content="${PRIVATE_APP_SHELL_ROBOTS}" />`;
  if (/<meta name="robots"[^>]*>/i.test(templateHtml)) {
    return templateHtml.replace(/<meta name="robots"[^>]*>/i, robotsTag);
  }
  if (/<\/head>/i.test(templateHtml)) {
    return templateHtml.replace(/<\/head>/i, `${robotsTag}\n</head>`);
  }
  return `${robotsTag}\n${templateHtml}`;
}
