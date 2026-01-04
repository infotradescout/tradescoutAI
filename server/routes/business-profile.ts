/**
 * Business Profile Routes
 * PHASE 3d-C: Published Presence Surface
 * 
 * Endpoints for publishing and managing business profiles.
 */

import type { Express, Request, Response } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../auth';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type {
  PublishProfilePayload,
  UpdateProfilePayload,
  BusinessProfile,
} from '../../shared/businessProfile';

interface AuthedRequest extends Request {
  user?: {
    id: string;
    [key: string]: any;
  } & Express.User;
}

/**
 * Slugify helper: businessName || userName → URL-safe slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces/hyphens
    .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Ensure slug uniqueness by appending random suffix if needed
 */
async function ensureUniqueSlug(baseSlug: string, userId: string): Promise<string> {
  let slug = baseSlug;
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    const existing = await storage.getBusinessProfileBySlug(slug);
    if (!existing || existing.userId === userId) {
      return slug;
    }
    // Append random 4-char suffix
    const suffix = Math.random().toString(36).substring(2, 6);
    slug = `${baseSlug}-${suffix}`;
    attempt++;
  }

  // Fallback: timestamp-based suffix
  return `${baseSlug}-${Date.now()}`;
}

export function registerBusinessProfileRoutes(app: Express) {
  /**
   * POST /api/business-profile/publish
   * Publish profileDraft → BusinessProfile (creates or updates)
   */
  app.post(
    '/api/business-profile/publish',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as AuthedRequest).user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const payload = req.body as PublishProfilePayload;

        if (!payload.name || !payload.countyFips || !payload.stateCode) {
          return res.status(400).json({
            message: 'name, countyFips, and stateCode are required',
          });
        }

        // Generate slug
        const baseSlug = slugify(payload.name);
        const slug = await ensureUniqueSlug(baseSlug, userId);

        // Check if user already has a published profile
        const existing = await storage.getBusinessProfileByUserId(userId);

        const now = new Date().toISOString();

        const profileData: BusinessProfile = {
          id: existing?.id || crypto.randomUUID(),
          userId,
          slug,
          name: payload.name,
          description: payload.description || null,
          countyFips: payload.countyFips,
          countyName: payload.countyName || null,
          city: payload.city || null,
          stateCode: payload.stateCode,
          serviceAreas: payload.serviceAreas || [payload.countyFips],
          website: payload.website || null,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          publishedAt: existing?.publishedAt || now,
        };

        const savedProfile = await storage.saveBusinessProfile(profileData);

        // Update user record with slug for easy reference
        await db
          .update(users)
          .set({ businessSlug: slug })
          .where(eq(users.id, userId));

        res.json({
          success: true,
          profile: savedProfile,
          slug,
        });
      } catch (error: any) {
        console.error('Error publishing business profile:', error);
        res.status(500).json({ message: error?.message || 'Failed to publish profile' });
      }
    }
  );

  /**
   * GET /api/business-profile/slug/:slug
   * Fetch a published business profile by slug (public endpoint)
   */
  app.get('/api/business-profile/slug/:slug', async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const profile = await storage.getBusinessProfileBySlug(slug);

      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }

      res.json(profile);
    } catch (error: any) {
      console.error('Error fetching business profile by slug:', error);
      res.status(500).json({ message: error?.message || 'Failed to fetch profile' });
    }
  });

  /**
   * GET /api/business-profile/me
   * Fetch the authenticated user's published business profile
   */
  app.get(
    '/api/business-profile/me',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as AuthedRequest).user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const profile = await storage.getBusinessProfileByUserId(userId);

        if (!profile) {
          return res.status(404).json({ message: 'No published profile found' });
        }

        res.json(profile);
      } catch (error: any) {
        console.error('Error fetching user business profile:', error);
        res.status(500).json({ message: error?.message || 'Failed to fetch profile' });
      }
    }
  );

  /**
   * PATCH /api/business-profile/me
   * Update the authenticated user's published business profile
   */
  app.patch(
    '/api/business-profile/me',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as AuthedRequest).user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const existing = await storage.getBusinessProfileByUserId(userId);

        if (!existing) {
          return res.status(404).json({ message: 'No published profile to update' });
        }

        const updates = req.body as UpdateProfilePayload;

        const updatedProfile: BusinessProfile = {
          ...existing,
          name: updates.name ?? existing.name,
          description: updates.description !== undefined ? updates.description : existing.description,
          city: updates.city !== undefined ? updates.city : existing.city,
          serviceAreas: updates.serviceAreas ?? existing.serviceAreas,
          website: updates.website !== undefined ? updates.website : existing.website,
          updatedAt: new Date().toISOString(),
        };

        const saved = await storage.saveBusinessProfile(updatedProfile);

        res.json({
          success: true,
          profile: saved,
        });
      } catch (error: any) {
        console.error('Error updating business profile:', error);
        res.status(500).json({ message: error?.message || 'Failed to update profile' });
      }
    }
  );

  /**
   * POST /api/scout/copy-assist
   * Scout generates 2 variants for description, headline, or services
   * PHASE 3e-A: Copy Assist v1.0 (description)
   * PHASE 3e-A.1: Copy Assist v1.1 (headline + services)
   */
  app.post(
    '/api/scout/copy-assist',
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const {
          businessName,
          countyName,
          stateCode,
          serviceAreas = [],
          field = 'description',
          existingDescription = '',
          existingHeadline = '',
          existingServices = [],
          userType = 'business_owner',
        } = req.body;

        if (!businessName || !countyName || !stateCode) {
          return res.status(400).json({
            message: 'businessName, countyName, and stateCode are required',
          });
        }

        // Validate field
        if (!['description', 'headline', 'services'].includes(field)) {
          return res.status(400).json({
            message: 'field must be one of: description, headline, services',
          });
        }

        // Build prompt context
        const serviceAreaText = serviceAreas.length > 0 ? `, serving ${serviceAreas.join(', ')}` : '';
        const currentDescContext = existingDescription
          ? `\nCurrent description: "${existingDescription}"`
          : '';
        const currentHeadlineContext = existingHeadline
          ? `\nCurrent headline: "${existingHeadline}"`
          : '';
        const currentServicesContext = existingServices && existingServices.length > 0
          ? `\nCurrent services:\n${(existingServices as string[]).map(s => `- ${s}`).join('\n')}`
          : '';

        // Field-specific prompt contracts
        let systemPrompt: string;
        let userPrompt: string;
        let charLimit: number;

        if (field === 'headline') {
          systemPrompt = `You are Scout, TradeScout's AI assistant. Your job is to improve business headlines.

Generate exactly 2 headline variants for a business:

1. Variant A (Safe): Factual, locality-forward, clarity-first. States what they do and where. Optimized for: readability, trust, SEO. Target length: 60–80 characters.

2. Variant B (Growth): Slightly more compelling, emphasizes outcomes or differentiation. Benefit-led but factual. Optimized for: discoverability, conversion. Target length: 60–80 characters.

Constraints:
- No fake statistics, unverified claims, or hype
- No ALL CAPS, emoji, or clickbait
- Character count must be 60–80 (count carefully)
- Always include county + service type when possible
- Both must be immediately usable

Output exactly this JSON (no markdown):
{
  "variants": [
    {"id": "safe", "text": "...", "rationale": "..."},
    {"id": "growth", "text": "...", "rationale": "..."}
  ]
}`;
          userPrompt = `Business: ${businessName} in ${countyName}, ${stateCode}${serviceAreaText}
User type: ${userType}${currentHeadlineContext}

Generate 2 headline variants (60–80 chars each).`;
          charLimit = 80;
        } else if (field === 'services') {
          systemPrompt = `You are Scout, TradeScout's AI assistant. Your job is to improve business service listings.

Generate exactly 2 service-list variants for a business:

1. Variant A (Safe): Core services, clear language, general audience. Capability-focused. Lists 3–5 services, each 40–80 characters.

2. Variant B (Growth): Services with light outcome focus (what this enables or solves). Benefit-led but factual. Lists 3–5 services, each 40–80 characters.

Constraints:
- No fake claims or exaggeration
- Each bullet must be 40–80 characters (count carefully)
- Format as one service per line, no bullet markers
- Total 3–5 services
- Both must be immediately usable

Output exactly this JSON (no markdown):
{
  "variants": [
    {"id": "safe", "text": "service1\\nservice2\\nservice3", "rationale": "..."},
    {"id": "growth", "text": "service1\\nservice2\\nservice3", "rationale": "..."}
  ]
}`;
          userPrompt = `Business: ${businessName} in ${countyName}, ${stateCode}${serviceAreaText}
User type: ${userType}${currentServicesContext}

Generate 2 service-list variants (3–5 services each, 40–80 chars per service).`;
          charLimit = 500; // Higher limit for multi-line services
        } else {
          // description (v1.0)
          systemPrompt = `You are Scout, TradeScout's AI assistant for business profile optimization. Your job is to improve business descriptions for both SEO clarity and user confidence—never hype, never spam, always authentic.

Generate exactly 2 description variants for a business:

1. Variant A (Safe): Factual, locality-forward, clarity-first. Preserves user's voice if description exists. Includes business name + service area context. Optimized for: readability, trust, SEO. Target length: 120–160 characters. Tone: professional, straightforward.

2. Variant B (Growth): Differentiated, benefits-led, competitive. Emphasizes what makes this business stand out. Highlights service quality or specialization. Optimized for: discoverability, conversion, confidence. Target length: 140–180 characters. Tone: assertive, outcome-focused.

Constraints:
- No fake statistics, unverified claims, or hype
- No ALL CAPS, emoji, or clickbait phrasing
- No character limits exceeded (count carefully)
- No generic boilerplate
- Always include county + service area(s) if provided
- Always anchor to actual user type
- Both variants must be immediately usable; user should never need to edit for legality

Output exactly this JSON (no markdown, no extra text):
{
  "variants": [
    {"id": "safe", "text": "...", "rationale": "..."},
    {"id": "growth", "text": "...", "rationale": "..."}
  ]
}`;
          userPrompt = `Business: ${businessName} in ${countyName}, ${stateCode}${serviceAreaText}
User type: ${userType}${currentDescContext}

Generate 2 variants for this business description.`;
          charLimit = 200;
        }

        // Call Claude API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 500,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: userPrompt,
              },
            ],
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Claude API error:', error);
          return res.status(500).json({ message: 'Failed to generate variants' });
        }

        const data = await response.json() as any;
        const content = data.content?.[0]?.text || '';

        // Parse JSON from response (Claude may wrap in markdown code blocks)
        let jsonStr = content;
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }

        const parsed = JSON.parse(jsonStr);

        // Validate response shape
        if (!parsed.variants || !Array.isArray(parsed.variants) || parsed.variants.length !== 2) {
          return res.status(500).json({ message: 'Invalid response from Claude' });
        }

        // Validate each variant
        for (const variant of parsed.variants) {
          if (!variant.id || !variant.text || !variant.rationale) {
            return res.status(500).json({ message: 'Invalid variant structure' });
          }
          // Character limit check
          if (variant.text.length > charLimit) {
            return res.status(500).json({ message: `Variant ${variant.id} exceeds ${charLimit} character limit` });
          }
        }

        res.json({
          variants: parsed.variants,
        });
      } catch (error: any) {
        console.error('Error in copy assist:', error);
        res.status(500).json({ message: error?.message || 'Failed to generate variants' });
      }
    }
  );
}
