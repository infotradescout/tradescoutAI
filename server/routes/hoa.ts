import { Request, Response } from "express";
import { storage } from "../storage";

// Middleware to check HOA permissions based on capability flags
async function checkHOAPermission(
  userId: string,
  hoaId: string,
  requiredPermission: "view" | "viewFinances" | "editDocuments" | "manageVendors" | "createVotes"
) {
  const user = await storage.getUser(userId);

  // Super/head admin can see everything for debugging and support
  const platformRole = (user as any)?.role;
  if (platformRole === "super_admin" || platformRole === "head_admin") {
    return { authorized: true, member: null };
  }

  const member = await storage.getHOAMemberByUserId(userId, hoaId);

  if (!member) {
    return { authorized: false, member: null };
  }

  switch (requiredPermission) {
    case "viewFinances":
      return { authorized: member.canViewFinances, member };
    case "editDocuments":
      return { authorized: member.canEditDocuments, member };
    case "manageVendors":
      return { authorized: member.canManageVendors, member };
    case "createVotes":
      return { authorized: member.canCreateVotes, member };
    default:
      return { authorized: true, member }; // Basic view permission
  }
}

// Role-based HOA guard for admin-level actions
async function requireHoaRole(userId: string, hoaId: string, allowedRoles: string[]) {
  const user = await storage.getUser(userId);

  // Super/head admin can always perform HOA role operations when needed
  const platformRole = (user as any)?.role;
  if (platformRole === "super_admin" || platformRole === "head_admin") {
    return { authorized: true, member: null };
  }

  const member = await storage.getHOAMemberByUserId(userId, hoaId);

  if (!member) {
    return { authorized: false, member: null };
  }

  if (!allowedRoles.includes(member.role)) {
    return { authorized: false, member };
  }

  return { authorized: true, member };
}

// Get HOA information
export async function getHOA(req: Request, res: Response) {
  try {
    const { hoaId } = req.params;
    const [hoa, governance] = await Promise.all([
      storage.getHOAById(hoaId),
      (storage as any).getHOAGovernance(hoaId),
    ]);

    if (!hoa) {
      return res.status(404).json({ message: "HOA not found" });
    }

    res.json({ ...hoa, governance });
  } catch (error) {
    console.error("Error fetching HOA:", error);
    res.status(500).json({ message: "Failed to fetch HOA information" });
  }
}

// Get HOA financial data
export async function getHOAFinances(req: Request, res: Response) {
  try {
    const { hoaId } = req.params;
    const finances = await storage.getHOAFinances(hoaId);

    if (!finances) {
      return res.status(404).json({ message: "Financial data not found" });
    }

    res.json(finances);
  } catch (error) {
    console.error("Error fetching HOA finances:", error);
    res.status(500).json({ message: "Failed to fetch financial data" });
  }
}

// Get HOA vendors
export async function getHOAVendors(req: Request, res: Response) {
  try {
    const { hoaId } = req.params;
    const vendors = await storage.getHOAVendors(hoaId);
    res.json(vendors);
  } catch (error) {
    console.error("Error fetching HOA vendors:", error);
    res.status(500).json({ message: "Failed to fetch vendor data" });
  }
}

// Get active votes
export async function getHOAVotes(req: Request, res: Response) {
  try {
    const { hoaId } = req.params;
    const votes = await storage.getHOAVotes(hoaId);
    res.json(votes);
  } catch (error) {
    console.error("Error fetching HOA votes:", error);
    res.status(500).json({ message: "Failed to fetch voting data" });
  }
}

// Submit a vote
export async function submitVote(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { voteId } = req.params;
    const { decision } = (req.body ?? {}) as any;
    const voteResult = await storage.submitHOAVote(userId, voteId, decision);
    res.status(201).json(voteResult);
  } catch (error) {
    console.error("Error submitting vote:", error);
    res.status(500).json({ message: "Failed to submit vote" });
  }
}

// Request vendor services
export async function requestVendorService(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { vendorId } = req.params;
    const { serviceType, description, urgency, contactPreference } = (req.body ?? {}) as any;

    const serviceRequest = await storage.createVendorServiceRequest({
      userId,
      vendorId,
      serviceType,
      description,
      urgency,
      contactPreference,
    });

    res.status(201).json(serviceRequest);
  } catch (error) {
    console.error("Error requesting vendor service:", error);
    res.status(500).json({ message: "Failed to request service" });
  }
}

// Collect HOA fees and create resident-level audit records
export async function collectHOAFee(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { hoaId, residentId, amount, description, paymentMethod, externalRef } = (req.body ??
      {}) as any;
    const amountNumber = Number(amount);
    if (!hoaId || !residentId || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res
        .status(400)
        .json({ message: "hoaId, residentId and positive numeric amount are required" });
    }

    // Require at least basic finance-view permission to initiate fee collection
    const { authorized } = await checkHOAPermission(userId, hoaId, "viewFinances");
    if (!authorized) {
      return res.status(403).json({ message: "Insufficient permissions to collect fees" });
    }

    const recordHoaFeeCollection = (storage as any).recordHoaFeeCollection;
    if (typeof recordHoaFeeCollection !== "function") {
      return res.status(501).json({ message: "HOA fee ledger collection is not implemented" });
    }

    const feePayment = await recordHoaFeeCollection.call(storage, {
      hoaId,
      residentId,
      amount: amountNumber,
      description,
      collectedByUserId: userId,
      paymentMethod,
      externalRef,
    });

    return res.status(201).json({
      success: true,
      message: "Fee collection recorded",
      paymentId: feePayment.id,
      receipt: {
        id: feePayment.id,
        hoaId: feePayment.hoaId,
        residentId: feePayment.residentId,
        amount: feePayment.amount,
        description: feePayment.description,
        paymentMethod: feePayment.paymentMethod,
        externalRef: feePayment.externalRef,
        collectedByUserId: feePayment.collectedByUserId,
        collectedAt: feePayment.createdAt,
      },
    });
  } catch (error) {
    if ((error as any)?.code === "42P01") {
      return res.status(501).json({ message: "HOA fee ledger table is not migrated yet" });
    }
    console.error("Error collecting HOA fee:", error);
    res.status(500).json({ message: "Failed to collect fee" });
  }
}

// Search HOAs by location
export async function searchHOAs(req: Request, res: Response) {
  try {
    const { county, zip, city, state } = req.query;
    const hoas = await storage.searchHOAs({
      countyFips: county as string,
      zip: zip as string,
      city: city as string,
      state: state as string,
    });

    res.json(hoas);
  } catch (error) {
    console.error("Error searching HOAs:", error);
    res.status(500).json({ message: "Failed to search HOAs" });
  }
}

// HOA Member Management Routes
export async function getHOAMember(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { hoaId } = req.params;
    const member = await storage.getHOAMemberByUserId(userId, hoaId);

    if (!member) {
      return res.status(404).json({ message: "Not a member of this HOA" });
    }

    res.json(member);
  } catch (error) {
    console.error("Error fetching HOA member:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getHOAMembers(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { hoaId } = req.params;

    // Check if user has permission to view members
    const { authorized } = await checkHOAPermission(userId, hoaId, "view");
    if (!authorized) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const members = await storage.getHOAMembers(hoaId);
    res.json(members);
  } catch (error) {
    console.error("Error fetching HOA members:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function addHOAMember(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { hoaId } = req.params;
    const { userId: newUserId, unitNumber, role, votingRights } = (req.body ?? {}) as any;
    // Check if requesting user has required HOA role
    const { authorized } = await requireHoaRole(userId, hoaId, ["president", "vice_president"]);
    if (!authorized) {
      return res
        .status(403)
        .json({ message: "Only presidents and vice presidents can add members" });
    }

    const newMember = await storage.addHOAMember({
      hoaId,
      userId: newUserId,
      unitNumber,
      role,
      votingRights,
    });

    res.json(newMember);
  } catch (error) {
    console.error("Error adding HOA member:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateHOAMemberRole(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { hoaId, memberId } = req.params;
    const { role } = (req.body ?? {}) as any;
    // Check if requesting user has required HOA role
    const { authorized } = await requireHoaRole(userId, hoaId, ["president"]);
    if (!authorized) {
      return res.status(403).json({ message: "Only presidents can change member roles" });
    }

    const updatedMember = await storage.updateHOAMemberRole(memberId, role);
    res.json(updatedMember);
  } catch (error) {
    console.error("Error updating HOA member role:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
