import type { Request, Response } from "express";
import {
  buildSteelHomeBuilderPath,
  resolveSteelHomeBuilderRoute,
  STEEL_HOME_BUILDER_ROUTE_COLLECTION,
} from "@shared/steelHomeBuilderRoutes";
import { isSteelHomePackagesProfileSlug } from "@shared/steelHomePackagesProfile";
import { buildPublicProfileCanonicalRedirectTarget } from "./publicProfileItemRouting";
import { sendPublicPageNotFound } from "./utils/publicPageResponse";

type RenderPublicProfileHtml = (args: {
  slug: string;
  origin: string;
  templateHtml: string;
}) => Promise<string | null>;

/**
 * Handles the three shareable Steel Home builder paths before the generic
 * profile item/category resolver sees them. Returning false means the request
 * is outside this route namespace and should continue through normal routing.
 */
export async function serveSteelHomeBuilderProfileRoute(args: {
  req: Request;
  res: Response;
  slug: string;
  collection: unknown;
  itemSlug: unknown;
  origin: string;
  templateHtml: string;
  renderProfileHtml: RenderPublicProfileHtml;
}): Promise<boolean> {
  if (!isSteelHomePackagesProfileSlug(args.slug)) return false;

  const collection = String(args.collection || "")
    .trim()
    .toLowerCase();
  if (collection !== STEEL_HOME_BUILDER_ROUTE_COLLECTION) return false;

  const builder = resolveSteelHomeBuilderRoute(collection, args.itemSlug);
  if (!builder) {
    sendPublicPageNotFound(args.res, "Profile destination not found");
    return true;
  }

  const canonicalPath = buildSteelHomeBuilderPath(builder);
  if (args.req.path.startsWith("/p/")) {
    const destination = buildPublicProfileCanonicalRedirectTarget({
      origin: args.origin,
      canonicalPath,
      referral: args.req.query.ref,
    });
    if (!destination) {
      sendPublicPageNotFound(args.res, "Profile destination not found");
      return true;
    }
    args.res.redirect(301, destination);
    return true;
  }

  const html = await args.renderProfileHtml({
    slug: args.slug,
    origin: args.origin,
    templateHtml: args.templateHtml,
  });
  if (!html) {
    sendPublicPageNotFound(args.res, "Profile destination not found");
    return true;
  }

  args.res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
  args.res.type("html").send(html);
  return true;
}
