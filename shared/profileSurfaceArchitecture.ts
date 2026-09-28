/**
 * TradeScout profile surfaces are scoped views over shared platform engines.
 *
 * A profile account is a lightweight TradeScout identity relationship, not a
 * second identity system and not proof that full TradeScout onboarding is done.
 * A profile request is a scoped Direct Connect request, not a second request
 * engine. Verification, messaging, notifications and recovery likewise retain
 * their canonical TradeScout authorities.
 */
export const PROFILE_SURFACE_SHARED_ENGINES = Object.freeze({
  account: "tradescout_identity",
  request: "direct_connect",
  verification: "tradescout_verification",
  messaging: "direct_connect_messaging",
  notifications: "tradescout_notifications",
  recovery: "tradescout_account_recovery",
} as const);

export const PROFILE_SURFACE_RULES = Object.freeze({
  profileAccountRequiresFullOnboarding: false,
  profileAccountIsSeparateCredentialSystem: false,
  profileRequestIsSeparateRequestSystem: false,
  profileContextConstrainsSharedEngine: true,
  fullTradeScoutOnboardingMayExpandSameIdentityLater: true,
} as const);
