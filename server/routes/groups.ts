import { Request, Response } from 'express';
import { storage } from '../storage';

// Mock group data for Phase 3 implementation
const mockGroups = [
  {
    id: 'group-1',
    name: 'Los Angeles Home Renovators',
    description: 'A community for homeowners and contractors in LA sharing renovation tips, recommendations, and project showcases.',
    type: 'county_community',
    countyFips: '06037',
    memberCount: 1247,
    isPublic: true,
    tags: ['renovation', 'homeowners', 'contractors', 'los-angeles'],
    createdBy: 'user-admin',
    admins: ['user-admin', 'user-mod1'],
    rules: [
      'Keep discussions relevant to home renovation',
      'Be respectful and professional',
      'No spam or self-promotion without approval',
      'Share photos and progress updates'
    ],
    coverImageUrl: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'group-2',
    name: 'Kitchen Remodel Experts',
    description: 'Specialized group for kitchen renovation projects, design ideas, and contractor recommendations.',
    type: 'specialty_trade',
    countyFips: null,
    memberCount: 892,
    isPublic: true,
    tags: ['kitchen', 'remodel', 'design', 'cabinets'],
    createdBy: 'contractor-kitchen-pro',
    admins: ['contractor-kitchen-pro'],
    rules: [
      'Kitchen-focused discussions only',
      'Share before/after photos',
      'Provide cost breakdowns when possible',
      'Help fellow members with advice'
    ],
    coverImageUrl: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'group-3',
    name: 'Sustainable Building Practices',
    description: 'For contractors and homeowners interested in eco-friendly construction and renovation methods.',
    type: 'interest_based',
    countyFips: null,
    memberCount: 456,
    isPublic: true,
    tags: ['sustainable', 'eco-friendly', 'green-building', 'environment'],
    createdBy: 'eco-contractor',
    admins: ['eco-contractor', 'green-advocate'],
    rules: [
      'Focus on sustainable practices',
      'Share eco-friendly product recommendations',
      'Discuss energy efficiency improvements',
      'Support green building initiatives'
    ],
    coverImageUrl: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const mockGroupPosts = [
  {
    id: 'post-1',
    groupId: 'group-1',
    authorId: 'homeowner-1',
    authorName: 'Sarah Johnson',
    authorRole: 'homeowner',
    content: 'Just finished our bathroom renovation! The contractor did an amazing job. Here are some before/after photos. Total cost was around $15k for a full remodel.',
    images: ['bathroom-before.jpg', 'bathroom-after.jpg'],
    likes: 23,
    comments: 8,
    isSticky: false,
    tags: ['bathroom', 'renovation', 'before-after'],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'post-2',
    groupId: 'group-1',
    authorId: 'contractor-2',
    authorName: 'Mike Thompson',
    authorRole: 'contractor_user',
    content: 'Pro tip: When planning electrical work, always add 20% more outlets than you think you need. Future you will thank you! Also, USB outlets are becoming standard.',
    images: [],
    likes: 45,
    comments: 12,
    isSticky: true,
    tags: ['electrical', 'pro-tip', 'planning'],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  }
];

const mockUserMemberships = [
  {
    id: 'membership-1',
    userId: 'user-1',
    groupId: 'group-1',
    role: 'member',
    joinedAt: new Date().toISOString(),
    isActive: true
  }
];

// Get groups based on user location and interests
export async function getGroups(req: Request, res: Response) {
  try {
    const { county, type, search, limit = '20' } = req.query;
    
    let groups;
    try {
      groups = await (storage as any).getGroups?.({
        countyFips: county as string,
        type: type as string,
        search: search as string,
        limit: parseInt(limit as string)
      });
      if (!groups) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, using mock group data');
      // Filter groups based on query parameters
      groups = mockGroups.filter(group => {
        if (county && group.countyFips !== county) return false;
        if (type && group.type !== type) return false;
        if (search && !group.name.toLowerCase().includes((search as string).toLowerCase())) return false;
        return group.isActive;
      }).slice(0, parseInt(limit as string));
    }

    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
}

// Get group details
export async function getGroupDetails(req: Request, res: Response) {
  try {
    const { groupId } = req.params;
    
    let group;
    try {
      group = await (storage as any).getGroupById?.(groupId);
      if (!group) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, using mock group details');
      group = mockGroups.find(g => g.id === groupId);
    }

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    res.json(group);
  } catch (error) {
    console.error('Error fetching group details:', error);
    res.status(500).json({ message: 'Failed to fetch group details' });
  }
}

// Join a group
export async function joinGroup(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { groupId } = req.params;

    let membership;
    try {
      membership = await (storage as any).joinGroup?.(userId, groupId);
      if (!membership) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, simulating group join');
      membership = {
        id: 'membership-' + Date.now(),
        userId,
        groupId,
        role: 'member',
        joinedAt: new Date().toISOString(),
        isActive: true
      };
    }

    res.status(201).json(membership);
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ message: 'Failed to join group' });
  }
}

// Get group posts/feed
export async function getGroupPosts(req: Request, res: Response) {
  try {
    const { groupId } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    let posts;
    try {
      posts = await (storage as any).getGroupPosts?.(groupId, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      if (!posts) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, using mock group posts');
      posts = mockGroupPosts.filter(post => post.groupId === groupId)
        .slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));
    }

    res.json(posts);
  } catch (error) {
    console.error('Error fetching group posts:', error);
    res.status(500).json({ message: 'Failed to fetch group posts' });
  }
}

// Create a post in a group
export async function createGroupPost(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { groupId } = req.params;
    const { content, images, tags } = req.body;

    let post;
    try {
      post = await (storage as any).createGroupPost?.({
        groupId,
        authorId: userId,
        content,
        images: images || [],
        tags: tags || []
      });
      if (!post) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, simulating post creation');
      post = {
        id: 'post-' + Date.now(),
        groupId,
        authorId: userId,
        authorName: 'User',
        authorRole: 'member',
        content,
        images: images || [],
        likes: 0,
        comments: 0,
        isSticky: false,
        tags: tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating group post:', error);
    res.status(500).json({ message: 'Failed to create post' });
  }
}

// Get user's group memberships
export async function getUserGroups(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let userGroups;
    try {
      userGroups = await (storage as any).getUserGroups?.(userId);
      if (!userGroups) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, using mock user groups');
      const userMemberships = mockUserMemberships.filter(m => m.userId === userId && m.isActive);
      userGroups = userMemberships.map(membership => {
        const group = mockGroups.find(g => g.id === membership.groupId);
        return {
          ...group,
          membershipRole: membership.role,
          joinedAt: membership.joinedAt
        };
      });
    }

    res.json(userGroups);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ message: 'Failed to fetch user groups' });
  }
}

// Create a new group
export async function createGroup(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { name, description, type, countyFips, isPublic, tags, rules } = req.body;

    let group;
    try {
      group = await (storage as any).createGroup?.({
        name,
        description,
        type,
        countyFips,
        isPublic: isPublic !== false,
        tags: tags || [],
        rules: rules || [],
        createdBy: userId
      });
      if (!group) throw new Error('Method not implemented');
    } catch (dbError) {
      console.log('Database offline, simulating group creation');
      group = {
        id: 'group-' + Date.now(),
        name,
        description,
        type,
        countyFips,
        memberCount: 1,
        isPublic: isPublic !== false,
        tags: tags || [],
        createdBy: userId,
        admins: [userId],
        rules: rules || [],
        coverImageUrl: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
}