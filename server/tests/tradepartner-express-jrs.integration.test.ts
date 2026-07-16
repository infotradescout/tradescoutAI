import { and, eq } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { db } from "../db";
import { emailService } from "../services/emailService";
import {
  JRS_DIRECT_CONTACT_NOTIFICATION_EMAIL,
  JRS_DIRECT_CONTACT_PHONE,
  JRS_PROFILE_SLUG,
  provisionJrsAutoGlassProfile,
} from "../services/jrsAutoGlassProfileProvisioning";
import {
  businesses,
  notifications,
  profiles,
  users,
  workRequestAssignments,
  workRequests,
} from "@shared/schema";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeWithDb("JR's Auto Glass Express Direct Connect integration", () => {
  it("reveals Call and delivers Send from the provisioned managed-profile contact source", async () => {
    const { app } = await createApp();
    await provisionJrsAutoGlassProfile({ force: true });

    const [profile] = await db
      .select({
        profileId: profiles.id,
        ownerUserId: profiles.ownerUserId,
        businessId: profiles.businessId,
        profileData: businesses.profileData,
      })
      .from(profiles)
      .innerJoin(businesses, eq(profiles.businessId, businesses.id))
      .where(eq(profiles.slug, JRS_PROFILE_SLUG))
      .limit(1);

    expect(profile).toBeTruthy();
    expect((profile?.profileData as any)?.phone).toBeUndefined();
    expect((profile?.profileData as any)?.notificationEmail).toBeUndefined();

    const reveal = await request(app)
      .post(`/api/tradepartner-profiles/${JRS_PROFILE_SLUG}/express-contact/reveal`)
      .send({
        authorityGate: "profile_direct_connect",
        decision: "call",
      });

    expect(reveal.status).toBe(200);
    expect(reveal.body?.phone).toBe(JRS_DIRECT_CONTACT_PHONE);
    expect(reveal.body?.tel).toBe("tel:+19855076192");

    const isConfiguredSpy = vi.spyOn(emailService, "isConfigured").mockReturnValue(true);
    const sendEmailSpy = vi
      .spyOn(emailService, "sendEmail")
      .mockResolvedValue({ skipped: false, messageId: "test-message" });

    try {
      const requesterEmail = `jrs-requester+${crypto.randomUUID()}@tradescout.test`;
      const send = await request(app)
        .post(`/api/tradepartner-profiles/${JRS_PROFILE_SLUG}/express-request`)
        .send({
          name: "Jane Requester",
          email: requesterEmail,
          phone: "(555) 222-3333",
          requestType: "request_service",
          message: "I need a windshield replacement quote for my truck this week.",
        });

      expect(send.status).toBe(201);
      expect(send.body?.status).toBe("routed");
      expect(send.body?.businessEmailStatus).toBe("sent");
      expect(send.body?.onboardingEmailStatus).toBe("sent");

      const requestId = String(send.body?.requestId || "");
      expect(requestId.length).toBeGreaterThan(0);

      const [workRequest] = await db
        .select()
        .from(workRequests)
        .where(and(eq(workRequests.id, requestId), eq(workRequests.sourceRefId, profile.profileId)))
        .limit(1);
      expect(workRequest).toBeTruthy();
      expect(String(workRequest?.source || "")).toBe("direct_connect");
      expect(String(workRequest?.status || "")).toBe("routed");

      const assignments = await db
        .select()
        .from(workRequestAssignments)
        .where(eq(workRequestAssignments.workRequestId, requestId));
      expect(assignments).toHaveLength(1);
      expect(String(assignments[0]?.responderUserId || "")).toBe(String(profile.ownerUserId));

      const ownerNotifications = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, String(profile.ownerUserId)),
            eq(notifications.type, "new_project_request" as any)
          )
        );
      expect(ownerNotifications.length).toBeGreaterThan(0);

      const sentEmails = sendEmailSpy.mock.calls.map(([params]) => params);
      expect(sentEmails).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            to: JRS_DIRECT_CONTACT_NOTIFICATION_EMAIL,
            purpose: "tradepartner_request_notification",
          }),
          expect.objectContaining({
            to: requesterEmail,
            purpose: "account_creation",
          }),
        ])
      );

      const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.id, String(profile.ownerUserId)))
        .limit(1);
      expect(owner).toBeTruthy();
      expect(String(owner?.verificationStatus || "")).toBe("pending");
      expect(Boolean(owner?.verifiedBadge)).toBe(false);
    } finally {
      sendEmailSpy.mockRestore();
      isConfiguredSpy.mockRestore();
    }
  }, 45_000);
});
