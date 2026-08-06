# JW Stone marketplace domain cutover

**Status:** Implemented on `jw-stone/marketplace-replace-profile` (pending owner preview GO before merge).  
**Goal:** `jwstonelogistics.com` serves the marketplace storefront so marketplace can replace the legacy wholesaler profile as the public site.

## What changed

| Surface | Before | After |
| --- | --- | --- |
| `jwstonelogistics.com` / `www` | Profile HTML (`ProfileSiteView`) | Marketplace HTML + React (`JWStoneMarketplace`) |
| Inventory SoT | Profile 119 vs marketplace 148 | One reconciled catalog (148) for profile adapter, share metadata, marketplace |
| Stone URLs | Profile `/stones/:slug` | Same paths on custom domain; platform `/jw-stone/stones/:slug` |
| Material URLs | Profile `/materials/:slug` | Same on custom domain; platform `/jw-stone/materials/:slug` |
| Trust | Profile about / FAQ / differentiators | Marketplace `MarketplaceTrustSection` (+ story heading) |
| Share | Profile ShareButton | Marketplace cards + detail ShareButton → `/stones/{slug}` |

## Redirects preserved

- `/u/jw-stone` on the custom host → `/`
- `/?stone={slug}` → `/stones/{slug}` (optional `?photo=`)
- `/?category={slug}` → `/materials/{slug}`
- Platform `/jw-stone?stone=` → `/jw-stone/stones/{slug}`

## Client flag

Custom-domain marketplace HTML injects:

```js
window.__TS_JW_STONE_MARKETPLACE_SURFACE__ = true;
window.__TS_CUSTOM_DOMAIN_PROFILE_SLUG__ = "jw-stone";
```

`App.tsx` mounts marketplace (not `ProfileSiteView`) when the marketplace surface flag is set.

## Verify locally

1. `npm run dev` (or project standard).
2. Platform: open `http://127.0.0.1:5000/jw-stone` and `/jw-stone/stones/cristallo`.
3. Custom host (hosts file or local proxy): point `jwstonelogistics.com` at local, confirm `/` is marketplace, `/stones/cristallo` opens the stone, `/materials/granite` filters material.
4. Confirm Express Direct Connect still opens from Contact / Ask (gated).
5. Confirm share buttons copy `/stones/{slug}` (domain) or `/jw-stone/stones/{slug}` (platform).

## Still open / owner decisions

- Live DB recommendations directory is not mirrored on marketplace (static trust strip only).
- Legacy `/u/jw-stone` on TradeScout still renders the profile editor/public profile route for platform paths — custom domain no longer does.
- New Arrivals rail remains unmounted (SSR no longer claims it); mount or permanently drop in a follow-up.
- Do not merge to `main` until owner local preview GO.
