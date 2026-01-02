import { Router } from "express";
import { z } from "zod";
import { emailService } from "../services/emailService";
import { ClaimSource, ClaimType, isValidCountyFips } from "../services/claimEventSchema";
import { writeClaimEvent } from "../services/claimEventService";

const router = Router();

const contractorSignupSchema = z.object({
  companyName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  website: z.string().optional(),
  primaryState: z.string().min(1),
  primaryCounty: z.string().min(1),
  serviceRadius: z.string().min(1),
  yearsInBusiness: z.number().min(0),
  licenseNumber: z.string().min(1),
  insuranceProvider: z.string().min(1),
  primaryTrade: z.string().min(1),
  specialties: z.array(z.string()).min(1),
  about: z.string().min(50),
  preferredContact: z.enum(["phone", "email", "both"]),
  agreeToTerms: z.boolean().refine(val => val === true),
  agreeToVerification: z.boolean().refine(val => val === true)
});

// Handle contractor signup
router.post('/api/contractor-signup', async (req, res) => {
  try {
    console.log('Contractor signup request received:', req.body);

    const userId = (req as any)?.user?.id || (req as any)?.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. System agents and users must identify before declaring contractor claims.',
      });
    }
    
    const validatedData = contractorSignupSchema.parse(req.body);
    
    // Import storage dynamically to avoid circular dependency
    const { storage } = await import('../storage');
    
    // Create a contractor application record
    const application = await storage.createContractorApplication({
      userId,
      companyName: validatedData.companyName,
      email: validatedData.email,
      phone: validatedData.phone,
      website: validatedData.website,
      primaryState: validatedData.primaryState,
      primaryCounty: validatedData.primaryCounty,
      serviceRadius: validatedData.serviceRadius,
      yearsInBusiness: validatedData.yearsInBusiness,
      licenseNumber: validatedData.licenseNumber,
      insuranceProvider: validatedData.insuranceProvider,
      primaryTrade: validatedData.primaryTrade,
      specialties: validatedData.specialties,
      about: validatedData.about,
      preferredContact: validatedData.preferredContact,
      agreeToTerms: validatedData.agreeToTerms,
      agreeToVerification: validatedData.agreeToVerification,
      status: 'starter_pending',
      starterPath: true,
      verificationStatus: 'pending',
    });
    
    console.log('Contractor application saved to database:', application.id);
    
    // Claims-first: record intent to provide services as a starter path (no capabilities unlocked)
    const countyFips = validatedData.primaryCounty;
    if (isValidCountyFips(countyFips)) {
      try {
        await writeClaimEvent({
          userId,
          claimType: ClaimType.PROVIDES_SERVICES,
          countyFips,
          countyName: validatedData.primaryCounty,
          source: ClaimSource.SIGNUP,
          claimTimestamp: new Date(),
          metadata: {
            path: 'contractor_starter',
            verificationStatus: 'pending',
            companyName: validatedData.companyName,
            email: validatedData.email,
          },
        });
      } catch (claimErr) {
        console.warn('Contractor starter claim write skipped', { claimErr });
      }
    } else {
      console.warn('Contractor starter claim skipped due to invalid county fips', {
        userId,
        countyFips,
      });
    }

    // Send email notifications (if SendGrid configured)
    try {
      if (emailService.isConfigured()) {
        await emailService.sendEmail({
          to: process.env.ADMIN_EMAIL || "admin@tradescout.com",
          from: "notifications@tradescout.com",
          subject: "New Contractor Application",
          html: `<p>New contractor application received from ${validatedData.companyName}</p>
               <p>Business: ${validatedData.companyName}</p>
               <p>Email: ${validatedData.email}</p>
               <p>Phone: ${validatedData.phone}</p>`,
        });

        await emailService.sendEmail({
          to: validatedData.email,
          from: "applications@tradescout.com",
          subject: "Application Received - TradeScout",
          html: `<p>Hi ${validatedData.companyName},</p>
               <p>Thank you for applying to join TradeScout! We've received your application and will review it within 24-48 hours.</p>
               <p>We'll contact you at ${validatedData.email} once the review is complete.</p>
               <p>Best regards,<br>TradeScout Team</p>`,
        });

        console.log("Email notifications sent successfully");
      } else {
        console.log("SendGrid not configured - skipping email notifications");
      }
    } catch (emailError) {
      console.error("Error sending email notifications:", emailError);
    }
    
    res.json({ 
      success: true, 
      message: 'Contractor starter recorded. We will verify your information before any contractor capabilities are unlocked.',
      applicationId: application.id
    });
    
  } catch (error) {
    console.error('Contractor signup error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid form data',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Application submission failed'
    });
  }
});

export { router as contractorSignupRouter };