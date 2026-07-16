import { and, eq, inArray } from "drizzle-orm";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { db } from "../db";
import { emailService } from "../services/emailService";
import {
  JRS_DIRECT_CONTACT_NOTIFICATION_EMAIL,
  JRS_DIRECT_CONTACT_PHONE,
  JRS_PROFILE_SLUG,
  provisionJrsAutoGlassProfile,
} from "../services/jrsAutoGlassProfileProvisioning";
import { createUserOnly } from "./helpers/testAuth";
import {
  businesses,
  notifications,
  profiles,
  users,
  workRequestAssignments,
  workRequestEvents,
  workRequests,
} from "@shared/schema";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const INTEGRATION_TIMEOUT_MS = 90_000;

function requestBody(email: string) {
  return {
    name: "Jane Requester",
    email,
    phone: "(555) 222-3333",
    requestType: "request_service",
    message: "I need a windshield replacement quote for my truck this week.",
  };
}

async function deleteWorkRequestRows(requestIds: string[]) {
  if (requestIds.length === 0) return;
  await Promise.all([
    db
      .delete(workRequestAssignments)
      .where(inArray(workRequestAssignments.workRequestId, requestIds)),
    db.delete(workRequestEvents).where(inArray(workRequestEvents.workRequestId, requestIds)),
  ]);
  await db.delete(workRequests).where(inArray(workRequests.id, requestIds));
}

async function loadOwnerNotifications(ownerUserId: string) {
  return db
    .select({
      id: notifications.id,
      title: notifications.title,
      message: notifications.message,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, ownerUserId),
        eq(notifications.type, "new_project_request" as any)
      )
    );
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describeWithDb("JR's Auto Glass Express Direct Connect integration", () => {
  let app: Awaited<ReturnType<typeof createApp>>["app"];

  beforeAll(async () => {
    ({ app } = await createApp());
  });

  it("reveals Call and delivers Send from the exact managed-profile contact source", async () => {
    const requestIds: string[] = [];
    let requesterEmail = "";
    let ownerUserId = "";
    let beforeNotificationIds = new Set<string>();
    const previousBetaNotifications = process.env.DIRECT_CONNECT_BETA_ADMIN_NOTIFICATIONS;
    process.env.DIRECT_CONNECT_BETA_ADMIN_NOTIFICATIONS = "false";

    try {
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
      ownerUserId = String(profile?.ownerUserId || "");
      beforeNotificationIds = new Set(
        (await loadOwnerNotifications(ownerUserId)).map(({ id }) => String(id))
      );

      const reveal = await request(app)
        .post("/api/tradepartner-profiles/" + JRS_PROFILE_SLUG + "/express-contact/reveal")
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
        requesterEmail = "jrs-requester+" + crypto.randomUUID() + "@tradescout.test";
        const send = await request(app)
          .post("/api/tradepartner-profiles/" + JRS_PROFILE_SLUG + "/express-request")
          .send(requestBody(requesterEmail));

        expect(send.status).toBe(201);
        expect(send.body?.status).toBe("routed");
        expect(send.body?.businessEmailStatus).toBe("sent");
        expect(send.body?.onboardingEmailStatus).toBe("sent");
        expect(send.body?.accountCreated).toBe(true);

        const requestId = String(send.body?.requestId || "");
        expect(requestId.length).toBeGreaterThan(0);
        requestIds.push(requestId);

        const [workRequest] = await db
          .select()
          .from(workRequests)
          .where(
            and(eq(workRequests.id, requestId), eq(workRequests.sourceRefId, String(profile?.profileId || "")))
          )
          .limit(1);
        expect(workRequest).toBeTruthy();
        expect(String(workRequest?.source || "")).toBe("direct_connect");
        expect(String(workRequest?.status || "")).toBe("routed");

        const assignments = await db
          .select()
          .from(workRequestAssignments)
          .where(eq(workRequestAssignments.workRequestId, requestId));
        expect(assignments).toHaveLength(1);
        expect(String(assignments[0]?.responderUserId || "")).toBe(ownerUserId);

        const freshOwnerNotifications = (await loadOwnerNotifications(ownerUserId)).filter(
          ({ id }) => !beforeNotificationIds.has(String(id))
        );
        expect(freshOwnerNotifications).toHaveLength(1);
        expect(freshOwnerNotifications[0]).toEqual(
          expect.objectContaining({
            title: "New request for JR's Auto Glass",
            message: "Jane Requester sent a request from the public profile.",
          })
        );

        const firstSendEmails = sendEmailSpy.mock.calls.map(([params]) => params);
        expect(firstSendEmails).toEqual(
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
          .where(eq(users.id, ownerUserId))
          .limit(1);
        expect(owner).toBeTruthy();
        expect(String(owner?.verificationStatus || "")).toBe("pending");
        expect(Boolean(owner?.verifiedBadge)).toBe(false);
      } finally {
        sendEmailSpy.mockRestore();
        isConfiguredSpy.mockRestore();
      }
    } finally {
      if (ownerUserId) {
        const createdNotificationIds = (await loadOwnerNotifications(ownerUserId))
          .filter(({ id }) => !beforeNotificationIds.has(String(id)))
          .map(({ id }) => String(id));
        if (createdNotificationIds.length > 0) {
          await db.delete(notifications).where(inArray(notifications.id, createdNotificationIds));
        }
      }
      await deleteWorkRequestRows(requestIds.filter(Boolean));
      restoreEnv("DIRECT_CONNECT_BETA_ADMIN_NOTIFICATIONS", previousBetaNotifications);
    }
  }, INTEGRATION_TIMEOUT_MS);

  it("does not publish verified owner account contact as business contact", async () => {
    const requestIds: string[] = [];
    let owner: any = null;
    let businessId = "";
    let profileId = "";
    let requesterEmail = "";
    const previousBetaNotifications = process.env.DIRECT_CONNECT_BETA_ADMIN_NOTIFICATIONS;
    process.env.DIRECT_CONNECT_BETA_ADMIN_NOTIFICATIONS = "false";

    try {
      owner = await createUserOnly({
        role: "contractor",
        phone: "(555) 444-9090",
      });
      await db
        .update(users)
        .set({ verifiedBadge: true, verificationStatus: "approved" } as any)
        .where(eq(users.id, String(owner.id)));

      const slug = "contact-privacy-" + crypto.randomUUID();
      const [business] = await db
        .insert(businesses)
        .values({
          name: "Contact Privacy Fixture",
          slug,
          type: "other",
          ownerUserId: owner.id,
          roleContext: "contractor",
          profileData: { category: "Testing" },
          claimStatus: "claimed",
          publicDiscoveryEnabled: true,
          sources: [],
          status: "active",
        } as any)
        .returning();
      businessId = String(business.id);

      const [profile] = await db
        .insert(profiles)
        .values({
          ownerUserId: owner.id,
          businessId: business.id,
          roleContext: "contractor",
          slug,
          displayName: "Contact Privacy Fixture",
          headline: "Private account contact must stay private.",
          contentBlocks: [],
          ctaConfig: {},
          seoMeta: {},
          status: "published",
        } as any)
        .returning();
      profileId = String(profile.id);

      const reveal = await request(app)
        .post("/api/tradepartner-profiles/" + slug + "/express-contact/reveal")
        .send({
          authorityGate: "profile_direct_connect",
          decision: "call",
        });
      expect(reveal.status).toBe(404);
      expect(reveal.body?.message).toBe("Calling is unavailable right now.");

      const isConfiguredSpy = vi.spyOn(emailService, "isConfigured").mockReturnValue(true);
      const sendEmailSpy = vi
        .spyOn(emailService, "sendEmail")
        .mockResolvedValue({ skipped: false, messageId: "test-message" });

      try {
        requesterEmail = "privacy-requester+" + crypto.randomUUID() + "@tradescout.test";
        const send = await request(app)
          .post("/api/tradepartner-profiles/" + slug + "/express-request")
          .send(requestBody(requesterEmail));

        expect(send.status).toBe(201);
        expect(send.body?.businessEmailStatus).toBe("skipped");
        expect(send.body?.onboardingEmailStatus).toBe("sent");
        requestIds.push(String(send.body?.requestId || ""));

        const sentEmails = sendEmailSpy.mock.calls.map(([params]) => params);
        expect(
          sentEmails.some((params) => {
            const recipients = Array.isArray(params.to) ? params.to : [params.to];
            return recipients.includes(String(owner.email));
          })
        ).toBe(false);
      } finally {
        sendEmailSpy.mockRestore();
        isConfiguredSpy.mockRestore();
      }
    } finally {
      await deleteWorkRequestRows(requestIds.filter(Boolean));
      if (profileId) await db.delete(profiles).where(eq(profiles.id, profileId));
      if (businessId) await db.delete(businesses).where(eq(businesses.id, businessId));
      if (owner?.id) {
        await db.delete(notifications).where(eq(notifications.userId, String(owner.id)));
      }
      // UUID/no-password test users are intentionally retained: deleting from the
      // high-fanout users table can block the shared Neon test lane.
      restoreEnv("DIRECT_CONNECT_BETA_ADMIN_NOTIFICATIONS", previousBetaNotifications);
    }
  }, INTEGRATION_TIMEOUT_MS);
});
