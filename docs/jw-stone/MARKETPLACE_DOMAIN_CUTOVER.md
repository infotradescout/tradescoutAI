# JW Stone marketplace domain cutover

**Status:** Replace cutover complete — marketplace is the only public JW home.  
**Goal:** `jwstonelogistics.com` and TradeScout `/jw-stone` serve the marketplace storefront. The legacy `/u/jw-stone` profile storefront is redirected away (not a second public site).

## What customers hit

| Surface | Before | After |
| --- | --- | --- |
| `jwstonelogistics.com` / `www` | Profile HTML (`ProfileSiteView`) | Marketplace HTML + React (`JWStoneMarketplace`) |
| TradeScout `/jw-stone` | Marketplace (parallel) | Marketplace (public home on platform) |
| TradeScout `/u/jw-stone` | Legacy wholesaler profile storefront | **301 / client redirect → marketplace** (`/jw-stone` or custom-domain `/`) |
| Inventory SoT | Profile 119 vs marketplace 148 | One reconciled catalog (148) |
| Stone URLs | Profile `/stones/:slug` | Domain `/stones/:slug`; platform `/jw-stone/stones/:slug` |
| Material URLs | Profile `/materials/:slug` | Domain `/materials/:slug`; platform `/jw-stone/materials/:slug` |
| Trust | Profile about / FAQ | Marketplace `MarketplaceTrustSection` |
| Share | Profile ShareButton | Marketplace share → stone paths |
| New Arrivals rail | Claimed / unmounted | **Permanently dropped** (no SSR claim; not mounted) |

## Redirects

- Custom host `/u/jw-stone` → `/` (marketplace)
- Platform `/u/jw-stone` (public) → custom domain `/` when mapped, else `/jw-stone`
- Platform `/u/jw-stone/stones|materials/...` → domain equivalents when mapped, else `/jw-stone/...`
- `/?stone={slug}` → `/stones/{slug}` (optional `?photo=`)
- `/?category={slug}` → `/materials/{slug}`
- Platform `/jw-stone?stone=` → `/jw-stone/stones/{slug}`
- `/business/jw-stone` canonical route → `/jw-stone` (not `/u/jw-stone`)

**Preserved (not public storefront):**

- `/u/jw-stone/edit` — TradePartner / admin profile editor
- `/u/jw-stone?book=1` — booking surface on profile
- Express Direct Connect gating from marketplace Contact / Ask

## Client flag

Custom-domain marketplace HTML injects:

```js
window.__TS_JW_STONE_MARKETPLACE_SURFACE__ = true;
window.__TS_CUSTOM_DOMAIN_PROFILE_SLUG__ = "jw-stone";
```

`App.tsx` mounts marketplace (not `ProfileSiteView`) when the marketplace surface flag is set. Platform `/u/jw-stone` soft-navigations redirect via `resolveJwStonePublicStorefrontRedirect`.

## Post-deploy verify (owner)

1. Live: `https://jwstonelogistics.com/` is marketplace (not old profile shell).
2. Live: `https://www.thetradescout.com/jw-stone` is the same storefront.
3. Live: `https://www.thetradescout.com/u/jw-stone` redirects to marketplace (domain or `/jw-stone`).
4. Stone deep link: `/stones/cristallo` (domain) and `/jw-stone/stones/cristallo` (platform).
5. Express Direct Connect still opens gated from Contact / Ask.
6. `/u/jw-stone/edit` still loads the profile editor for owners/admins.
7. Share buttons copy marketplace stone URLs.

## Still open (non-blocking)

- Live DB recommendations directory is not mirrored on marketplace (static trust strip only).
