import type { Express, Request, Response } from "express";
import { PUBLIC_SHELL_ALIASES, resolvePublicShellAlias } from "@shared/publicShellAliases";

function redirectPublicShellAlias(req: Request, res: Response): void {
  const target = resolvePublicShellAlias(req.path);
  if (!target) {
    res.status(404).end();
    return;
  }
  const queryIndex = req.originalUrl.indexOf("?");
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.redirect(308, `${target}${query}`);
}

export function registerPublicShellAliasRoutes(app: Express): void {
  const paths = PUBLIC_SHELL_ALIASES.map(([publicPath]) => publicPath);
  app.head(paths, redirectPublicShellAlias);
  app.get(paths, redirectPublicShellAlias);
}
