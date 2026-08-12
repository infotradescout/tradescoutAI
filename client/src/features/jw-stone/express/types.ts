export const JW_EXPRESS_OFFER_STATUSES = [
  "pending_verification",
  "submitted",
  "under_review",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
] as const;

export type JwExpressOfferStatus = (typeof JW_EXPRESS_OFFER_STATUSES)[number];

/** Public target returned by JW Stone. The ref is opaque and safe to send back to the API. */
export type JwExpressOfferTarget = Readonly<{
  ref: string;
  kind: "stone" | "container";
  label: string;
  imageUrl: string | null;
  acceptingOffers: boolean;
  /** Server-serialized USD value, or null when JW Stone has not posted a minimum. */
  minimumOffer: string | null;
}>;

export type JwStonePublicContainer = Readonly<{
  target: JwExpressOfferTarget & Readonly<{ kind: "container" }>;
  description: string | null;
}>;

export type JwExpressAccount = Readonly<{
  legalName: string;
  email: string;
  phone: string;
  isBusiness: boolean;
  businessName: string | null;
  emailVerified: boolean;
}>;

export type JwExpressOfferVersion = Readonly<{
  id: string;
  amount: string;
  status: JwExpressOfferStatus;
  submittedAt: string | null;
}>;

export type JwExpressOffer = Readonly<{
  id: string;
  targetRef: string;
  targetKind: "stone" | "container";
  targetLabel: string;
  amount: string;
  status: JwExpressOfferStatus;
  submittedAt: string | null;
  updatedAt: string | null;
  versions: readonly JwExpressOfferVersion[];
}>;

export type JwExpressSession = Readonly<{
  account: JwExpressAccount | null;
  csrfToken: string | null;
}>;

export type JwStoneSignupRequest = Readonly<{
  legalName: string;
  email: string;
  phone: string;
  isBusiness: boolean;
  businessName: string | null;
  password: string;
  passwordConfirmation: string;
  offer: Readonly<{
    target: Readonly<{ kind: "stone" | "container"; ref: string }>;
    amount: string;
  }>;
}>;

export type SignInJwExpressInput = Readonly<{
  email: string;
  password: string;
}>;
