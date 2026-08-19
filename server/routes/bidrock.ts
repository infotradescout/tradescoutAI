import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import {
  BIDROCK_DEFAULT_PROFILE_SLUG,
  BIDROCK_PRICE_UNITS,
  BIDROCK_PUBLIC_ROUTE,
  buildBidRockSourceProfileAccountPath,
  formatBidRockPrice,
  normalizeBidRockAmountToCents,
} from "@shared/bidrock";
import {
  clearBidRockListingPrice,
  listBidRockCatalog,
  setBidRockListingPrice,
  type BidRockCatalogListing,
} from "../services/bidrockService";

type OptionalAuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; [key: string]: unknown };
};

const priceSchema = z
  .object({
    unit: z.enum(BIDROCK_PRICE_UNITS),
    amount: z.coerce.number().positive().max(1_000_000),
  })
  .strict();

function getUserId(req: OptionalAuthedRequest): string | null {
  const userId = req.user?.id || req.user?.claims?.sub;
  const normalized = String(userId || "").trim();
  return normalized || null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safePath(value: unknown, fallback = BIDROCK_PUBLIC_ROUTE): string {
  const path = String(value || "").trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }
  return path;
}

function pageShell(args: {
  title: string;
  description: string;
  body: string;
  script?: string;
}): string {
  const defaultAccountPath = buildBidRockSourceProfileAccountPath(
    BIDROCK_DEFAULT_PROFILE_SLUG
  );
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(args.title)}</title>
  <meta name="description" content="${escapeHtml(args.description)}" />
  <style>
    :root{--ink:#151510;--paper:#f5f0e6;--card:#fffdf8;--line:#cfc6b4;--moss:#73813c;--muted:#6a675e;--dark:#20251e;--shadow:0 20px 60px rgba(43,39,30,.12)}
    *{box-sizing:border-box}html{background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0;min-height:100vh;background:radial-gradient(circle at 95% 0,rgba(115,129,60,.12),transparent 28rem),var(--paper)}a{color:inherit;text-decoration:none}button,input,select{font:inherit}.wrap{width:min(1540px,calc(100% - 32px));margin:0 auto}.top{position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(35,35,28,.15);background:rgba(245,240,230,.94);backdrop-filter:blur(16px)}.topin{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:12px;font-weight:900;letter-spacing:-.03em}.mark{display:grid;width:38px;height:38px;place-items:center;border-radius:12px;background:var(--dark);color:#fff;font-family:Georgia,serif;font-size:23px}.actions{display:flex;align-items:center;gap:10px}.btn{display:inline-flex;min-height:44px;align-items:center;justify-content:center;border:1px solid var(--ink);border-radius:999px;padding:0 18px;font-weight:800;background:transparent;cursor:pointer}.btn.primary{border-color:var(--moss);background:var(--moss);color:white}.btn.small{min-height:38px;padding:0 14px;font-size:13px}.hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:32px;padding:42px 0 26px}.eyebrow{font-size:11px;font-weight:900;letter-spacing:.22em;text-transform:uppercase;color:var(--moss)}h1{margin:12px 0 0;font-family:Georgia,"Times New Roman",serif;font-size:clamp(42px,6vw,82px);line-height:.96;font-weight:500;letter-spacing:-.055em}.lead{max-width:780px;margin:20px 0 0;color:var(--muted);font-size:17px;line-height:1.65}.accountbox{align-self:end;border:1px solid var(--line);border-radius:24px;background:rgba(255,253,248,.72);padding:22px;box-shadow:var(--shadow)}.accountbox strong{display:block;font-family:Georgia,serif;font-size:25px;font-weight:500}.accountbox p{margin:8px 0 18px;color:var(--muted);line-height:1.55}.toolbar{display:grid;grid-template-columns:minmax(240px,1fr) repeat(2,minmax(180px,.28fr));gap:12px;padding:16px;border:1px solid var(--line);border-radius:22px;background:var(--card);box-shadow:0 12px 35px rgba(43,39,30,.07)}.field{width:100%;min-height:46px;border:1px solid var(--line);border-radius:14px;background:white;padding:0 14px;color:var(--ink)}.count{margin:16px 2px 12px;color:var(--muted);font-size:13px;font-weight:800}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;padding-bottom:56px}.card{display:flex;min-width:0;flex-direction:column;overflow:hidden;border:1px solid var(--line);border-radius:22px;background:var(--card);box-shadow:0 14px 45px rgba(43,39,30,.08)}.photo{position:relative;aspect-ratio:1.18/1;background:linear-gradient(145deg,#e6dfd1,#c7bda9);overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .45s ease}.card:hover .photo img{transform:scale(1.025)}.badge{position:absolute;top:12px;left:12px;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:999px;background:rgba(19,20,15,.86);color:white;padding:8px 11px;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.content{display:flex;flex:1;flex-direction:column;padding:18px}.material{font-size:10px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:var(--moss)}.title{margin:7px 0 0;font-family:Georgia,serif;font-size:26px;line-height:1.05;font-weight:500}.source{margin:9px 0 0;color:var(--muted);font-size:13px}.summary{margin:13px 0 0;color:var(--muted);font-size:13px;line-height:1.55}.price{margin-top:17px;border-top:1px solid var(--line);padding-top:15px;font-size:17px;font-weight:900}.cardactions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:auto;padding-top:17px}.cardactions .btn{white-space:nowrap;padding:0 10px;font-size:12px}.priceform{display:grid;grid-template-columns:1fr 92px auto;gap:8px;margin-top:12px}.priceform input,.priceform select{min-width:0;height:40px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:0 10px}.priceform button{height:40px;border:0;border-radius:12px;background:var(--dark);color:#fff;padding:0 12px;font-weight:900;cursor:pointer}.notice{margin:0 0 18px;border:1px solid rgba(115,129,60,.35);border-radius:16px;background:rgba(115,129,60,.09);padding:14px 16px;color:#3e4822;font-weight:750}.empty{grid-column:1/-1;border:1px dashed var(--line);border-radius:22px;padding:42px;text-align:center;color:var(--muted)}@media(max-width:1120px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:860px){.hero{grid-template-columns:1fr}.accountbox{align-self:auto}.toolbar{grid-template-columns:1fr 1fr}.toolbar input{grid-column:1/-1}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:580px){.wrap{width:min(100% - 20px,1540px)}.topin{min-height:64px}.actions .btn:not(.primary){display:none}.hero{padding-top:28px}.toolbar{grid-template-columns:1fr}.toolbar input{grid-column:auto}.grid{grid-template-columns:1fr}.cardactions{grid-template-columns:1fr}.priceform{grid-template-columns:1fr 1fr}.priceform button{grid-column:1/-1}}
  </style>
</head>
<body>
  <header class="top"><div class="wrap topin"><a class="brand" href="/bidrock"><span class="mark">B</span><span>BidRock <small style="display:block;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)">Powered by TradeScout</small></span></a><nav class="actions"><a class="btn" href="/">TradeScout</a><a class="btn primary" href="${escapeHtml(defaultAccountPath)}">Create an account</a></nav></div></header>
  ${args.body}
  ${args.script ? `<script>${args.script}</script>` : ""}
</body>
</html>`;
}

function priceEditor(listing: BidRockCatalogListing): string {
  if (!listing.canManagePrice) return "";
  const amount = listing.price ? (listing.price.amountCents / 100).toFixed(2) : "";
  const selectedSqft = listing.price?.unit === "sqft" || !listing.price ? " selected" : "";
  const selectedSlab = listing.price?.unit === "slab" ? " selected" : "";
  return `<form class="priceform" data-price-form data-listing-id="${escapeHtml(listing.id)}">
    <input name="amount" inputmode="decimal" placeholder="Your price" value="${escapeHtml(amount)}" aria-label="Price amount" required />
    <select name="unit" aria-label="Price unit"><option value="sqft"${selectedSqft}>per sq ft</option><option value="slab"${selectedSlab}>per slab</option></select>
    <button type="submit">Save price</button>
  </form>`;
}

function listingPrice(listing: BidRockCatalogListing): string {
  if (listing.price) {
    return `<div class="price">${escapeHtml(formatBidRockPrice(listing.price))}</div>`;
  }
  if (listing.priceState === "seller_choice") {
    return `<div class="price">Set your price per square foot or per slab.</div>`;
  }
  if (listing.priceState === "not_set") {
    return `<div class="price">The seller has not set a price.</div>`;
  }
  return `<div class="price">Create an account with the source profile to access business pricing.</div>`;
}

function listingCard(listing: BidRockCatalogListing): string {
  const searchable = [
    listing.title,
    listing.materialFamily,
    listing.sourceProfileName,
    listing.sourceProfileSlug,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const material = listing.materialFamily
    ? listing.materialFamily.replace(/-/g, " ")
    : "Stone";
  const image = listing.imageUrl
    ? `<img src="${escapeHtml(listing.imageUrl)}" alt="${escapeHtml(listing.title)}" loading="lazy" />`
    : "";

  return `<article class="card" data-listing data-search="${escapeHtml(searchable)}" data-material="${escapeHtml(listing.materialFamily || "other")}" data-source="${escapeHtml(listing.sourceProfileSlug)}">
    <div class="photo">${image}<span class="badge">${escapeHtml(listing.sourceProfileName)}</span></div>
    <div class="content"><div class="material">${escapeHtml(material)}</div><h2 class="title">${escapeHtml(listing.title)}</h2><p class="source">Listed from ${escapeHtml(listing.sourceProfileName)}</p>${listing.summary ? `<p class="summary">${escapeHtml(listing.summary)}</p>` : ""}${listingPrice(listing)}${priceEditor(listing)}<div class="cardactions"><a class="btn small" href="${escapeHtml(safePath(listing.profileUrl))}">View source</a><a class="btn primary small" href="${escapeHtml(safePath(listing.profileAccountPath))}">Create an account</a></div></div>
  </article>`;
}

function accountStateCopy(
  status: "none" | "pending_verification" | "active" | "suspended" | "revoked",
  verifiedBusiness: boolean
): { title: string; body: string } {
  if (verifiedBusiness) {
    return {
      title: "BidRock access active",
      body: "Your verified business account with a stone profile gives you business pricing across BidRock.",
    };
  }
  if (status === "pending_verification") {
    return {
      title: "Business verification pending",
      body: "Your stone-profile account is connected. BidRock pricing activates when business verification is approved.",
    };
  }
  if (status === "suspended" || status === "revoked") {
    return {
      title: "BidRock access unavailable",
      body: "Open the applicable stone profile to review your business account status.",
    };
  }
  return {
    title: "Create an account from a stone profile",
    body: "Choose a stone, open its source profile, and create an account there. The same verified business identity unlocks BidRock.",
  };
}

async function renderMarketplace(req: OptionalAuthedRequest, res: Response): Promise<void> {
  try {
    const catalog = await listBidRockCatalog(getUserId(req));
    const materials = [
      ...new Set(catalog.listings.map((item) => item.materialFamily || "other")),
    ].sort();
    const sources = [
      ...new Map(
        catalog.listings.map((item) => [item.sourceProfileSlug, item.sourceProfileName])
      ).entries(),
    ].sort((a, b) => a[1].localeCompare(b[1]));
    const state = accountStateCopy(
      catalog.viewer.accountStatus,
      catalog.viewer.verifiedBusiness
    );
    const cards = catalog.listings.length
      ? catalog.listings.map(listingCard).join("\n")
      : `<div class="empty">No stone records are ready for BidRock yet.</div>`;

    const body = `<main class="wrap">
      <section class="hero"><div><div class="eyebrow">Business stone marketplace</div><h1>Every TradeScout stone. One market.</h1><p class="lead">BidRock brings stone from published TradeScout profiles and Stone Core into one business marketplace without copying physical inventory truth. Authorized sellers control their own price by square foot or by slab.</p></div><aside class="accountbox"><strong>${escapeHtml(state.title)}</strong><p>${escapeHtml(state.body)}</p><a class="btn primary" href="${escapeHtml(buildBidRockSourceProfileAccountPath(BIDROCK_DEFAULT_PROFILE_SLUG))}">Create an account</a></aside></section>
      <section class="toolbar" aria-label="BidRock filters"><input id="bidrock-search" class="field" type="search" placeholder="Search stone, material, or source" /><select id="bidrock-material" class="field"><option value="">All materials</option>${materials.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value.replace(/-/g, " "))}</option>`).join("")}</select><select id="bidrock-source" class="field"><option value="">All sources</option>${sources.map(([slug, name]) => `<option value="${escapeHtml(slug)}">${escapeHtml(name)}</option>`).join("")}</select></section>
      <p class="count"><span id="bidrock-count">${catalog.listings.length}</span> stone listings</p>
      <section id="bidrock-grid" class="grid">${cards}</section>
    </main>`;

    const script = `(() => {
      const search = document.getElementById('bidrock-search');
      const material = document.getElementById('bidrock-material');
      const source = document.getElementById('bidrock-source');
      const count = document.getElementById('bidrock-count');
      const cards = Array.from(document.querySelectorAll('[data-listing]'));
      const apply = () => {
        const q = String(search?.value || '').trim().toLowerCase();
        const m = String(material?.value || '');
        const s = String(source?.value || '');
        let visible = 0;
        cards.forEach((card) => {
          const match = (!q || String(card.dataset.search || '').includes(q)) && (!m || card.dataset.material === m) && (!s || card.dataset.source === s);
          card.hidden = !match;
          if (match) visible += 1;
        });
        if (count) count.textContent = String(visible);
      };
      [search, material, source].forEach((node) => node?.addEventListener(node === search ? 'input' : 'change', apply));
      document.querySelectorAll('[data-price-form]').forEach((form) => {
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          const response = await fetch('/api/bidrock/listings/' + encodeURIComponent(form.dataset.listingId) + '/price', {
            method: 'PATCH', credentials: 'include', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ amount: data.get('amount'), unit: data.get('unit') })
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) { window.alert(payload.message || 'Price could not be saved.'); return; }
          window.location.reload();
        });
      });
    })();`;

    res.status(200).type("html").send(
      pageShell({
        title: "BidRock | Business Stone Marketplace",
        description: "Stone listings from TradeScout profiles and Stone Core.",
        body,
        script,
      })
    );
  } catch (error) {
    console.error("[bidrock] marketplace failed", error);
    res.status(500).type("text").send("BidRock is temporarily unavailable.");
  }
}

function renderLegacyAccountRedirect(req: Request, res: Response): void {
  const requestedProfile = String(
    req.query?.profile || BIDROCK_DEFAULT_PROFILE_SLUG
  )
    .trim()
    .toLowerCase();
  res.redirect(302, buildBidRockSourceProfileAccountPath(requestedProfile));
}

export function registerBidRockRoutes(app: Express): void {
  app.get(
    "/api/bidrock/catalog",
    async (req: OptionalAuthedRequest, res: Response): Promise<void> => {
      try {
        res.json(await listBidRockCatalog(getUserId(req)));
      } catch (error) {
        console.error("[bidrock] catalog failed", error);
        res.status(500).json({ message: "BidRock catalog is temporarily unavailable." });
      }
    }
  );

  app.patch(
    "/api/bidrock/listings/:id/price",
    isAuthenticated,
    async (req: OptionalAuthedRequest, res: Response): Promise<void> => {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: "Authentication required" });
          return;
        }
        const parsed = priceSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            message: "Enter a price and choose square foot or slab.",
          });
          return;
        }
        const amountCents = normalizeBidRockAmountToCents(parsed.data.amount);
        if (!amountCents) {
          res.status(400).json({ message: "Enter a valid positive price." });
          return;
        }
        const price = await setBidRockListingPrice({
          userId,
          listingId: String(req.params.id || ""),
          unit: parsed.data.unit,
          amountCents,
        });
        res.json({ price });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Price could not be saved.";
        const status = /access required/i.test(message)
          ? 403
          : /not found/i.test(message)
            ? 404
            : 500;
        res.status(status).json({ message });
      }
    }
  );

  app.delete(
    "/api/bidrock/listings/:id/price",
    isAuthenticated,
    async (req: OptionalAuthedRequest, res: Response): Promise<void> => {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: "Authentication required" });
          return;
        }
        res.json(
          await clearBidRockListingPrice({
            userId,
            listingId: String(req.params.id || ""),
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Price could not be cleared.";
        const status = /access required/i.test(message)
          ? 403
          : /not found/i.test(message)
            ? 404
            : 500;
        res.status(status).json({ message });
      }
    }
  );

  app.get(`${BIDROCK_PUBLIC_ROUTE}/account`, renderLegacyAccountRedirect);
  app.get(BIDROCK_PUBLIC_ROUTE, renderMarketplace);
  app.get(`${BIDROCK_PUBLIC_ROUTE}/`, renderMarketplace);
}
