import { storage } from "./storage";
import type { SavedAd, User, Advertisement } from "@shared/schema";

export class NotificationService {
  private static instance: NotificationService;
  private reminderInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Start the reminder service
  public startReminderService(): void {
    if (this.reminderInterval) {
      return; // Already running
    }

    console.log("Starting saved ad reminder service...");
    
    // Run every hour
    this.reminderInterval = setInterval(async () => {
      await this.processReminders();
    }, 60 * 60 * 1000); // 1 hour

    // Run immediately on startup
    this.processReminders();
  }

  // Stop the reminder service
  public stopReminderService(): void {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
      console.log("Stopped saved ad reminder service");
    }
  }

  // Process reminders for saved ads
  private async processReminders(): Promise<void> {
    try {
      console.log("Processing saved ad reminders...");
      
      const savedAdsForReminders = await storage.getSavedAdsForReminders();
      
      if (savedAdsForReminders.length === 0) {
        console.log("No saved ads requiring reminders");
        return;
      }

      console.log(`Found ${savedAdsForReminders.length} saved ads requiring reminders`);

      for (const savedAdData of savedAdsForReminders) {
        await this.sendReminder(savedAdData);
      }

      console.log("Finished processing saved ad reminders");
    } catch (error) {
      console.error("Error processing reminders:", error);
    }
  }

  // Send a reminder for a specific saved ad
  private async sendReminder(savedAdData: SavedAd & { user: User; ad: Advertisement }): Promise<void> {
    try {
      const { user, ad } = savedAdData;
      const reminderCount = (savedAdData.reminderCount || 0) + 1;

      // Create different messages based on reminder count
      const { title, content } = this.generateReminderMessage(ad, reminderCount);

      // Create in-app notification
      await storage.createNotification({
        userId: user.id,
        type: 'saved_ad_reminder',
        title,
        content,
        relatedId: savedAdData.id,
      });

      // Update the saved ad reminder status
      await storage.updateSavedAdReminderStatus(savedAdData.id, reminderCount);

      console.log(`Sent reminder ${reminderCount} to user ${user.email} for ad "${ad.title}"`);

      // If we have SendGrid configured, also send email
      if (process.env.SENDGRID_API_KEY && user.email) {
        await this.sendEmailReminder(user, ad, title, content);
      }

    } catch (error) {
      console.error(`Error sending reminder for saved ad ${savedAdData.id}:`, error);
    }
  }

  // Generate reminder message content
  private generateReminderMessage(ad: Advertisement, reminderCount: number): { title: string; content: string } {
    const messages = [
      {
        title: "Don't Miss Out on This Deal!",
        content: `You saved "${ad.title}" a few days ago. This offer might not last much longer - check it out now!`
      },
      {
        title: "Limited Time Offer Reminder",
        content: `The deal you saved "${ad.title}" is still available. Take advantage of this opportunity before it expires!`
      },
      {
        title: "Last Chance Reminder",
        content: `Final reminder about "${ad.title}". This could be your last chance to benefit from this offer!`
      }
    ];

    const messageIndex = Math.min(reminderCount - 1, messages.length - 1);
    return messages[messageIndex];
  }

  // Send email reminder (if SendGrid is configured)
  private async sendEmailReminder(user: User, ad: Advertisement, title: string, content: string): Promise<void> {
    try {
      // Only attempt if SendGrid is configured
      if (!process.env.SENDGRID_API_KEY) {
        return;
      }

      const sgMail = await import('@sendgrid/mail');
      const mailService = sgMail.default;
      mailService.setApiKey(process.env.SENDGRID_API_KEY);

      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 30px; text-align: center;">
            <h1 style="color: #f97316; margin: 0; font-size: 28px;">Trade Scout</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Contractor Marketplace</p>
          </div>
          
          <div style="padding: 30px; background: #f8fafc;">
            <h2 style="color: #1e40af; margin-bottom: 20px;">${title}</h2>
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              Hi ${user.firstName || 'there'},
            </p>
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
              ${content}
            </p>
            
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
              <h3 style="color: #1e40af; margin: 0 0 10px 0; font-size: 18px;">${ad.title}</h3>
              <p style="color: #64748b; margin: 0 0 15px 0; line-height: 1.5;">${ad.content}</p>
              ${ad.isAffiliate ? '<span style="background: #dbeafe; color: #1d4ed8; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Sponsored</span>' : ''}
            </div>
            
            ${ad.linkUrl ? `
              <div style="text-align: center; margin-bottom: 25px;">
                <a href="${ad.linkUrl}" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  View Offer
                </a>
              </div>
            ` : ''}
            
            <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">
              You're receiving this because you saved this ad on Trade Scout. 
              <a href="${process.env.FRONTEND_URL || 'https://tradescout.replit.app'}/saved-ads" style="color: #f97316;">Manage your saved ads</a>
            </p>
          </div>
        </div>
      `;

      await mailService.send({
        to: user.email!,
        from: process.env.FROM_EMAIL || 'noreply@tradescout.app',
        subject: `Trade Scout: ${title}`,
        html: emailContent,
      });

      console.log(`Email reminder sent to ${user.email}`);
    } catch (error) {
      console.error(`Error sending email reminder to ${user.email}:`, error);
      // Don't throw - we don't want email failures to stop in-app notifications
    }
  }

  // Manual trigger for testing
  public async triggerReminders(): Promise<void> {
    await this.processReminders();
  }
}

export const notificationService = NotificationService.getInstance();