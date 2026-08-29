import type { Request, Response } from "express";
import type Stripe from "stripe";

export const LEGACY_PAYMENT_WEBHOOK_PATH = "/api/payments/webhook";
export const STRIPE_PAYMENT_WEBHOOK_PATH = "/api/payments/stripe/webhook";

type StripeWebhookRequest = Request & {
  rawBody?: Buffer;
};

type PaymentWebhookHandler = {
  handleStripeWebhook(event: Stripe.Event): Promise<void>;
};

type CommunityBuilderWebhookHandler = {
  handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void>;
  handleStripeWebhook(event: Stripe.Event): Promise<void>;
};

type PlatformSupportWebhookHandler = {
  handleStripeEvent(event: Stripe.Event): Promise<void>;
};

type StripeWebhookVerifier = Pick<Stripe, "webhooks">;

export type PaymentWebhookDependencies = {
  stripeProvider: () => StripeWebhookVerifier | null;
  webhookSecretProvider: () => string | undefined;
  paymentService: PaymentWebhookHandler;
  communityBuilderPaymentService: CommunityBuilderWebhookHandler;
  platformSupportPaymentService: PlatformSupportWebhookHandler;
};

/**
 * Capture Stripe's exact request bytes while the global JSON parser is reading
 * the body. Stripe signatures are over these bytes, not a re-serialized object.
 */
export function preserveStripeWebhookRawBody(req: Request, _res: Response, body: Buffer): void {
  const requestPath = String(req.originalUrl || req.url || "").split("?", 1)[0];
  if (requestPath === STRIPE_PAYMENT_WEBHOOK_PATH) {
    (req as StripeWebhookRequest).rawBody = Buffer.from(body);
  }
}

export async function dispatchVerifiedStripeEvent(
  event: Stripe.Event,
  dependencies: Omit<PaymentWebhookDependencies, "stripeProvider" | "webhookSecretProvider">
): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
      await dependencies.paymentService.handleStripeWebhook(event);
      return;

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadataType = session.metadata?.type;

      if (metadataType === "community_vault_donation" || metadataType === "platform_support") {
        await dependencies.platformSupportPaymentService.handleStripeEvent(event);
      } else {
        await dependencies.communityBuilderPaymentService.handleCheckoutSessionCompleted(session);
      }
      return;
    }

    case "invoice.paid":
      await dependencies.platformSupportPaymentService.handleStripeEvent(event);
      return;

    case "transfer.created":
    case "transfer.updated":
      await dependencies.communityBuilderPaymentService.handleStripeWebhook(event);
      return;

    default:
      return;
  }
}

export function registerPaymentWebhookRoutes(
  app: {
    post(path: string, handler: (req: Request, res: Response) => Promise<unknown> | unknown): void;
  },
  dependencies: PaymentWebhookDependencies
): void {
  // This historical endpoint accepted unsigned JSON and could mutate payment
  // state. Keep an explicit tombstone so old integrations fail closed.
  app.post(LEGACY_PAYMENT_WEBHOOK_PATH, (_req: Request, res: Response) => {
    return res.status(410).json({
      message: "Unsigned payment webhooks are disabled",
    });
  });

  app.post(STRIPE_PAYMENT_WEBHOOK_PATH, async (req: Request, res: Response) => {
    const stripe = dependencies.stripeProvider();
    if (!stripe) {
      return res.status(400).json({ message: "Stripe not configured" });
    }

    const webhookSecret = String(dependencies.webhookSecretProvider() || "").trim();
    if (!webhookSecret) {
      return res.status(400).json({ message: "STRIPE_WEBHOOK_SECRET not configured" });
    }

    const signature = req.get("stripe-signature");
    if (!signature) {
      return res.status(400).json({ message: "Missing Stripe signature" });
    }

    const rawBody = (req as StripeWebhookRequest).rawBody;
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ message: "Raw Stripe webhook body unavailable" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid signature";
      console.error("[stripe] signature verification failed", message);
      return res.status(400).send(`Webhook Error: ${message}`);
    }

    try {
      await dispatchVerifiedStripeEvent(event, dependencies);
    } catch (error) {
      console.error(`[stripe] webhook handler failed for ${event.type}`, error);
      return res.status(500).json({ message: "Webhook handling failed" });
    }

    return res.json({ received: true });
  });
}
