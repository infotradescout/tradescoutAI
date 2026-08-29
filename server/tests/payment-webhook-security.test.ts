import express from "express";
import request from "supertest";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  LEGACY_PAYMENT_WEBHOOK_PATH,
  STRIPE_PAYMENT_WEBHOOK_PATH,
  preserveStripeWebhookRawBody,
  registerPaymentWebhookRoutes,
} from "../paymentWebhookRoutes";

const webhookSecret = "whsec_payment_webhook_security_test";

function buildTestApp() {
  const stripe = new Stripe("sk_test_payment_webhook_security", {
    apiVersion: "2025-08-27.basil",
  });
  const paymentHandler = vi.fn(async () => undefined);
  const checkoutHandler = vi.fn(async () => undefined);
  const communityWebhookHandler = vi.fn(async () => undefined);
  const platformSupportHandler = vi.fn(async () => undefined);

  const app = express();
  app.use(express.json({ verify: preserveStripeWebhookRawBody }));
  registerPaymentWebhookRoutes(app, {
    stripeProvider: () => stripe,
    webhookSecretProvider: () => webhookSecret,
    paymentService: { handleStripeWebhook: paymentHandler },
    communityBuilderPaymentService: {
      handleCheckoutSessionCompleted: checkoutHandler,
      handleStripeWebhook: communityWebhookHandler,
    },
    platformSupportPaymentService: { handleStripeEvent: platformSupportHandler },
  });

  return {
    app,
    stripe,
    paymentHandler,
    checkoutHandler,
    communityWebhookHandler,
    platformSupportHandler,
  };
}

describe("payment webhook security", () => {
  it("rejects forged events on both the retired unsigned endpoint and signed endpoint", async () => {
    const { app, paymentHandler } = buildTestApp();
    const forgedEvent = {
      id: "evt_forged",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_forged",
          metadata: { type: "profile_booking", bookingRequestId: "booking_target" },
        },
      },
    };

    await request(app).post(LEGACY_PAYMENT_WEBHOOK_PATH).send(forgedEvent).expect(410);
    await request(app)
      .post(STRIPE_PAYMENT_WEBHOOK_PATH)
      .set("stripe-signature", "t=1,v1=forged")
      .send(forgedEvent)
      .expect(400);

    expect(paymentHandler).not.toHaveBeenCalled();
  });

  it("verifies the exact raw request bytes before dispatching payment intents", async () => {
    const { app, stripe, paymentHandler } = buildTestApp();
    const payload = JSON.stringify(
      {
        id: "evt_verified",
        object: "event",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_verified",
            object: "payment_intent",
            metadata: { type: "profile_booking", bookingRequestId: "booking_verified" },
          },
        },
      },
      null,
      2
    );
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    await request(app)
      .post(STRIPE_PAYMENT_WEBHOOK_PATH)
      .set("content-type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(200, { received: true });

    expect(paymentHandler).toHaveBeenCalledTimes(1);
    expect(paymentHandler.mock.calls[0]?.[0]).toMatchObject({
      id: "evt_verified",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_verified",
          metadata: { type: "profile_booking", bookingRequestId: "booking_verified" },
        },
      },
    });
  });

  it("dispatches verified payment-intent failures through the platform payment service", async () => {
    const { app, stripe, paymentHandler } = buildTestApp();
    const payload = JSON.stringify({
      id: "evt_verified_failure",
      object: "event",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_verified_failure",
          object: "payment_intent",
          metadata: { type: "profile_booking", bookingRequestId: "booking_failed" },
        },
      },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    await request(app)
      .post(STRIPE_PAYMENT_WEBHOOK_PATH)
      .set("content-type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(200, { received: true });

    expect(paymentHandler).toHaveBeenCalledTimes(1);
    expect(paymentHandler.mock.calls[0]?.[0]).toMatchObject({
      id: "evt_verified_failure",
      type: "payment_intent.payment_failed",
    });
  });

  it("returns a retryable failure when terminal-booking refund handling fails", async () => {
    const { app, stripe, paymentHandler } = buildTestApp();
    paymentHandler.mockRejectedValueOnce(new Error("terminal booking refund failed"));
    const payload = JSON.stringify({
      id: "evt_terminal_booking_capture",
      object: "event",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_terminal_booking_capture",
          object: "payment_intent",
          metadata: {
            type: "profile_booking",
            bookingRequestId: "booking_terminal",
          },
        },
      },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    await request(app)
      .post(STRIPE_PAYMENT_WEBHOOK_PATH)
      .set("content-type", "application/json")
      .set("stripe-signature", signature)
      .send(payload)
      .expect(500, { message: "Webhook handling failed" });

    expect(paymentHandler).toHaveBeenCalledTimes(1);
  });

  it("keeps verified community and platform-support events on their existing handlers", async () => {
    const {
      app,
      stripe,
      paymentHandler,
      checkoutHandler,
      communityWebhookHandler,
      platformSupportHandler,
    } = buildTestApp();

    const events = [
      {
        id: "evt_community_checkout",
        object: "event",
        type: "checkout.session.completed",
        data: { object: { id: "cs_community", metadata: { type: "builder_checkout" } } },
      },
      {
        id: "evt_support_checkout",
        object: "event",
        type: "checkout.session.completed",
        data: { object: { id: "cs_support", metadata: { type: "platform_support" } } },
      },
      {
        id: "evt_transfer",
        object: "event",
        type: "transfer.updated",
        data: { object: { id: "tr_verified", metadata: {} } },
      },
    ];

    for (const event of events) {
      const payload = JSON.stringify(event);
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: webhookSecret,
      });

      await request(app)
        .post(STRIPE_PAYMENT_WEBHOOK_PATH)
        .set("content-type", "application/json")
        .set("stripe-signature", signature)
        .send(payload)
        .expect(200, { received: true });
    }

    expect(checkoutHandler).toHaveBeenCalledTimes(1);
    expect(platformSupportHandler).toHaveBeenCalledTimes(1);
    expect(communityWebhookHandler).toHaveBeenCalledTimes(1);
    expect(paymentHandler).not.toHaveBeenCalled();
  });
});
