import { db } from "../.././db";

/**
 * Extract community groups for caching
 */
export async function extractGroups() {
  try {
    const groups = await db.query.communityGroups.findMany({
      where: (table: any, { eq }: any) => eq(table.isActive, true),
      limit: 2000,
    });

    const safeGroups = groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      slug: g.slug,
      groupType: g.groupType,
      scope: g.scope,
      stateCode: g.stateCode,
      countyFips: g.countyFips,
      cityName: g.cityName,
      isPrivate: g.isPrivate,
      memberCount: g.memberCount,
      postCount: g.postCount,
      createdAt: g.createdAt,
    }));

    return safeGroups;
  } catch (error) {
    console.error("Error extracting groups:", error);
    return [];
  }
}
