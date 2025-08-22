import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { z } from "zod";
import type { Request, Response } from "express";

const createGoalSchema = z.object({
  targetRecommendations: z.number().min(1),
  targetRating: z.number().min(1).max(5),
  targetTimeframe: z.enum(['30_days', '90_days', '6_months', '1_year']),
});

const createCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  campaignType: z.enum(['email_followup', 'text_reminder', 'personal_ask', 'incentive_offer']),
  targetCustomers: z.array(z.object({
    projectType: z.string().optional(),
    projectValue: z.number().optional(),
    completionDate: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })).default([]),
  frequency: z.enum(['once', 'weekly', 'monthly']).optional(),
  emailTemplate: z.string().optional(),
  textTemplate: z.string().optional(),
  incentiveOffer: z.string().optional(),
});

export function registerRecommendationGeneratorRoutes(app: Express) {
  // Get contractor's recommendation insights
  app.get('/api/contractors/:contractorId/insights', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { contractorId } = req.params;
      
      // Check if user has permission to view this contractor's insights
      const user = req.user as any;
      if (!user || (user.role !== 'contractor_user' && !user.role?.includes('admin'))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get or generate insights
      let insights = await storage.getRecommendationInsight(contractorId);
      if (!insights) {
        insights = await storage.analyzeContractorPerformance(contractorId);
      }

      res.json(insights);
    } catch (error) {
      console.error('Error fetching contractor insights:', error);
      res.status(500).json({ message: 'Failed to fetch insights' });
    }
  });

  // Refresh contractor insights
  app.post('/api/contractors/:contractorId/insights/refresh', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { contractorId } = req.params;
      
      // Check if user has permission
      const user = req.user as any;
      if (!user || (user.role !== 'contractor_user' && !user.role?.includes('admin'))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const insights = await storage.analyzeContractorPerformance(contractorId);
      res.json(insights);
    } catch (error) {
      console.error('Error refreshing contractor insights:', error);
      res.status(500).json({ message: 'Failed to refresh insights' });
    }
  });

  // Get contractor's goals
  app.get('/api/contractors/:contractorId/goals', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { contractorId } = req.params;
      
      // Check if user has permission
      const user = req.user as any;
      if (!user || (user.role !== 'contractor_user' && !user.role?.includes('admin'))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const goals = await storage.getContractorGoals(contractorId);
      res.json(goals);
    } catch (error) {
      console.error('Error fetching contractor goals:', error);
      res.status(500).json({ message: 'Failed to fetch goals' });
    }
  });

  // Create a new goal
  app.post('/api/contractors/:contractorId/goals', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { contractorId } = req.params;
      const goalData = createGoalSchema.parse(req.body);
      
      // Check if user has permission
      const user = req.user as any;
      if (!user || (user.role !== 'contractor_user' && !user.role?.includes('admin'))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get current recommendation count as starting point
      const currentRecommendations = await storage.getRecommendations(contractorId);
      const startingCount = currentRecommendations.filter(r => r.recommendationType === 'positive').length;

      const goal = await storage.createRecommendationGoal({
        contractorId,
        ...goalData,
        startingRecommendations: startingCount,
      });

      res.status(201).json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid goal data', errors: error.errors });
      }
      console.error('Error creating goal:', error);
      res.status(500).json({ message: 'Failed to create goal' });
    }
  });

  // Update goal progress
  app.post('/api/contractors/:contractorId/goals/update-progress', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { contractorId } = req.params;
      
      // Check if user has permission
      const user = req.user as any;
      if (!user || (user.role !== 'contractor_user' && !user.role?.includes('admin'))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.updateGoalProgress(contractorId);
      const updatedGoals = await storage.getContractorGoals(contractorId);
      
      res.json({ message: 'Progress updated', goals: updatedGoals });
    } catch (error) {
      console.error('Error updating goal progress:', error);
      res.status(500).json({ message: 'Failed to update progress' });
    }
  });

  // Get contractor's campaigns
  app.get('/api/contractors/:contractorId/campaigns', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { contractorId } = req.params;
      
      // Check if user has permission
      const user = req.user as any;
      if (!user || (user.role !== 'contractor_user' && !user.role?.includes('admin'))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const campaigns = await storage.getContractorCampaigns(contractorId);
      res.json(campaigns);
    } catch (error) {
      console.error('Error fetching contractor campaigns:', error);
      res.status(500).json({ message: 'Failed to fetch campaigns' });
    }
  });

  // Create a new campaign
  app.post('/api/contractors/:contractorId/campaigns', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { contractorId } = req.params;
      const campaignData = createCampaignSchema.parse(req.body);
      
      // Check if user has permission
      const user = req.user as any;
      if (!user || (user.role !== 'contractor_user' && !user.role?.includes('admin'))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const campaign = await storage.createRecommendationCampaign({
        contractorId,
        ...campaignData,
      });

      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid campaign data', errors: error.errors });
      }
      console.error('Error creating campaign:', error);
      res.status(500).json({ message: 'Failed to create campaign' });
    }
  });

  // Update campaign
  app.put('/api/contractors/:contractorId/campaigns/:campaignId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      const updates = req.body;
      
      // Check if user has permission
      const user = req.user as any;
      if (!user || (user.role !== 'contractor_user' && !user.role?.includes('admin'))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const campaign = await storage.updateRecommendationCampaign(campaignId, updates);
      res.json(campaign);
    } catch (error) {
      console.error('Error updating campaign:', error);
      res.status(500).json({ message: 'Failed to update campaign' });
    }
  });

  // Delete campaign
  app.delete('/api/contractors/:contractorId/campaigns/:campaignId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      
      // Check if user has permission
      const user = req.user as any;
      if (!user || (user.role !== 'contractor_user' && !user.role?.includes('admin'))) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteRecommendationCampaign(campaignId);
      res.json({ message: 'Campaign deleted successfully' });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      res.status(500).json({ message: 'Failed to delete campaign' });
    }
  });

  // Get campaign templates
  app.get('/api/recommendation-generator/templates', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const templates = {
        email: {
          followup: {
            subject: "Thank you for choosing {contractorName} - We'd love your feedback!",
            body: `Hi {customerName},

Thank you for allowing {contractorName} to work on your {projectType} project. We hope you're completely satisfied with the results!

Your feedback means the world to us and helps other homeowners discover quality contractors in their area. Would you mind taking 2 minutes to share your experience?

[Leave a Recommendation]

Thank you for your time!

Best regards,
{contractorName} Team`
          },
          reminder: {
            subject: "Quick reminder - Your feedback helps our business grow",
            body: `Hi {customerName},

I hope you're still enjoying the work we completed on your {projectType} project.

If you have a moment, we'd really appreciate if you could share your experience with other homeowners. Your recommendation helps us continue providing quality service in the community.

[Share Your Experience]

Thank you!

{contractorName}`
          }
        },
        text: {
          followup: "Hi {customerName}, thanks for choosing {contractorName}! If you're happy with your {projectType} project, we'd love a quick recommendation. Link: {recommendationLink}",
          reminder: "Hi {customerName}, hope you're still loving your {projectType} work! A quick recommendation would help us tremendously: {recommendationLink}"
        },
        incentive: {
          discount: "Leave a recommendation and receive 10% off your next project with {contractorName}!",
          referral: "Recommend us to a friend and both of you get $50 off your next project!"
        }
      };

      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ message: 'Failed to fetch templates' });
    }
  });
}