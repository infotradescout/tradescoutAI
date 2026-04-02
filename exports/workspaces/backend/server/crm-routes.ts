import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import {
  insertCrmContactSchema,
  insertCrmDealSchema,
  insertCrmActivitySchema,
  insertCrmEmailTemplateSchema,
  insertCrmPipelineSchema,
} from "@shared/schema";
import { isAuthenticated } from "./auth";
import { emailService } from "./services/emailService";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export function registerCrmRoutes(app: Express) {
  // CRM Contact routes
  app.get("/api/crm/contacts", async (req, res) => {
    try {
      const { status, assignedTo, search } = req.query;
      const contacts = await storage.getAllCrmContacts({
        status: status as string,
        assignedTo: assignedTo as string,
        search: search as string,
      });
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching CRM contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get("/api/crm/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.getCrmContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      console.error("Error fetching CRM contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post("/api/crm/contacts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const contactData = insertCrmContactSchema.parse(req.body);
      const contact = await storage.createCrmContact(contactData);

      // Log CRM activity for new contact creation
      await storage.createCrmActivity({
        type: "note",
        subject: "Contact Created",
        description: `New contact ${contactData.firstName} ${contactData.lastName} has been added to the CRM system.`,
        contactId: contact.id,
        createdByUserId: (req.user as any)?.id || contactData.assignedToUserId || "",
      });

      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating CRM contact:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.put("/api/crm/contacts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      const contact = await storage.updateCrmContact(req.params.id, updates);

      // Log activity for contact update
      await storage.createCrmActivity({
        type: "note",
        subject: "Contact Updated",
        description: `Contact information has been updated.`,
        contactId: contact.id,
        createdByUserId: (req.user as any)?.id || "",
      });

      res.json(contact);
    } catch (error) {
      console.error("Error updating CRM contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/crm/contacts/:id", async (req, res) => {
    try {
      await storage.deleteCrmContact(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting CRM contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // CRM Deal routes
  app.get("/api/crm/deals", async (req, res) => {
    try {
      const { stage, assignedTo, contactId } = req.query;
      const deals = await storage.getAllCrmDeals({
        stage: stage as string,
        assignedTo: assignedTo as string,
        contactId: contactId as string,
      });
      res.json(deals);
    } catch (error) {
      console.error("Error fetching CRM deals:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });

  app.get("/api/crm/deals/:id", async (req, res) => {
    try {
      const deal = await storage.getCrmDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      console.error("Error fetching CRM deal:", error);
      res.status(500).json({ message: "Failed to fetch deal" });
    }
  });

  app.post("/api/crm/deals", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const dealData = insertCrmDealSchema.parse(req.body);
      const deal = await storage.createCrmDeal(dealData);

      // Log activity for deal creation
      await storage.createCrmActivity({
        type: "note",
        subject: "Deal Created",
        description: `New deal "${dealData.title}" has been created with a value of $${dealData.value || 0}.`,
        contactId: dealData.contactId,
        dealId: deal.id,
        createdByUserId: (req.user as any)?.id || dealData.assignedToUserId || "",
      });

      res.status(201).json(deal);
    } catch (error) {
      console.error("Error creating CRM deal:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create deal" });
    }
  });

  app.put("/api/crm/deals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      const deal = await storage.updateCrmDeal(req.params.id, updates);

      // Log activity for deal update
      let description = "Deal has been updated.";
      if (updates.stage) {
        description = `Deal stage changed to ${updates.stage}.`;
      }
      if (updates.value) {
        description += ` Value updated to $${updates.value}.`;
      }

      await storage.createCrmActivity({
        type: "note",
        subject: "Deal Updated",
        description,
        contactId: deal.contactId,
        dealId: deal.id,
        createdByUserId: (req.user as any)?.id || "",
      });

      res.json(deal);
    } catch (error) {
      console.error("Error updating CRM deal:", error);
      res.status(500).json({ message: "Failed to update deal" });
    }
  });

  app.delete("/api/crm/deals/:id", async (req, res) => {
    try {
      await storage.deleteCrmDeal(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting CRM deal:", error);
      res.status(500).json({ message: "Failed to delete deal" });
    }
  });

  // CRM Activity routes
  app.get("/api/crm/activities", async (req, res) => {
    try {
      const { type, contactId, dealId } = req.query;
      const activities = await storage.getAllCrmActivities({
        type: type as string,
        contactId: contactId as string,
        dealId: dealId as string,
      });
      res.json(activities);
    } catch (error) {
      console.error("Error fetching CRM activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.get("/api/crm/activities/contact/:contactId", async (req, res) => {
    try {
      const activities = await storage.getCrmActivitiesByContact(req.params.contactId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching contact activities:", error);
      res.status(500).json({ message: "Failed to fetch contact activities" });
    }
  });

  app.get("/api/crm/activities/deal/:dealId", async (req, res) => {
    try {
      const activities = await storage.getCrmActivitiesByDeal(req.params.dealId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching deal activities:", error);
      res.status(500).json({ message: "Failed to fetch deal activities" });
    }
  });

  app.post("/api/crm/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const activityData = insertCrmActivitySchema.parse(req.body);

      // Set the created by user if not provided
      if (!activityData.createdByUserId && (req.user as any)?.id) {
        activityData.createdByUserId = (req.user as any).id;
      }

      const activity = await storage.createCrmActivity(activityData);
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating CRM activity:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  app.put("/api/crm/activities/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      const activity = await storage.updateCrmActivity(req.params.id, updates);
      res.json(activity);
    } catch (error) {
      console.error("Error updating CRM activity:", error);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  app.delete("/api/crm/activities/:id", async (req, res) => {
    try {
      await storage.deleteCrmActivity(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting CRM activity:", error);
      res.status(500).json({ message: "Failed to delete activity" });
    }
  });

  // CRM Email Template routes
  app.get("/api/crm/email-templates", async (req, res) => {
    try {
      const { category } = req.query;
      const templates = await storage.getAllCrmEmailTemplates(category as string);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching CRM email templates:", error);
      res.status(500).json({ message: "Failed to fetch email templates" });
    }
  });

  app.get("/api/crm/email-templates/:id", async (req, res) => {
    try {
      const template = await storage.getCrmEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Email template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching CRM email template:", error);
      res.status(500).json({ message: "Failed to fetch email template" });
    }
  });

  app.post("/api/crm/email-templates", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const templateData = insertCrmEmailTemplateSchema.parse(req.body);

      // Set the created by user if not provided
      if (!templateData.createdByUserId && (req.user as any)?.id) {
        templateData.createdByUserId = (req.user as any).id;
      }

      const template = await storage.createCrmEmailTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating CRM email template:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create email template" });
    }
  });

  app.put("/api/crm/email-templates/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      const template = await storage.updateCrmEmailTemplate(req.params.id, updates);
      res.json(template);
    } catch (error) {
      console.error("Error updating CRM email template:", error);
      res.status(500).json({ message: "Failed to update email template" });
    }
  });

  app.delete("/api/crm/email-templates/:id", async (req, res) => {
    try {
      await storage.deleteCrmEmailTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting CRM email template:", error);
      res.status(500).json({ message: "Failed to delete email template" });
    }
  });

  // CRM Pipeline routes
  app.get("/api/crm/pipelines", async (req, res) => {
    try {
      const pipelines = await storage.getAllCrmPipelines();
      res.json(pipelines);
    } catch (error) {
      console.error("Error fetching CRM pipelines:", error);
      res.status(500).json({ message: "Failed to fetch pipelines" });
    }
  });

  app.get("/api/crm/pipelines/default", async (req, res) => {
    try {
      const pipeline = await storage.getDefaultCrmPipeline();
      if (!pipeline) {
        return res.status(404).json({ message: "Default pipeline not found" });
      }
      res.json(pipeline);
    } catch (error) {
      console.error("Error fetching default CRM pipeline:", error);
      res.status(500).json({ message: "Failed to fetch default pipeline" });
    }
  });

  app.get("/api/crm/pipelines/:id", async (req, res) => {
    try {
      const pipeline = await storage.getCrmPipeline(req.params.id);
      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline not found" });
      }
      res.json(pipeline);
    } catch (error) {
      console.error("Error fetching CRM pipeline:", error);
      res.status(500).json({ message: "Failed to fetch pipeline" });
    }
  });

  app.post("/api/crm/pipelines", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const pipelineData = insertCrmPipelineSchema.parse(req.body);

      // Set the created by user if not provided
      if (!pipelineData.createdByUserId && (req.user as any)?.id) {
        pipelineData.createdByUserId = (req.user as any).id;
      }

      const pipeline = await storage.createCrmPipeline(pipelineData);
      res.status(201).json(pipeline);
    } catch (error) {
      console.error("Error creating CRM pipeline:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create pipeline" });
    }
  });

  app.put("/api/crm/pipelines/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      const pipeline = await storage.updateCrmPipeline(req.params.id, updates);
      res.json(pipeline);
    } catch (error) {
      console.error("Error updating CRM pipeline:", error);
      res.status(500).json({ message: "Failed to update pipeline" });
    }
  });

  app.delete("/api/crm/pipelines/:id", async (req, res) => {
    try {
      await storage.deleteCrmPipeline(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting CRM pipeline:", error);
      res.status(500).json({ message: "Failed to delete pipeline" });
    }
  });

  // Send email endpoint (will integrate with SendGrid)
  app.post("/api/crm/send-email", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { templateId, contactId, customSubject, customBody, variables } = (req.body ??
        {}) as any;

      // Get contact information
      const contact = await storage.getCrmContact(contactId);
      if (!contact || !contact.email) {
        return res.status(400).json({ message: "Contact not found or no email address" });
      }

      let subject = customSubject;
      let body = customBody;

      // If using a template, get template data
      if (templateId) {
        const template = await storage.getCrmEmailTemplate(templateId);
        if (!template) {
          return res.status(404).json({ message: "Email template not found" });
        }

        subject = template.subject;
        body = template.body;

        // Replace variables in template
        if (variables) {
          Object.keys(variables).forEach((key) => {
            const placeholder = `{{${key}}}`;
            subject = subject.replace(new RegExp(placeholder, "g"), variables[key]);
            body = body.replace(new RegExp(placeholder, "g"), variables[key]);
          });
        }

        // Replace common variables
        subject = subject.replace(/{{firstName}}/g, contact.firstName || "");
        subject = subject.replace(/{{lastName}}/g, contact.lastName || "");
        subject = subject.replace(/{{company}}/g, contact.company || "");

        body = body.replace(/{{firstName}}/g, contact.firstName || "");
        body = body.replace(/{{lastName}}/g, contact.lastName || "");
        body = body.replace(/{{company}}/g, contact.company || "");
      }

      // Integrate with SendGrid for email campaigns
      try {
        if (emailService.isConfigured()) {
          await emailService.sendEmail({
            to: contact.email,
            from: (req.user as any)?.email || "campaigns@tradescout.com",
            subject: subject,
            html: body,
            purpose: "crm_email",
          });

          console.log(`Email sent via SendGrid to ${contact.email}`);
        } else {
          console.log(`SendGrid not configured - email logged but not sent to ${contact.email}`);
        }
      } catch (sendError) {
        console.error("SendGrid email error:", sendError);
      }

      // Log the activity
      await storage.createCrmActivity({
        type: "email",
        subject: `Email: ${subject}`,
        description: body,
        contactId: contact.id,
        createdByUserId: (req.user as any)?.id || "",
        toEmail: contact.email,
        fromEmail: (req.user as any)?.email || "noreply@tradescout.com",
      });

      res.json({
        message: "Email logged in CRM (SendGrid integration pending)",
        emailSent: false,
        recipient: contact.email,
        subject,
      });
    } catch (error) {
      console.error("Error sending CRM email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // Internal direct message endpoint
  app.post("/api/crm/internal-message", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { recipients, subject, message, contactId, dealId } = (req.body ?? {}) as any;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ message: "Recipients are required" });
      }

      // Create internal message activity
      await storage.createCrmActivity({
        type: "internal_message",
        subject: `Internal: ${subject}`,
        description: message,
        contactId: contactId || null,
        dealId: dealId || null,
        createdByUserId: (req.user as any)?.id || "",
        isInternal: true,
        internalRecipients: recipients,
      });

      res.json({
        message: "Internal message sent successfully",
        recipients,
        subject,
      });
    } catch (error) {
      console.error("Error sending internal CRM message:", error);
      res.status(500).json({ message: "Failed to send internal message" });
    }
  });
}
