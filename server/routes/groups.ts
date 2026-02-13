import { Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { communityGroups, counties, groupMembers } from "../../shared/schema";
import { eq } from "drizzle-orm";

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

    const userGroups = await (storage as any).getUserGroups?.(userId);
    res.json(userGroups);
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

    let resolvedStateCode = typeof stateCode === "string" ? stateCode : undefined;
    if (!resolvedStateCode && typeof countyFips === "string" && countyFips.trim()) {
      const [county] = await db
        .select({ stateCode: counties.stateCode })
        .from(counties)
        .where(eq(counties.fips, countyFips.trim()))
        .limit(1);
      resolvedStateCode = county?.stateCode || undefined;
    }

    const [group] = await db
      .insert(communityGroups)
      .values({
        name: name.trim(),
        slug,
        description: typeof description === "string" ? description : null,
        groupType: type || "custom",
        scope: countyFips ? "county" : resolvedStateCode ? "state" : "national",
        countyFips: typeof countyFips === "string" ? countyFips : null,
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
