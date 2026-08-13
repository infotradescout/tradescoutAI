# Selective Intelligence profile-link trigger

Classification: `enforced`

TradeScout public profile HTML advertises a machine-readable Selective Intelligence manifest. A compatible AI that receives a pasted profile link can discover the protected owner route and offer to help manage the profile.

This is a narrow, explicitly approved machine-integration exception to the TradeScout-only public-copy rule. The visible profile remains TradeScout-only. The marker does not make Selective Intelligence a parent brand and does not import MealScout concepts or assets.

## Authority boundary

- A public profile link is context, never authorization.
- The AI asks for user approval before adopting Selective Intelligence when the user did not already request a profile action.
- Profile mutation requires the existing TradeScout sign-in and owner or authorized-manager checks.
- The public manifest contains no session, owner identifier, private profile data, or write credential.
- Until TradeScout ships its own user-scoped remote connector, the manifest reports `remoteOwnerConnectorAvailable: false`; capable browser-control clients may use the existing protected editor only through the user's authenticated session and normal approval gates.
- Contact, county, trust/CVS, and exposure laws remain unchanged.

## Public contract

- Profile pages include `selective-intelligence-trigger=profile-link` and an alternate JSON manifest link.
- `GET /api/u/:slug/selective-intelligence` identifies the canonical profile, supported editor areas, protected sign-in continuation, and current connector limitation.
- `/u/:slug/edit` remains protected by the canonical TradeScout authentication and authorization flow.
