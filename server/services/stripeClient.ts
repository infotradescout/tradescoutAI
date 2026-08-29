import Stripe from "stripe";

export const STRIPE_API_VERSION = "2025-08-27.basil" as const;

export type StripeClientProvider = () => Stripe | null;

type StripeClientFactory = (secretKey: string) => Stripe;
type StripeSecretProvider = () => string | undefined;

/**
 * Resolve Stripe at the moment an operation starts.
 *
 * The cache is keyed by the current secret rather than by process lifetime. That
 * keeps a warm process from continuing to use a client created with a rotated or
 * removed key, while still avoiding a new SDK object for every request.
 */
export function createStripeClientProvider(
  options: {
    getSecret?: StripeSecretProvider;
    createClient?: StripeClientFactory;
  } = {}
): StripeClientProvider {
  const getSecret = options.getSecret ?? (() => process.env.STRIPE_SECRET_KEY);
  const createClient =
    options.createClient ??
    ((secretKey: string) =>
      new Stripe(secretKey, {
        apiVersion: STRIPE_API_VERSION,
      }));

  let cachedSecret: string | null = null;
  let cachedClient: Stripe | null = null;

  return () => {
    const currentSecret = String(getSecret() || "").trim();
    if (!currentSecret) {
      cachedSecret = null;
      cachedClient = null;
      return null;
    }

    if (!cachedClient || cachedSecret !== currentSecret) {
      cachedSecret = currentSecret;
      cachedClient = createClient(currentSecret);
    }

    return cachedClient;
  };
}

export const getStripeClient = createStripeClientProvider();

export function requireStripeClient(provider: StripeClientProvider = getStripeClient): Stripe {
  const client = provider();
  if (!client) throw new Error("STRIPE_SECRET_KEY is missing");
  return client;
}
