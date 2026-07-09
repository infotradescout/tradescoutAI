# TradeScout Profile Service Ladder

## Purpose

This brief defines the public-facing offer ladder for TradeScout Profiles.
Use it when writing marketing pages, onboarding copy, sales scripts, staff share links, and profile setup prompts.

TradeScout Profiles should be positioned as a website alternative and working business hub for local businesses.

## Core Offer

TradeScout Profiles replace the old static website with a working business hub.

Businesses can build their own profile, have TradeScout set it up for a one-time launch fee, add branding support, or add monthly management when they want the profile handled for them.

## Offer Ladder

### Self-Serve Profile

The business creates and manages its own TradeScout Profile.

Use this for low-friction adoption and beta onboarding.

Public CTA:

```text
Create My Profile
```

### Done-For-You Profile Launch

TradeScout sets up the profile for:

```text
$100 + domain cost
```

The setup can include profile structure, services, photos, clean business copy, contact paths, Direct Connect readiness, and custom-domain connection help when needed.

Public CTA:

```text
Have TradeScout Set It Up
```

### Branding Packages

Optional add-on support for businesses that want a stronger customer-facing look.

Branding support can include logo cleanup, colors, profile graphics, service copy, social images, and general profile polish.

Do not lock public pricing until pricing is approved. Use "ask about packages" or "starting at" only when approved.

Public CTA:

```text
Add Branding Help
```

### Monthly Management

Optional ongoing profile management for businesses that do not want to maintain the profile themselves.

Monthly management can include business info updates, service changes, new photos, seasonal offers, profile copy updates, and ongoing polish.

Do not publish a fixed monthly price until approved. Internal working range for later validation:

```text
$49-$99/month
```

Public CTA:

```text
Ask About Monthly Management
```

## Primary Public Section

Headline:

```text
Your website alternative, built to do more
```

Body:

```text
A traditional website gives your business a place online. A TradeScout Profile gives your business a working hub.

Show your services, photos, work examples, coverage area, business info, contact options, Direct Connect access, Scout visibility, community presence, CRM tools, calendar tools, online payments, finance tools, and more from one clean profile.

Use your TradeScout link or connect your own custom domain.

Set it up yourself, or have TradeScout launch it for you.
```

## Short Sales Version

```text
TradeScout Profiles replace the old static website with a working business hub.

You can build it yourself, or we can set it up for $100 plus domain cost. Your profile can include your services, photos, contact options, Direct Connect, Scout visibility, community presence, CRM tools, calendar tools, online payments, finance tools, and your own custom domain.

Add branding or monthly management whenever you want TradeScout to keep it polished for you.
```

## Best One-Line Positioning

```text
Your TradeScout Profile can be your website, customer intake hub, local discovery page, Direct Connect profile, business toolkit, and custom-domain destination all in one.
```

## Home-Screen App Positioning

TradeScout should support two install experiences:

1. Install TradeScout as the main app.
2. Save a specific profile or business dashboard as its own home-screen app shortcut.

The main TradeScout app should open the broad TradeScout experience. A profile home-screen app should open directly to the business owner's profile dashboard or profile management surface, so the owner gets one-tap access to their business hub.

Use this product framing:

```text
Add your TradeScout Profile to your home screen so your business hub is one tap away.
```

For business owners:

```text
Save your profile as an app icon and jump straight back to your dashboard whenever you need to update services, photos, offers, contact settings, or profile details.
```

For public/customer-facing profile pages:

```text
Customers can save your TradeScout Profile to their home screen for quick access to your services, updates, and protected contact path.
```

### Expected Behavior

- TradeScout app install opens the normal TradeScout entry point.
- Profile install opens that specific profile or profile dashboard.
- Business-owner shortcut should prefer the authenticated dashboard path.
- Public profile shortcut should prefer the public profile path.
- The installed icon name should use the business/profile name when possible.
- The installed icon should use the business logo when available, falling back to TradeScout identity assets.
- Contact still remains gated. A saved icon must not bypass intent, decision, verification, or contact rules.

### Browser Reality

Use careful wording because install behavior differs by platform.

Chrome and other Chromium browsers can support a true install prompt when the current page has a valid manifest and service worker.

iOS Safari does not support the same one-click install prompt. It uses the Share sheet and "Add to Home Screen." The UX should still make this feel simple, but copy should not promise literal one-click install on iPhone.

Production-safe copy:

```text
Add this profile to your home screen.
```

Avoid overpromising:

```text
One-click install on every phone.
```

### Technical Requirement

The profile install flow should use a profile-specific web app manifest or manifest endpoint so each saved profile can have its own:

- app name
- short name
- start URL
- app ID
- icon
- theme color where appropriate

Example shape:

```text
/manifest/profile/:profileSlug.webmanifest
```

The profile manifest should set:

```json
{
  "name": "{Business Name} on TradeScout",
  "short_name": "{Business Name}",
  "start_url": "/business/{slug}?entry=profile_app",
  "id": "/business/{slug}",
  "scope": "/",
  "display": "standalone"
}
```

For authenticated owners, the install CTA can point the user at a dashboard start URL when appropriate:

```text
/business/{slug}/edit?entry=profile_app
```

or the canonical owner dashboard path if the repo standardizes one.

### Owner Dashboard CTA

Use this CTA for authenticated business owners:

```text
Add My Profile App
```

Alternate compact label:

```text
Save to Home Screen
```

Support copy:

```text
Create a home-screen icon that opens straight to your TradeScout Profile dashboard.
```

### Guardrails For Profile Apps

- Do not create a contact bypass.
- Do not expose private dashboard routes to public users.
- Do not claim iOS supports browser-native one-click install.
- Do not fork profile identity away from TradeScout. Use "{Business Name} on TradeScout" where space allows.
- Do not create a separate native app promise. This is a PWA/home-screen shortcut flow unless native app work is explicitly scoped.
- Do not imply customers can globally act from saved profile shortcuts. Any action must stay inside TradeScout's gated flows.

## Production-Safe Wording

Use this wording until every named tool is confirmed live in production:

```text
Profiles are built to support tools like CRM, calendar, online payments, finance tools, Direct Connect, Scout visibility, and custom-domain linking.
```

Once each feature is actually live and verified in production, copy may change to:

```text
Your profile includes...
```

## Guardrails

- Do not describe Scout as a chatbot.
- Do not use "ask Scout."
- Do not promise leads, traffic, ranking, verified status, or guaranteed customer contact.
- Do not claim unconfirmed tools are live.
- Do not imply visibility grants contact or access.
- Keep contact paths gated through intent and approved contact flows.
- Keep copy TradeScout-only.
- Avoid "website" framing that makes Profiles sound like a static page build. The stronger frame is website alternative plus business hub.

## Approved Value Stack Language

Use "available tools may include" or "built to support" when production status varies:

```text
Available tools may include public business profile pages, services, photos and work examples, business info, coverage area, contact options, Direct Connect, Scout visibility, community presence, CRM tools, calendar and scheduling tools, online payments, finance and business tools, and custom-domain linking.
```

Use direct "includes" language only for features confirmed live in production.
