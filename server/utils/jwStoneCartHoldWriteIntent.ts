import type { RequestHandler } from "express";
import { isSameRequestHttpOrigin } from "./requestCors";

/** Use the application's canonical origin policy for both reserve and release. */
export const requireJwStoneCartHoldWriteIntent: RequestHandler = (req, res, next) => {
  if (!isSameRequestHttpOrigin(req, req.get("Origin"))) {
    res.status(403).json({
      code: "same_origin_required",
      message: "Open your JW Stone cart on this site before changing a reservation.",
    });
    return;
  }
  next();
};
