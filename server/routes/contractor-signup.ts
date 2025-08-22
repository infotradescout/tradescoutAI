import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

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
    
    const validatedData = contractorSignupSchema.parse(req.body);
    
    // Import storage dynamically to avoid circular dependency
    const { storage } = await import('../storage');
    
    // Create a contractor application record
    const application = await storage.createContractorApplication({
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
    });
    
    console.log('Contractor application saved to database:', application.id);
    
    // TODO: Send email notifications
    // 1. Send email notification to admin
    // 2. Send confirmation email to contractor
    
    res.json({ 
      success: true, 
      message: 'Application submitted successfully! We will review your application and contact you within 24-48 hours.',
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