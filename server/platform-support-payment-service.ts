import Stripe from "stripe";
import { storage } from "./storage";
import { grantCommunityBuilderBadge } from "./communityBuilderBadgeService";
import { getStripeClient, type StripeClientProvider } from "./services/stripeClient";

function toDollars(cents: number | null | undefined): number | null {
  if (cents == null) return null;
  return Number.isFinite(cents) ? cents / 100 : null;
}

function safeNumber(value: any): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export class PlatformSupportPaymentService {
  constructor(private readonly stripeProvider: StripeClientProvider = getStripeClient) {}

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        return;
      case "invoice.paid":
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        return;
      default:
        return;
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const metadata = session.metadata ?? {};
    const type = metadata.type;

    if (type === "community_vault_donation") {
      await this.handleCommunityVaultDonation(session);
      return;
    }

    if (type === "platform_support") {
      // For subscriptions, record on invoice.paid to ensure we only record captured money.
      if (session.mode === "subscription") return;
      await this.handlePlatformSupportOneTime(session);
      return;
    }
  }

  private async handleCommunityVaultDonation(session: Stripe.Checkout.Session): Promise<void> {
    const metadata = session.metadata ?? {};
    const profileId = metadata.profileId;

    if (!profileId) {
      console.warn("[stripe][community_vault_donation] missing profileId; skipping");
      return;
    }

    const amount = toDollars(session.amount_total);
    const amountValue = amount ?? safeNumber(metadata.amount);

    if (!amountValue) {
      console.warn("[stripe][community_vault_donation] missing amount; skipping");
      return;
    }

    const externalKey = `stripe:checkout_session:${session.id}:community_vault_donation`;

    try {
      const result = await storage.recordCommunityVaultLedgerEntry({
        profileId,
        amount: amountValue,
        sourceType: "direct_donation",
        sourceId: session.id,
        externalKey,
        memo: "Stripe community vault donation",
        causeId: metadata.causeId || undefined,
      });

      // Award Community Builder badge to the owner of this profile when money flows into their vault.
      const ownerUserId = await storage.getProfileOwnerUserId(profileId);
      if (ownerUserId) {
        await grantCommunityBuilderBadge(ownerUserId, "community_vault_donation");
      }
    } catch (error: any) {
      // Idempotency: unique externalKey
      if (
        String(error?.message || "")
          .toLowerCase()
          .includes("duplicate") ||
        String(error?.code) === "23505"
      ) {
        return;
      }
      throw error;
    }
  }

  private async handlePlatformSupportOneTime(session: Stripe.Checkout.Session): Promise<void> {
    const metadata = session.metadata ?? {};
    const originatingProfileId = metadata.originatingProfileId || undefined;

    const amount = toDollars(session.amount_total);
    const total = amount ?? safeNumber(metadata.amount);

    if (!total) {
      console.warn("[stripe][platform_support] missing amount; skipping");
      return;
    }

    const currency = (session.currency || "usd").toUpperCase();

    const hasCommunity = Boolean(originatingProfileId);
    const communityShare = hasCommunity ? Number((total * 0.5).toFixed(2)) : 0;
    const platformShare = hasCommunity ? Number((total - communityShare).toFixed(2)) : total;

    // Always record platform entry
    await this.insertPlatformSupportLedgerEntrySafe({
      externalKey: `stripe:checkout_session:${session.id}:platform`,
      allocation: "platform",
      originatingProfileId: originatingProfileId ?? null,
      mode: "one_time",
      amount: platformShare.toFixed(2),
      currency,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      memo: hasCommunity ? "Platform Support (split: platform share)" : "Platform Support",
      createdAt: new Date(),
    });

    if (hasCommunity && originatingProfileId) {
      await this.insertPlatformSupportLedgerEntrySafe({
        externalKey: `stripe:checkout_session:${session.id}:community`,
        allocation: "community",
        originatingProfileId,
        mode: "one_time",
        amount: communityShare.toFixed(2),
        currency,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        memo: "Platform Support (split: community share)",
        createdAt: new Date(),
      });

      // Credit the sender's county vault (50% to local county, 50% to TradeScout).
      const ownerUserId = await storage.getProfileOwnerUserId(originatingProfileId);
      if (ownerUserId) {
        try {
          const [user] = await storage.getUsersByIds([ownerUserId]);
          if (user?.county && user.state) {
            const countySnapshot = await storage.getCountyVaultSnapshot({
              countyName: user.county,
              stateCode: user.state,
            });

            if (countySnapshot?.county && countySnapshot.county.id) {
              await storage.recordVaultLedgerEntry({
                countyId: countySnapshot.county.id,
                amount: communityShare,
                sourceType: "platform_support_share",
                sourceId: session.id,
                memo: "Platform Support split credit (county vault)",
              });
            }
          }
        } catch (err) {
          console.error(
            "[platform_support] Error crediting county vault for one-time support:",
            err
          );
        }

        // The originating profile owner effectively drove a paid platform support action.
        await grantCommunityBuilderBadge(ownerUserId, "builder_fund");
      }
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const stripe = this.stripeProvider();
    if (!stripe) return;

    // Stripe typings vary across versions; use a narrow `any` view for optional fields.
    const invoiceAny = invoice as any;

    const subscriptionId =
      typeof invoiceAny.subscription === "string" ? invoiceAny.subscription : null;
    if (!subscriptionId) return;

    let subscription: Stripe.Subscription | null = null;
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (e) {
      console.warn("[stripe][invoice.paid] failed to retrieve subscription", subscriptionId);
      return;
    }

    const metadata = (subscription?.metadata ?? {}) as Record<string, string>;
    if (metadata.type !== "platform_support") return;

    const originatingProfileId = metadata.originatingProfileId || undefined;

    const total = toDollars(invoice.amount_paid) ?? 0;
    if (!total) return;

    const currency = (invoice.currency || "usd").toUpperCase();

    const hasCommunity = Boolean(originatingProfileId);
    const communityShare = hasCommunity ? Number((total * 0.5).toFixed(2)) : 0;
    const platformShare = hasCommunity ? Number((total - communityShare).toFixed(2)) : total;

    // Two rows per split payment
    await this.insertPlatformSupportLedgerEntrySafe({
      externalKey: `stripe:invoice:${invoice.id}:platform`,
      allocation: "platform",
      originatingProfileId: originatingProfileId ?? null,
      mode: "subscription",
      amount: platformShare.toFixed(2),
      currency,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      stripeChargeId: typeof invoiceAny.charge === "string" ? invoiceAny.charge : null,
      memo: hasCommunity
        ? "Platform Support (monthly split: platform share)"
        : "Platform Support (monthly)",
      createdAt: new Date(invoice.created * 1000),
    });

    if (hasCommunity && originatingProfileId) {
      await this.insertPlatformSupportLedgerEntrySafe({
        externalKey: `stripe:invoice:${invoice.id}:community`,
        allocation: "community",
        originatingProfileId,
        mode: "subscription",
        amount: communityShare.toFixed(2),
        currency,
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
        stripeChargeId: typeof invoiceAny.charge === "string" ? invoiceAny.charge : null,
        memo: "Platform Support (monthly split: community share)",
        createdAt: new Date(invoice.created * 1000),
      });

      const ownerUserId = await storage.getProfileOwnerUserId(originatingProfileId);
      if (ownerUserId) {
        try {
          const [user] = await storage.getUsersByIds([ownerUserId]);
          if (user?.county && user.state) {
            const countySnapshot = await storage.getCountyVaultSnapshot({
              countyName: user.county,
              stateCode: user.state,
            });

            if (countySnapshot?.county && countySnapshot.county.id) {
              await storage.recordVaultLedgerEntry({
                countyId: countySnapshot.county.id,
                amount: communityShare,
                sourceType: "platform_support_share",
                sourceId: invoice.id,
                memo: "Platform Support monthly split credit (county vault)",
              });
            }
          }
        } catch (err) {
          console.error(
            "[platform_support] Error crediting county vault for subscription support:",
            err
          );
        }

        await grantCommunityBuilderBadge(ownerUserId, "builder_fund");
      }
    }
  }

  private async insertPlatformSupportLedgerEntrySafe(data: any): Promise<void> {
    try {
      await storage.insertPlatformSupportLedgerEntry(data);
    } catch (error: any) {
      if (
        String(error?.message || "")
          .toLowerCase()
          .includes("duplicate") ||
        String(error?.code) === "23505"
      ) {
        return;
      }
      throw error;
    }
  }
}

export const platformSupportPaymentService = new PlatformSupportPaymentService();
