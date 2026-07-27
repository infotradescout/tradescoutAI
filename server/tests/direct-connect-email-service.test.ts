import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isEmailPurposeAllowedForMode,
  resolveEmailProviderConfiguration,
} from "../services/emailService";
import {
  buildNotificationDeliveryLogValues,
  escapeNotificationEmailHtml,
  renderNotificationEmailHtml,
  renderNotificationEmailText,
  resolveCanonicalTradeScoutBaseUrl,
  resolveNotificationDeliveryFailure,
  resolveNotificationEmailActionUrl,
  resolveNotificationEmailPurpose,
  resolveRequestedEmailSuppression,
} from "../notification-service";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Direct Connect restricted email mode", () => {
  it("allows only the explicit operational purposes required by Direct Connect", () => {
    expect(
      isEmailPurposeAllowedForMode("account_creation_only", "direct_connect_account_setup")
    ).toBe(true);
    expect(isEmailPurposeAllowedForMode("account_creation_only", "direct_connect_request")).toBe(
      true
    );
    expect(
      isEmailPurposeAllowedForMode("account_creation_only", "direct_connect_admin_oversight")
    ).toBe(true);
    expect(
      isEmailPurposeAllowedForMode("account_creation_only", "tradepartner_request_notification")
    ).toBe(true);
    expect(isEmailPurposeAllowedForMode("account_creation_only", "notification")).toBe(false);
    expect(isEmailPurposeAllowedForMode("all", "notification")).toBe(true);
  });

  it("maps only an explicit metadata emailPurpose", () => {
    expect(
      resolveNotificationEmailPurpose({
        emailPurpose: "direct_connect_admin_oversight",
      })
    ).toBe("direct_connect_admin_oversight");
    expect(
      resolveNotificationEmailPurpose({
        emailPurpose: "direct_connect_request",
      })
    ).toBe("direct_connect_request");
    expect(
      resolveNotificationEmailPurpose({
        emailPurpose: "tradepartner_request_notification",
      })
    ).toBe("tradepartner_request_notification");
    expect(
      resolveNotificationEmailPurpose({
        type: "new_project_request",
      })
    ).toBe("notification");
    expect(
      resolveNotificationEmailPurpose({
        emailPurpose: "untrusted_override",
      })
    ).toBe("notification");
  });

  it("binds each provider to its own sender configuration", () => {
    expect(
      resolveEmailProviderConfiguration({
        EMAIL_PROVIDER: "brevo",
        BREVO_API_KEY: "brevo-key",
        BREVO_FROM_EMAIL: "brevo@thetradescout.com",
        SENDGRID_FROM_EMAIL: "stale-sendgrid@other.example",
      })
    ).toMatchObject({
      provider: "brevo",
      configured: true,
      defaultFrom: "brevo@thetradescout.com",
      configurationError: null,
    });

    expect(
      resolveEmailProviderConfiguration({
        EMAIL_PROVIDER: "sendgrid",
        SENDGRID_API_KEY: "sendgrid-key",
        SENDGRID_FROM_EMAIL: "sendgrid@thetradescout.com",
        BREVO_FROM_EMAIL: "stale-brevo@other.example",
      })
    ).toMatchObject({
      provider: "sendgrid",
      configured: true,
      defaultFrom: "sendgrid@thetradescout.com",
      configurationError: null,
    });
  });

  it("fails configuration diagnostics when the selected provider has no sender", () => {
    expect(
      resolveEmailProviderConfiguration({
        EMAIL_PROVIDER: "brevo",
        BREVO_API_KEY: "brevo-key",
        SENDGRID_FROM_EMAIL: "sendgrid-only@thetradescout.com",
      })
    ).toEqual({
      provider: "brevo",
      configured: false,
      defaultFrom: "",
      configurationError: "BREVO_FROM_EMAIL_MISSING",
    });
  });
});

describe("notification email rendering", () => {
  it("escapes user-controlled HTML and emits an absolute canonical action URL", () => {
    const html = renderNotificationEmailHtml(
      {
        title: '<script>alert("title")</script>',
        message: '<img src=x onerror="alert(1)"> & hello',
        actionText: "<Open request>",
        actionUrl: "/direct-connect/inbox?requestId=request-1&view=all",
      },
      {
        firstName: "Sam <Admin>",
      },
      "https://www.thetradescout.com"
    );

    expect(html).toContain("&lt;script&gt;alert(&quot;title&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; hello");
    expect(html).toContain("Sam &lt;Admin&gt;");
    expect(html).toContain("&lt;Open request&gt;");
    expect(html).toContain(
      'href="https://www.thetradescout.com/direct-connect/inbox?requestId=request-1&amp;view=all"'
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });

  it("rejects external actions and keeps plain-text links canonical", () => {
    expect(
      resolveNotificationEmailActionUrl(
        "/admin/direct-connect-requests?requestId=request-2",
        "https://www.thetradescout.com"
      )
    ).toBe("https://www.thetradescout.com/admin/direct-connect-requests?requestId=request-2");
    expect(
      resolveNotificationEmailActionUrl(
        "https://attacker.example/steal",
        "https://www.thetradescout.com"
      )
    ).toBeNull();
    expect(resolveNotificationEmailActionUrl("javascript:alert(1)")).toBeNull();
    expect(resolveCanonicalTradeScoutBaseUrl("https://attacker.example")).toBe(
      "https://www.thetradescout.com"
    );

    expect(
      renderNotificationEmailText({
        message: "A request is ready.",
        actionText: "Review request",
        actionUrl: "/admin/direct-connect-requests?requestId=request-2",
      })
    ).toContain(
      "Review request: https://www.thetradescout.com/admin/direct-connect-requests?requestId=request-2"
    );
  });

  it("escapes all five HTML-sensitive characters", () => {
    expect(escapeNotificationEmailHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("notification email delivery evidence", () => {
  const suppressionInput = {
    requestedDeliveryMethods: ["in_app", "email"],
    typeDeliveryMethods: null,
    globalNotificationsEnabled: true,
    typeNotificationsEnabled: true,
    emailNotificationsEnabled: true,
    recipientEmail: "recipient@example.com",
    notificationType: "direct_connect_beta_request",
  } as const;

  it("records precise suppression reasons for each preference and recipient gate", () => {
    expect(
      resolveRequestedEmailSuppression({
        ...suppressionInput,
        globalNotificationsEnabled: false,
      })?.errorCode
    ).toBe("GLOBAL_NOTIFICATIONS_DISABLED");
    expect(
      resolveRequestedEmailSuppression({
        ...suppressionInput,
        typeNotificationsEnabled: false,
      })?.errorCode
    ).toBe("NOTIFICATION_TYPE_DISABLED");
    expect(
      resolveRequestedEmailSuppression({
        ...suppressionInput,
        typeDeliveryMethods: ["in_app"],
      })?.errorCode
    ).toBe("NOTIFICATION_TYPE_EMAIL_DISABLED");
    expect(
      resolveRequestedEmailSuppression({
        ...suppressionInput,
        emailNotificationsEnabled: false,
      })?.errorCode
    ).toBe("EMAIL_NOTIFICATIONS_DISABLED");
    expect(
      resolveRequestedEmailSuppression({
        ...suppressionInput,
        recipientEmail: null,
      })?.errorCode
    ).toBe("RECIPIENT_EMAIL_MISSING");
    expect(
      resolveRequestedEmailSuppression({
        ...suppressionInput,
        requestedDeliveryMethods: ["in_app"],
      })
    ).toBeNull();
  });

  it("keeps failure details out of contactInfo", () => {
    const failure = resolveNotificationDeliveryFailure(
      Object.assign(new Error("provider timed out"), { code: "ETIMEDOUT" }),
      "email"
    );
    const row = buildNotificationDeliveryLogValues({
      notificationId: "notification-1",
      userId: "user-1",
      deliveryMethod: "email",
      status: failure.status,
      contactInfo: "recipient@example.com",
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
    });

    expect(row.contactInfo).toBe("recipient@example.com");
    expect(row.errorCode).toBe("EMAIL_ETIMEDOUT");
    expect(row.errorMessage).toBe("provider timed out");
    expect(row.failedAt).toBeInstanceOf(Date);
  });

  it("distinguishes provider acceptance from confirmed delivery", () => {
    const now = new Date("2026-07-26T12:00:00.000Z");
    const accepted = buildNotificationDeliveryLogValues(
      {
        notificationId: "notification-2",
        userId: "user-2",
        deliveryMethod: "email",
        status: "sent",
        externalId: "provider-message-1",
        externalResponse: {
          provider: "sendgrid",
          providerStatus: "accepted",
        },
      },
      now
    );
    const delivered = buildNotificationDeliveryLogValues(
      {
        notificationId: "notification-2",
        userId: "user-2",
        deliveryMethod: "email",
        status: "delivered",
      },
      now
    );

    expect(accepted.status).toBe("sent");
    expect(accepted.sentAt).toBe(now);
    expect(accepted.deliveredAt).toBeUndefined();
    expect(accepted.externalResponse).toEqual({
      provider: "sendgrid",
      providerStatus: "accepted",
    });
    expect(delivered.deliveredAt).toBe(now);
  });

  it("preserves explicit suppressed delivery failures", () => {
    expect(
      resolveNotificationDeliveryFailure(
        {
          deliveryStatus: "suppressed",
          deliveryErrorCode: "EMAIL_MODE_SUPPRESSED",
          message: "Email suppressed by restricted mode.",
        },
        "email"
      )
    ).toEqual({
      status: "suppressed",
      errorCode: "EMAIL_MODE_SUPPRESSED",
      errorMessage: "Email suppressed by restricted mode.",
    });
  });
});

describe("TradePartner Express email delivery contract", () => {
  const route = read("server/routes/tradepartner-express.ts");
  const oversight = read("server/services/directConnectBetaOversight.ts");
  const notifications = read("server/notification-service.ts");

  it("uses explicit purposes for owner, requester, and admin notification email", () => {
    expect(route).toContain('emailPurpose: "tradepartner_request_notification"');
    expect(route).toContain('? "direct_connect_account_setup"');
    expect(route).toContain(': "direct_connect_request"');
    expect(notifications).toContain('purpose === "tradepartner_request_notification"');
    expect(oversight).toContain('emailPurpose: "direct_connect_admin_oversight"');
    expect(oversight).toContain("workRequestId: requestId");
  });

  it("binds the durable provider email to the shared business inbox", () => {
    expect(route).toContain("normalizeEmail(target.notificationEmail)");
    expect(route).toContain("normalizeEmail(target.ownerEmail)");
    expect(route).toContain("recipientEmail: providerRecipientEmail");
    expect(route).toContain("recipientTarget: target.notificationEmail");
    expect(route).toContain('"shared_business_inbox"');
    expect(notifications).toContain('kind: "tradepartner_profile_request"');
    expect(notifications).toContain("recipientEmail,");
    expect(notifications).toContain("resolveNotificationEmailRecipient(notification, user)");
    expect(route).not.toContain("emailService.sendEmail");
  });

  it("keeps provider failure fail-soft and does not copy request contact data into email", () => {
    const dispatchStart = route.indexOf("const dispatchDurableEmail");
    const dispatchEnd = route.indexOf("const requestWorkspaceParams", dispatchStart);
    const dispatchBlock = route.slice(dispatchStart, dispatchEnd);
    const templateStart = notifications.indexOf(
      'if (template?.kind === "tradepartner_profile_request")'
    );
    const templateBlock = notifications.slice(templateStart, templateStart + 4_000);

    expect(dispatchBlock).toContain("[tradepartner-express] durable email remains queued");
    expect(dispatchBlock).not.toContain("error,");
    expect(templateBlock).toContain("requesterDisplayName");
    expect(templateBlock).toContain("requestSummary");
    expect(templateBlock).not.toContain("body.email");
    expect(templateBlock).not.toContain("body.phone");
    expect(templateBlock).not.toContain("body.message");
    expect(templateBlock).not.toContain("sanitizedMessage");
  });

  it("writes structured suppression and failure evidence", () => {
    expect(notifications).toContain('status: "suppressed"');
    expect(notifications).toContain("errorCode: emailSuppression.errorCode");
    expect(notifications).toContain("errorMessage: emailSuppression.errorMessage");
    expect(notifications).toContain("errorCode: failure.errorCode");
    expect(notifications).toContain("errorMessage: failure.errorMessage");
    expect(notifications).toContain('providerStatus: "accepted"');
    expect(notifications).not.toContain(
      'this.logDelivery(notificationId, user.id, method as any, "failed", String(error))'
    );
  });

  it("keeps supplemental push/SMS evidence fail-soft after durable email intent creation", () => {
    const logDeliveryStart = notifications.indexOf(
      "private async logDelivery(input: NotificationDeliveryLogInput)"
    );
    const logDeliveryBlock = notifications.slice(logDeliveryStart, logDeliveryStart + 1_200);

    expect(logDeliveryStart).toBeGreaterThan(-1);
    expect(notifications).toContain("async enqueueNotification(tx: any");
    expect(notifications).toContain("this.enqueueNotification(tx, notification)");
    expect(notifications).toContain("await tx.insert(notificationDeliveryLog).values");
    expect(logDeliveryBlock).toContain("try {");
    expect(logDeliveryBlock).toContain(
      "await db.insert(notificationDeliveryLog).values(buildNotificationDeliveryLogValues(input))"
    );
    expect(logDeliveryBlock).toContain("[notifications] Failed to persist delivery evidence");
    expect(notifications).toContain("[notifications] Failed to mark notification sent");
  });
});
