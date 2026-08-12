import { z } from "zod";

export const JW_STONE_EXPRESS_COOKIE_NAME_PRODUCTION = "__Host-jw-express.sid";
export const JW_STONE_EXPRESS_CSRF_COOKIE_NAME_PRODUCTION = "__Host-jw-express.csrf";
export const JW_STONE_EXPRESS_COOKIE_NAME_DEVELOPMENT = "jw-express.sid";
export const JW_STONE_EXPRESS_CSRF_COOKIE_NAME_DEVELOPMENT = "jw-express.csrf";

export const JW_STONE_EXPRESS_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const JW_STONE_EXPRESS_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1_000;
export const JW_STONE_EXPRESS_PASSWORD_RESET_TTL_MS = 60 * 60 * 1_000;

export const JW_STONE_OFFER_STATES = [
  "pending_verification",
  "submitted",
  "under_review",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
] as const;
export const jwStoneOfferStateSchema = z.enum(JW_STONE_OFFER_STATES);
export type JwStoneOfferState = z.infer<typeof jwStoneOfferStateSchema>;

export const JW_STONE_ACTIVE_OFFER_STATES = [
  "pending_verification",
  "submitted",
  "under_review",
] as const satisfies readonly JwStoneOfferState[];

export const JW_STONE_ELIGIBLE_CONTAINER_OFFER_STATES = [
  "submitted",
  "under_review",
] as const satisfies readonly JwStoneOfferState[];

export const JW_STONE_EMAIL_PURPOSES = [
  "jw_stone_express_verification",
  "jw_stone_express_password_reset",
  "jw_stone_offer_confirmation",
  "jw_stone_offer_staff_alert",
  "jw_stone_offer_status",
] as const;
export const jwStoneEmailPurposeSchema = z.enum(JW_STONE_EMAIL_PURPOSES);
export type JwStoneEmailPurpose = z.infer<typeof jwStoneEmailPurposeSchema>;

export const JW_STONE_OUTBOX_RETRY_DELAYS_MS = Object.freeze([
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
]);

export const JW_STONE_IDEMPOTENCY_OPERATIONS = [
  "signup",
  "sign_in",
  "verify",
  "request_password_reset",
  "complete_password_reset",
  "logout",
  "close_account",
  "submit_offer",
  "revise_offer",
  "withdraw_offer",
  "operator_create_container",
  "operator_update_container",
  "operator_publish_container",
  "operator_close_container",
  "operator_reopen_container",
  "operator_update_stone_settings",
  "operator_review_offer",
  "operator_reveal_contact",
  "operator_accept_offer",
  "operator_decline_offer",
  "operator_expire_offer",
  "operator_retry_email",
] as const;
export const jwStoneIdempotencyOperationSchema = z.enum(JW_STONE_IDEMPOTENCY_OPERATIONS);
export type JwStoneIdempotencyOperation = z.infer<typeof jwStoneIdempotencyOperationSchema>;

const MAX_POSTGRES_INTEGER = 2_147_483_647;
const USD_INPUT_PATTERN = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/;
const USD_DISPLAY_PATTERN = /^(?:0|[1-9]\d*)\.\d{2}$/;

export function parseJwStoneUsdToCents(value: string): number {
  const normalized = String(value).trim();
  if (!USD_INPUT_PATTERN.test(normalized)) {
    throw new Error("Amount must be a positive USD decimal with no more than two decimal places.");
  }
  const [dollars, fractional = ""] = normalized.split(".");
  const cents = Number(dollars) * 100 + Number(fractional.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_POSTGRES_INTEGER) {
    throw new Error("Amount is outside the supported range.");
  }
  return cents;
}

export function formatJwStoneUsdFromCents(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_POSTGRES_INTEGER) {
    throw new Error("Invalid integer-cent amount.");
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function normalizeJwStoneExpressEmail(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function normalizeJwStoneExpressPhone(value: string): string | null {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || /[a-z]/i.test(normalized)) return null;
  const hasInternationalPrefix = normalized.startsWith("+");
  const digits = normalized.replace(/\D/g, "");

  if (digits.length === 10 && !hasInternationalPrefix) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1") && !hasInternationalPrefix) {
    return `+${digits}`;
  }
  if (hasInternationalPrefix && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export function normalizeJwStoneExpressName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export const jwStoneEmailSchema = z
  .string()
  .min(3)
  .max(320)
  .transform(normalizeJwStoneExpressEmail)
  .pipe(z.string().email().max(320));

export const jwStonePhoneSchema = z
  .string()
  .min(8)
  .max(64)
  .transform(normalizeJwStoneExpressPhone)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/));

export const jwStonePersonNameSchema = z
  .string()
  .min(1)
  .max(160)
  .transform(normalizeJwStoneExpressName)
  .pipe(z.string().min(1).max(160));

export const jwStonePasswordSchema = z.string().superRefine((value, context) => {
  const byteLength = new TextEncoder().encode(value).byteLength;
  if (byteLength < 10 || byteLength > 72) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Password must be between 10 and 72 UTF-8 bytes.",
    });
  }
});

export const jwStoneOpaqueTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const jwStoneStoneTargetRefSchema = z.string().regex(/^jws_[A-Za-z0-9_-]{43}$/);
export const jwStoneContainerTargetRefSchema = z.string().regex(/^jwc_[A-Za-z0-9_-]{43}$/);
export const jwStoneOfferRefSchema = z.string().uuid();
export const jwStoneIdempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);
export const jwStoneUsdInputSchema = z.string().transform((value, context) => {
  try {
    return parseJwStoneUsdToCents(value);
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : "Invalid USD amount.",
    });
    return z.NEVER;
  }
});
export const jwStoneUsdDisplaySchema = z.string().regex(USD_DISPLAY_PATTERN);

export const jwStoneOfferTargetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("stone"),
      ref: jwStoneStoneTargetRefSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("container"),
      ref: jwStoneContainerTargetRefSchema,
    })
    .strict(),
]);
export type JwStoneOfferTarget = z.infer<typeof jwStoneOfferTargetSchema>;

export const jwStoneSignupRequestSchema = z
  .object({
    legalName: jwStonePersonNameSchema,
    displayName: jwStonePersonNameSchema.optional(),
    email: jwStoneEmailSchema,
    phone: jwStonePhoneSchema,
    isBusiness: z.boolean(),
    businessName: jwStonePersonNameSchema.nullable().optional(),
    password: jwStonePasswordSchema,
    passwordConfirmation: z.string(),
    offer: z
      .object({
        target: jwStoneOfferTargetSchema,
        amount: jwStoneUsdInputSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirmation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passwordConfirmation"],
        message: "Passwords do not match.",
      });
    }
    if (value.isBusiness && !value.businessName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businessName"],
        message: "Business name is required for business accounts.",
      });
    }
    if (!value.isBusiness && value.businessName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businessName"],
        message: "Business name is only accepted for business accounts.",
      });
    }
  });

export const jwStoneSignInRequestSchema = z
  .object({ email: jwStoneEmailSchema, password: z.string().min(1).max(256) })
  .strict();

export const jwStoneVerifyRequestSchema = z.object({ token: jwStoneOpaqueTokenSchema }).strict();

export const jwStonePasswordResetRequestSchema = z.object({ email: jwStoneEmailSchema }).strict();

export const jwStonePasswordResetCompleteSchema = z
  .object({
    token: jwStoneOpaqueTokenSchema,
    password: jwStonePasswordSchema,
    passwordConfirmation: z.string(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirmation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passwordConfirmation"],
        message: "Passwords do not match.",
      });
    }
  });

export const jwStoneSubmitOfferRequestSchema = z
  .object({ target: jwStoneOfferTargetSchema, amount: jwStoneUsdInputSchema })
  .strict();

export const jwStoneReviseOfferRequestSchema = z.object({ amount: jwStoneUsdInputSchema }).strict();

export const jwStoneWithdrawOfferRequestSchema = z
  .object({ reason: z.string().trim().min(1).max(500).optional() })
  .strict();

export const jwStoneCloseAccountRequestSchema = z
  .object({ password: z.string().min(1).max(256) })
  .strict();

const jwStonePublicImageUrlSchema = z
  .string()
  .trim()
  .max(2_000)
  .refine((value) => {
    if (value.startsWith("/")) return !value.startsWith("//");
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use an HTTPS or safe root-relative image URL.");

export const jwStoneOperatorContainerCreateSchema = z
  .object({
    sourceRef: z.string().trim().min(1).max(160),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(4_000),
    imageUrl: jwStonePublicImageUrlSchema.nullable().optional(),
    acceptingOffers: z.boolean().default(true),
    minimumAmount: jwStoneUsdInputSchema.nullable().optional(),
  })
  .strict();

export const jwStoneOperatorContainerUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().min(1).max(4_000).optional(),
    imageUrl: jwStonePublicImageUrlSchema.nullable().optional(),
    acceptingOffers: z.boolean().optional(),
    minimumAmount: jwStoneUsdInputSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const jwStoneOperatorStoneSettingsSchema = z
  .object({
    acceptingOffers: z.boolean(),
    minimumAmount: jwStoneUsdInputSchema.nullable(),
  })
  .strict();

export const jwStoneOperatorDecisionSchema = z
  .object({ note: z.string().trim().min(1).max(2_000).optional() })
  .strict();

export const jwStonePublicTargetSchema = z
  .object({
    kind: z.enum(["stone", "container"]),
    ref: z.string(),
    label: z.string().min(1),
    imageUrl: z.string().nullable(),
    description: z.string().nullable(),
    acceptingOffers: z.boolean(),
    minimumAmount: jwStoneUsdDisplaySchema.nullable(),
  })
  .strict();
export type JwStonePublicTarget = z.infer<typeof jwStonePublicTargetSchema>;

export const jwStoneRequesterAccountSchema = z
  .object({
    accountRef: z.string().uuid(),
    legalName: z.string(),
    displayName: z.string(),
    email: z.string().email(),
    phone: z.string(),
    isBusiness: z.boolean(),
    businessName: z.string().nullable(),
    emailVerified: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const jwStoneRequesterOfferVersionSchema = z
  .object({
    version: z.number().int().positive(),
    status: jwStoneOfferStateSchema,
    amount: jwStoneUsdDisplaySchema,
    submittedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const jwStoneRequesterOfferSchema = z
  .object({
    offerRef: jwStoneOfferRefSchema,
    target: jwStonePublicTargetSchema,
    status: jwStoneOfferStateSchema,
    amount: jwStoneUsdDisplaySchema,
    submittedAt: z.string().datetime().nullable(),
    history: z.array(jwStoneRequesterOfferVersionSchema),
  })
  .strict();

export const jwStoneOperatorOutboxSchema = z
  .object({
    outboxRef: z.string().uuid(),
    purpose: jwStoneEmailPurposeSchema,
    maskedRecipient: z.string(),
    status: z.enum(["pending", "processing", "retry", "sent", "failed", "cancelled"]),
    attemptCount: z.number().int().nonnegative(),
    availableAt: z.string().datetime(),
    sentAt: z.string().datetime().nullable(),
    failedAt: z.string().datetime().nullable(),
    lastErrorSummary: z.string().nullable(),
    templateFields: z.array(z.string()),
    retryOfRef: z.string().uuid().nullable(),
  })
  .strict();
