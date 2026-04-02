import { db } from "../.././db";

/**
 * Extract verified contractors for caching
 * Only includes public profile data
 */
export async function extractContractors() {
  try {
    const contractors = await db.query.contractors.findMany({
      where: (table: any, { eq }: any) => eq(table.isActive, true),
      limit: 5000,
    });

    // Only include public data
    const safeContractors = contractors.map((c: any) => ({
      id: c.id,
      companyName: c.companyName,
      slug: c.slug,
      phone: c.phone,
      email: c.email,
      website: c.website,
      yearsInBusiness: c.yearsInBusiness,
      about: c.about,
      verifiedLicensed: c.verifiedLicensed,
      verifiedInsured: c.verifiedInsured,
      recommendationPercentage: c.recommendationPercentage,
      totalRecommendations: c.totalRecommendations,
      isGeneralContractor: c.isGeneralContractor,
      isResidentialContractor: c.isResidentialContractor,
      acceptsSubcontractWork: c.acceptsSubcontractWork,
      createdAt: c.createdAt,
    }));

    return safeContractors;
  } catch (error) {
    console.error("Error extracting contractors:", error);
    return [];
  }
}
