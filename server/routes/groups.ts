import { Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { communityGroups, counties, groupMembers } from "../../shared/schema";
import { and, eq } from "drizzle-orm";

async function ensureCountyGroupMembershipForUser(userId: string): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user) return;

  const stateCodeRaw =
    (user as any).stateCode ?? (user as any).state_code ?? (user as any).state ?? "";
  const countyFipsRaw = (user as any).countyFips ?? (user as any).county_fips ?? "";

  const stateCode = String(stateCodeRaw || "")
    .trim()
    .toUpperCase();
  const countyFips = String(countyFipsRaw || "").trim();

  if (!/^[A-Z]{2}$/.test(stateCode) || !/^\d{5}$/.test(countyFips)) {
    return;
  }

  const [countyRow] = await db
    .select({ name: counties.name })
    .from(counties)
    .where(and(eq(counties.fips, countyFips), eq(counties.stateCode, stateCode)))
    .limit(1);

  const countyName = String(countyRow?.name || `County ${countyFips}`);
  const slug = `county-${stateCode.toLowerCase()}-${countyFips}`;

  const [existingGroup] = await db
    .select({ id: communityGroups.id })
    .from(communityGroups)
    .where(
      and(
        eq(communityGroups.scope, "county" as any),
        eq(communityGroups.stateCode, stateCode),
        eq(communityGroups.countyFips, countyFips),
        eq(communityGroups.isActive, true)
      )
    )
    .limit(1);

  let groupId = existingGroup?.id as string | undefined;

  if (!groupId) {
    try {
      const [created] = await db
        .insert(communityGroups)
        .values({
          name: `${countyName} Community`,
          slug,
          description: `Automatic county community group for ${countyName}.`,
          groupType: "auto_county",
          autoCreated: true,
          scope: "county",
          stateCode,
          countyFips,
          isPrivate: false,
          createdBy: null,
          isActive: true,
        } as any)
        .returning({ id: communityGroups.id });
      groupId = created?.id;
    } catch {
      const [raceWinner] = await db
        .select({ id: communityGroups.id })
        .from(communityGroups)
        .where(
          and(
            eq(communityGroups.scope, "county" as any),
            eq(communityGroups.stateCode, stateCode),
            eq(communityGroups.countyFips, countyFips),
            eq(communityGroups.isActive, true)
          )
        )
        .limit(1);
      groupId = raceWinner?.id as string | undefined;
    }
  }

  if (groupId) {
    await storage.joinGroup(userId, groupId);
  }
}

// Get groups based on user location and interests
export async function getGroups(req: Request, res: Response) {
  try {
    const { county, state, search, limit = "20", offset = "0" } = req.query;
    const groups = await storage.getGroups({
      stateCode: state as string,
      countyFips: county as string,
      search: search as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
    res.json(groups);
  } catch (error) {
    console.error("Error fetching groups:", error);
    res.status(500).json({ message: "Failed to fetch groups" });
  }
}

// Get group details
export async function getGroupDetails(req: Request, res: Response) {
  try {
    const { groupId } = req.params;
    const group = await storage.getGroupById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json(group);
  } catch (error) {
    console.error("Error fetching group details:", error);
    res.status(500).json({ message: "Failed to fetch group details" });
  }
}

// Join a group
export async function joinGroup(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { groupId } = req.params;
    const membership = await storage.joinGroup(userId, groupId);
    res.status(201).json(membership);
  } catch (error) {
    console.error("Error joining group:", error);
    res.status(500).json({ message: "Failed to join group" });
  }
}

// Get group posts/feed
export async function getGroupPosts(req: Request, res: Response) {
  try {
    const { groupId } = req.params;
    const posts = await storage.getGroupPosts(groupId);
    res.json(posts);
  } catch (error) {
    console.error("Error fetching group posts:", error);
    res.status(500).json({ message: "Failed to fetch group posts" });
  }
}

// Create a post in a group
export async function createGroupPost(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { groupId } = req.params;
    const { content, images } = (req.body ?? {}) as any;

    const post = await storage.createGroupPost({
      groupId,
      authorId: userId,
      content,
      images: images || [],
    });

    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating group post:", error);
    res.status(500).json({ message: "Failed to create post" });
  }
}

// Get user's group memberships
export async function getUserGroups(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    await ensureCountyGroupMembershipForUser(String(userId));

    const user = await storage.getUser(String(userId));
    const stateCode =
      typeof (user as any)?.stateCode === "string"
        ? String((user as any).stateCode)
            .trim()
            .toUpperCase()
        : typeof (user as any)?.state === "string"
          ? String((user as any).state)
              .trim()
              .toUpperCase()
          : undefined;
    const countyFips =
      typeof (user as any)?.countyFips === "string"
        ? String((user as any).countyFips).trim()
        : typeof (user as any)?.county_fips === "string"
          ? String((user as any).county_fips).trim()
          : undefined;

    const userGroups = await storage.getGroups({
      userId: String(userId),
      stateCode: /^[A-Z]{2}$/.test(String(stateCode || "")) ? stateCode : undefined,
      countyFips: /^\d{5}$/.test(String(countyFips || "")) ? countyFips : undefined,
      limit: 100,
      offset: 0,
    });

    res.json({ groups: userGroups });
  } catch (error) {
    console.error("Error fetching user groups:", error);
    res.status(500).json({ message: "Failed to fetch user groups" });
  }
}

// Create a new group
export async function createGroup(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { name, description, type, countyFips, stateCode, isPublic } = (req.body ?? {}) as any;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Group name is required" });
    }

    const slugBase =
      String(name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "group";
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 7)}`;

    const user = await storage.getUser(String(userId));

    const bodyCountyFips = typeof countyFips === "string" ? countyFips.trim() : "";
    const userCountyFips =
      typeof (user as any)?.countyFips === "string"
        ? String((user as any).countyFips).trim()
        : typeof (user as any)?.county_fips === "string"
          ? String((user as any).county_fips).trim()
          : "";
    const resolvedCountyFips = /^\d{5}$/.test(bodyCountyFips)
      ? bodyCountyFips
      : /^\d{5}$/.test(userCountyFips)
        ? userCountyFips
        : "";

    let resolvedStateCode =
      typeof stateCode === "string" && stateCode.trim()
        ? stateCode.trim().toUpperCase()
        : typeof (user as any)?.stateCode === "string"
          ? String((user as any).stateCode)
              .trim()
              .toUpperCase()
          : typeof (user as any)?.state === "string"
            ? String((user as any).state)
                .trim()
                .toUpperCase()
            : undefined;

    if ((!resolvedStateCode || !/^[A-Z]{2}$/.test(resolvedStateCode)) && resolvedCountyFips) {
      const [county] = await db
        .select({ stateCode: counties.stateCode })
        .from(counties)
        .where(eq(counties.fips, resolvedCountyFips))
        .limit(1);
      resolvedStateCode = county?.stateCode || undefined;
    }

    const typeRaw = String(type || "custom")
      .trim()
      .toLowerCase();
    const normalizedType:
      | "auto_county"
      | "custom"
      | "trade"
      | "business"
      | "interest"
      | "neighborhood" = (() => {
      if (typeRaw === "county_community") return "neighborhood";
      if (typeRaw === "specialty_trade") return "trade";
      if (typeRaw === "interest_based") return "interest";
      if (
        typeRaw === "auto_county" ||
        typeRaw === "custom" ||
        typeRaw === "trade" ||
        typeRaw === "business" ||
        typeRaw === "interest" ||
        typeRaw === "neighborhood"
      ) {
        return typeRaw;
      }
      return "custom";
    })();

    const [group] = await db
      .insert(communityGroups)
      .values({
        name: name.trim(),
        slug,
        description: typeof description === "string" ? description : null,
        groupType: normalizedType,
        scope: resolvedCountyFips ? "county" : resolvedStateCode ? "state" : "national",
        countyFips: resolvedCountyFips || null,
        stateCode: resolvedStateCode || null,
        isPrivate: isPublic === false,
        createdBy: String(userId),
        isActive: true,
      } as any)
      .returning();

    await db.insert(groupMembers).values({
      groupId: group.id,
      userId: String(userId),
      role: "owner",
      isActive: true,
    } as any);

    res.status(201).json(group);
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ message: "Failed to create group" });
  }
}
