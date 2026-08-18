# R.E.D. Graniti profile, not landing page

## Approved intent lock

Approved in chat on 2026-08-18 after the rendered production page was rejected as a generic marketing landing page.

- The route remains a real TradeScout business profile controlled by TradeScout admin.
- The first screen identifies R.E.D. Graniti directly with cover image, logo, name, business type, location, summary, Call, Start a Request, and Share.
- The giant campaign headline, oversized dark hero, custom navigation header, metric strip, and repeated promotional CTA blocks are removed.
- Primary profile controls say **Call** and **Start a Request**. JW Stone routing remains behind the protected call and request behavior.
- Official R.E.D. Graniti company phone, email, address, map, and website remain readable as company information.
- The public structure is About, Blocks/Slabs/Distribution, Quarry Network, Locations, Company Contact, and one secondary First-Cut Distribution relationship card.
- Quarry imagery remains visible at normal contrast rather than hidden beneath a full black treatment.
- The request form stays specific to material, format, quantity or dimensions, destination, timing, and project details.
- R.E.D. Graniti identity, JW Stone's distribution right, Stone Core material truth, and physical inventory remain separate.

## Source evidence

R.E.D. Graniti's official presence establishes:

- more than 50 years in natural stone;
- the public business lanes Blocks, Slabs, and Distribution;
- each block is checked, controlled, and cataloged;
- slabs follow the same checks and selection standards;
- company-owned quarry operations across named countries;
- Massa headquarters and block yard, Dolcè block yard, and Cavaion Veronese slab warehouse;
- official company phone, email, address, and website.

## Worker result

Changed:

- `client/src/pages/profile-sites/RedGranitiProfileTheme.tsx`
- `client/src/pages/profile-sites/RedGranitiDirectConnectPanel.tsx`
- `shared/redGranitiProfile.ts`
- `server/tests/red-graniti-profile-theme.contract.test.ts`
- `server/tests/red-graniti-profile.contract.test.ts`

Enabled:

- compact cover and identity profile header;
- one desktop Call and Start a Request action pair;
- one mobile persistent Call and Start a Request action pair;
- factual company sections in a profile layout;
- company contact and official links in a compact sidebar;
- secondary, non-dominant first-cut relationship card;
- immediate protected call path behind the plain Call label;
- dedicated first-cut request form with plain user-facing language.

## Objector checks

Release-blocking findings the implementation must prevent:

1. A giant headline or metric strip reappears.
2. Call is relabeled Call JW Stone on the primary profile surface.
3. The relationship card dominates the company identity.
4. Company contact disappears or becomes the request-routing address.
5. Quarry imagery is hidden by an opaque black overlay.
6. Generic showroom, bundle, or service choices return to the request form.
7. R.E.D. material is represented as JW Stone inventory.

## Proof required before release

1. Production build and server bundle pass.
2. Contract tests pass.
3. Logged-out desktop screenshot shows the compact profile identity without a giant slogan or metric strip.
4. Logged-out mobile screenshot shows the identity and fixed Call / Start a Request controls.
5. Protected Call reveals the JW Stone phone only after the visitor chooses Call.
6. The first-cut request posts to JW Stone with R.E.D. context.
7. R.E.D. profile ownership remains TradeScout admin controlled and separate from JW Stone.
8. Stone Core remains nine canonical source materials with no manufactured physical inventory.
