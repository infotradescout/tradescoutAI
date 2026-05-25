import { Router } from "express";
import { z } from "zod";
import { emailService } from "../services/emailService";
import {
  startUnifiedOnboarding,
  submitUnifiedOnboardingClaim,
} from "../services/onboardingService";

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
  agreeToTerms: z.boolean().refine((val) => val === true),
  agreeToVerification: z.boolean().refine((val) => val === true),
});

// Handle contractor signup
router.post("/api/contractor-signup", async (req, res) => {
  try {
    // Do not log raw request bodies (PII risk). Keep logs minimal if needed.

    const userId = (req as any)?.user?.id || (req as any)?.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required. System agents and users must identify before declaring contractor claims.",
      });
    }

    const validatedData = contractorSignupSchema.parse(req.body);

    // Import storage dynamically to avoid circular dependency
    const { storage } = await import("../storage");

    // Legacy compatibility wrapper: route contractor signup through unified onboarding.
    await startUnifiedOnboarding(storage as any, {
      userId,
      lane: "offer_services",
      claimType: "offer_local_services",
      legacySource: "contractor_signup",
      profile: {
        fullName: validatedData.companyName,
        phone: validatedData.phone,
        location: {
          state: validatedData.primaryState,
          county: validatedData.primaryCounty,
        },
      },
    });
    await submitUnifiedOnboardingClaim(storage as any, {
      userId,
      lane: "offer_services",
      claimType: "offer_local_services",
      countyFips: validatedData.primaryCounty,
      countyName: validatedData.primaryCounty,
      legacySource: "contractor_signup",
    });

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
      status: "starter_pending",
      starterPath: true,
      verificationStatus: "pending",
    });

    console.log("Contractor application saved to database:", application.id);

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
          purpose: "contractor_signup_admin",
        });

        await emailService.sendEmail({
          to: validatedData.email,
          from: "applications@tradescout.com",
          subject: "Application Received - TradeScout",
          html: `<p>Hi ${validatedData.companyName},</p>
               <p>Thank you for applying to join TradeScout! We've received your application and will review it within 24-48 hours.</p>
               <p>We'll contact you at ${validatedData.email} once the review is complete.</p>
               <p>Best regards,<br>TradeScout Team</p>`,
          purpose: "contractor_signup_confirmation",
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
      message:
        "Contractor starter recorded. We will verify your information before any contractor capabilities are unlocked.",
      applicationId: application.id,
    });
  } catch (error) {
    console.error("Contractor signup error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid form data",
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Application submission failed",
    });
  }
});

export { router as contractorSignupRouter };
