import { hasPrivilegedVerificationBypass } from "./utils/privilegedVerification";

// Express middleware to require address verification
export const requireAddressVerification = async (req: any, res: any, next: any) => {
  try {
    const user = req.user;
    // Skip for admin endpoints and certain public routes
    if (
      req.path.startsWith("/api/admin") ||
      req.path.startsWith("/api/address-verification") ||
      req.path.includes("/api/auth/") ||
      req.path.includes("/public-objects/")
    ) {
      return next();
    }
    // Admin/staff always bypass verification gates.
    if (hasPrivilegedVerificationBypass(user)) {
      return next();
    }
    // Check if user's address is already verified
    if (user?.addressVerified) {
      return next();
    }
    // If not verified, block access
    return res.status(403).json({ message: "Address verification required." });
  } catch (error) {
    console.error("Address verification middleware error:", error);
    return res.status(500).json({ message: "Internal error in address verification." });
  }
};
