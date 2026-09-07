import { notificationService } from "../notification-service";
import { storage } from "../storage";

// Helper function to route leads to top contractors
interface Contractor {
  id: string;
  companyName: string;
  isActive: boolean | null;
  yearsInBusiness: number | null;
  licenseNumber: string | null;
  website: string | null;
  phone: string | null;
  description?: string;
  [key: string]: any;
}

interface ScoredContractor extends Contractor {
  matchScore: number;
}
export async function routeLeadToTopContractors(lead: any, leadData: any) {
  try {
    const { countyId, tradeId } = lead;
    const { county, trade, city, state, maxAssignees } = leadData;
    // Fetch active contractors that match the lead's geography and trade
    const contractors: Contractor[] = await storage.getContractors({
      countyId,
      tradeIds: tradeId ? [tradeId] : undefined,
      sortBy: "verified",
      limit: 50,
    });
    // ...rest of the function remains unchanged...

    // Extract simple keywords from the lead description to improve matching
    const leadDescription: string =
      typeof (leadData as any)?.description === "string"
        ? (leadData as any).description
        : typeof (lead as any)?.description === "string"
          ? (lead as any).description
          : "";

    const leadKeywords = new Set<string>(
      leadDescription
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w: string) => w.length >= 3)
    );

    // Load profile preferences (including servicesDescription) for all contractor owners
    const contractorUserIds = contractors
      .map((c: any) => c.userId)
      .filter((id: any): id is string => typeof id === "string" && id.length > 0);

    const contractorUsers = await storage.getUsersByIds(contractorUserIds);
    const userById = new Map<string, any>();
    for (const u of contractorUsers) {
      userById.set(u.id, u);
    }

    // Enhanced matching logic: Score contractors based on available fields
    const maxRecipients =
      typeof maxAssignees === "number" && maxAssignees > 0 ? Math.min(maxAssignees, 25) : 3;

    const scoredContractors = contractors
      .filter((contractor: Contractor) => !!contractor.isActive) // Only active contractors
      .map((contractor: Contractor): ScoredContractor => {
        let score = 0;
        // Business experience score (base weight) - more years = higher score
        const yearsExp = contractor.yearsInBusiness || 1;
        score += Math.min(50, yearsExp * 2.5); // Cap at 50 points

        // Profile completeness score - more complete = better
        let completeness = 0;
        if (contractor.licenseNumber) completeness += 10;
        if (contractor.website) completeness += 10;
        if (contractor.phone) completeness += 10;
        const owner = contractor.userId ? userById.get(contractor.userId) : undefined;
        const profileServices: string =
          typeof owner?.preferences?.servicesDescription === "string"
            ? owner.preferences.servicesDescription
            : "";

        const aboutText =
          (contractor as any).about ||
          (contractor as any).description ||
          (typeof profileServices === "string" ? profileServices : "") ||
          "";
        if (aboutText) completeness += 10;

        // Content match score: boost contractors whose "about" text
        // contains overlapping keywords with the lead description.
        let keywordScore = 0;
        if (leadKeywords.size && aboutText) {
          const aboutTokens = Array.from(
            new Set<string>(
              aboutText
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter((w: string) => w.length >= 3)
            )
          );

          let matches = 0;
          for (const token of aboutTokens) {
            if (leadKeywords.has(token)) {
              matches += 1;
            }
          }

          // Cap content-match contribution so experience still dominates
          keywordScore = Math.min(20, matches * 4);
        }

        // Recommendation signal: net score and volume
        let recScore = 0;
        const pos = Number((contractor as any).positiveRecommendations || 0);
        const neg = Number((contractor as any).negativeRecommendations || 0);
        const total = Number((contractor as any).totalRecommendations || 0);

        const net = pos - neg;
        if (net > 0) {
          recScore += Math.min(20, net * 2); // reward strong net positive
        }
        if (total > 0) {
          recScore += Math.min(10, Math.log10(total + 1) * 5); // small bump for volume
        }

        score += completeness + keywordScore + recScore;
        return { ...contractor, matchScore: score };
      })
      .sort((a: any, b: any) => b.matchScore - a.matchScore) // Sort by match score
      .slice(0, maxRecipients); // Take top N (default 3)

    if (!scoredContractors || scoredContractors.length === 0) {
      console.warn(
        `No qualified contractors found for lead ${lead.id} in county ${county} for trade ${trade}.`
      );
      return;
    }

    const contractorIds = scoredContractors.map((c: ScoredContractor) => c.id);
    await storage.assignLeadToContractors(lead.id, contractorIds);

    // Log enhanced matching details
    console.log(
      `Enhanced matching for lead ${lead.id}: Selected ${scoredContractors.length} contractors with scores:`,
      scoredContractors.map((c: ScoredContractor) => ({
        name: c.companyName,
        score: c.matchScore?.toFixed(1),
      }))
    );

    await Promise.all(
      scoredContractors.map(async (contractor: ScoredContractor) => {
        try {
          console.log(
            `Notifying contractor ${contractor.companyName} (ID: ${contractor.id}) about new lead ${lead.id}`
          );

          const recipientUserId = contractor.userId;
          if (recipientUserId) {
            await notificationService.createNotification({
              userId: recipientUserId,
              type: "new_project_request",
              title: "New Direct Connect request",
              message: `You have a new Direct Connect request: ${lead.title} in ${city}, ${state}.`,
              actionUrl: `/pro-dashboard/leads/${lead.id}`,
              actionText: "View lead",
              iconName: "briefcase",
              iconColor: "orange",
              deliveryMethods: ["in_app", "push"],
            });
          }
          // Log the assignment event with match score
          await storage.logEvent("lead_assigned", {
            leadId: lead.id,
            contractorId: contractor.id,
            assignmentType: "enhanced_matching",
            matchScore: contractor.matchScore,
          });
        } catch (notificationError) {
          console.error(
            `Failed to notify contractor ${contractor.id} for lead ${lead.id}:`,
            notificationError
          );
        }
      })
    );
  } catch (error: any) {
    console.error(`Error routing lead ${lead.id} to top contractors:`, error);
  }
}
