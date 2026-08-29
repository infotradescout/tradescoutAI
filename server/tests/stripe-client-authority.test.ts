import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { createStripeClientProvider } from "../services/stripeClient";

describe("Stripe client authority", () => {
  it("reads provider configuration for every operation and rotates clients with the key", () => {
    let secret: string | undefined = "sk_test_first";
    const first = { key: "first" } as unknown as Stripe;
    const second = { key: "second" } as unknown as Stripe;
    const createClient = vi
      .fn<(key: string) => Stripe>()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const provider = createStripeClientProvider({
      getSecret: () => secret,
      createClient,
    });

    expect(provider()).toBe(first);
    expect(provider()).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);

    secret = "sk_test_second";
    expect(provider()).toBe(second);
    expect(createClient).toHaveBeenNthCalledWith(2, "sk_test_second");

    secret = undefined;
    expect(provider()).toBeNull();
  });

  it("does not resurrect a client removed during key rotation", () => {
    let secret: string | undefined = "sk_test_first";
    const createClient = vi.fn((key: string) => ({ key }) as unknown as Stripe);
    const provider = createStripeClientProvider({ getSecret: () => secret, createClient });

    expect(provider()).not.toBeNull();
    secret = "";
    expect(provider()).toBeNull();
    secret = "sk_test_first";
    expect(provider()).not.toBeNull();
    expect(createClient).toHaveBeenCalledTimes(2);
  });
});
