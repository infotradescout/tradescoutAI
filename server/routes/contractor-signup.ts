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
    
    // Create a contractor application record
    const application = {
      id: crypto.randomUUID(),
      ...validatedData,
      status: 'pending',
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      notes: null
    };
    
    // Store the application (for now, we'll just log it)
    console.log('Contractor application:', application);
    
    // In a real implementation, you would:
    // 1. Save to database
    // 2. Send email notification to admin
    // 3. Send confirmation email to contractor
    
    res.json({ 
      success: true, 
      message: 'Application submitted successfully',
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