import { stoneListingPath, stoneInquiryPath, stoneSlabMaterialPrice } from "../shared/exchangeStoneBuyerFlow";

export type StoneLandingItem = { id: string; title: string; description: string; price: unknown; images: string[]; specifications?: Record<string, unknown> };
export type StoneLandingInput = {
  audience: { allowed: boolean; reason: string }; items: StoneLandingItem[];
  /** True only after the publication reader verifies at least one approved price + seller. */
  publicationReady: boolean;
  market?: { city?: string; state?: string };
  acquisitionTags?: Record<string, string>;
  states: string[];
  search?: string;
};
const e = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const ORIGIN = "https://www.thetradescout.com";
const TAG_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];

function attributionParams(tags: Record<string, string> = {}): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of TAG_KEYS) if (typeof tags[key] === "string" && /^[a-zA-Z0-9_.-]{1,80}$/.test(tags[key])) params.set(key, tags[key]);
  return params;
}
function link(path: string, input: StoneLandingInput): string {
  const url = new URL(path, ORIGIN);
  for (const [key, value] of attributionParams(input.acquisitionTags)) url.searchParams.set(key, value);
  if (input.market?.state) {
    url.searchParams.set("audienceState", input.market.state);
    if (input.market.city) url.searchParams.set("audienceCity", input.market.city);
    url.searchParams.set("audienceCountry", "US");
  }
  return url.pathname + url.search;
}

/** No crawler-only branch. Hidden items never leak through HTML, images, JSON-LD or links. */
export function renderExchangeStoneLanding(input: StoneLandingInput): { html: string; robots: string } {
  const robots = input.publicationReady ? "index, follow" : "noindex, follow";
  const visible = input.publicationReady && input.audience.allowed ? input.items.filter(item =>
    stoneListingPath(item.id) && stoneSlabMaterialPrice(item.price, item.specifications?.priceUnit,
      item.specifications?.referenceSizesInches, item.specifications?.exactSlab) &&
    Array.isArray(item.images) && item.images.some(image => image === `/api/exchange/stone-media/${item.id}`)
  ) : [];
  const stateOptions = input.states.map(s => `<option value="${e(s)}"${input.market?.state === s ? " selected" : ""}>${e(s)}</option>`).join("");
  const hiddenTags = [...attributionParams(input.acquisitionTags)].map(([key, value]) => `<input type="hidden" name="${e(key)}" value="${e(value)}">`).join("");
  const description = "Shop stone slabs through TradeScout Exchange. Compare published material prices and photos, then ask TradeScout about availability, exact dimensions and delivery.";
  const cardMarkup = visible.map((item, index) => {
    const slabPrice = stoneSlabMaterialPrice(item.price, item.specifications?.priceUnit,
      item.specifications?.referenceSizesInches, item.specifications?.exactSlab)!;
    const note = slabPrice.kind === "size_required" ? "Material rate only · confirm slab dimensions."
      : slabPrice.kind === "estimated" ? "Reference-size estimate · confirm the selected slab."
      : "For the identified slab · confirm availability.";
    return `<article class="stone-card"><a href="${e(link(stoneListingPath(item.id)!, input))}" aria-label="View ${e(item.title)}"><img width="800" height="600" loading="${index ? "lazy" : "eager"}" decoding="async" src="${e(link(`/api/exchange/stone-media/${item.id}`, input))}" alt="${e(item.title)}"></a><div class="card-body"><p class="seller">Sold by TradeScout</p><h2><a href="${e(link(stoneListingPath(item.id)!, input))}">${e(item.title)}</a></h2><div class="price-block"><p class="price-label">${e(slabPrice.primaryLabel)}</p><p class="price">${e(slabPrice.primaryPrice)}</p>${slabPrice.secondaryPrice ? `<p class="price-secondary">${e(slabPrice.secondaryPrice)}</p>` : ""}<p class="price-note">${e(note)}</p></div><div class="actions"><a class="button" href="${e(link(stoneInquiryPath(item.id, "availability")!, input))}">Ask TradeScout about availability</a><a class="button secondary" href="${e(link(stoneInquiryPath(item.id, "callback")!, input))}">Request a call</a></div></div></article>`;
  });
  const firstCards = cardMarkup.slice(0, 12).join("");
  const moreGroups = Array.from({ length: Math.ceil(Math.max(0, cardMarkup.length - 12) / 12) }, (_, group) => {
    const start = 12 + group * 12;
    const end = Math.min(start + 12, cardMarkup.length);
    const label = start + 1 === end ? `Show stone ${end} of ${cardMarkup.length}`
      : `Show stones ${start + 1}–${end} of ${cardMarkup.length}`;
    return `<details class="stone-more"><summary>${e(label)}</summary><section class="grid" aria-label="Stone listings ${start + 1} through ${end}">${cardMarkup.slice(start, end).join("")}</section></details>`;
  }).join("");
  const areaSummary = [input.market?.city, input.market?.state].filter(Boolean).join(", ") || "your selected area";
  const areaIsSelected = input.audience.allowed && Boolean(input.market?.state);
  const areaFields = `<label>State<select aria-label="State" required name="audienceState" autocomplete="address-level1"><option value="">Choose state</option>${stateOptions}</select></label>
<label>City (required for Florida)<input name="audienceCity" maxlength="160" autocomplete="address-level2" value="${e(input.market?.city || "")}"></label>`;
  const searchArea = areaIsSelected
    ? `<input type="hidden" name="audienceState" value="${e(input.market?.state)}"><input type="hidden" name="audienceCity" value="${e(input.market?.city || "")}">`
    : areaFields;
  const changeArea = areaIsSelected ? `<details class="area-change"><summary><span>Showing ${e(areaSummary)}</span><span>Change area</span></summary>
<form class="area-form" method="get" action="/exchange/stone">${hiddenTags}<input type="hidden" name="audienceCountry" value="US"><input type="hidden" name="q" value="${e(input.search || "")}">
${areaFields}<button type="submit">Show listings for this area</button></form></details>` : "";
  const stoneWord = visible.length === 1 ? "stone" : "stones";
  const status = !input.publicationReady ? "The stone catalog is being prepared. No public selling prices have been released here yet."
    : visible.length > 12 ? `${visible.length} ${stoneWord} for ${areaSummary}. First 12 shown; open more groups below.`
    : visible.length ? `${visible.length} ${stoneWord} for ${areaSummary}. No account is needed to view prices.`
    : input.audience.reason === "pensacola" || input.audience.reason === "outside_us" ? "Stone listings are not displayed for your selected area."
    : input.audience.allowed ? "No matching stone listings are currently published for this area."
    : "Choose your state to see published listings. For Florida, include your city. No sign-in is required to browse prices.";
  const schema = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Stone Slabs | TradeScout Exchange", url: ORIGIN + "/exchange/stone", description, publisher: { "@type": "Organization", name: "TradeScout", url: ORIGIN }, ...(visible.length ? { mainEntity: { "@type": "ItemList", numberOfItems: visible.length, itemListElement: visible.map((item, position) => ({ "@type": "ListItem", position: position + 1, name: item.title, url: ORIGIN + stoneListingPath(item.id) })) } } : {}) };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stone Slabs | TradeScout Exchange</title><meta name="description" content="${e(description)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${ORIGIN}/exchange/stone"><meta property="og:type" content="website"><meta property="og:site_name" content="TradeScout"><meta property="og:title" content="Stone Slabs | TradeScout Exchange"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${ORIGIN}/exchange/stone"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, String.fromCharCode(92) + "u003c")}</script><style>
*{box-sizing:border-box}body{font:17px/1.55 system-ui,sans-serif;margin:0;background:#101820;color:#edf2f6}main{max-width:1220px;margin:auto;padding:24px}a{color:inherit}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #f49b32;outline-offset:4px}.hero{max-width:790px;padding:30px 0}h1{font-size:clamp(2rem,5vw,3.3rem);line-height:1.1;margin:18px 0}h2{font-size:1.2rem;line-height:1.3}h2 a{text-decoration:none}.hero p{font-size:1.1rem}.eyebrow,.seller{font-size:.85rem;text-transform:uppercase;letter-spacing:.06em;color:#f4b25a}.market{border:1px solid #526171;border-radius:14px;padding:18px;max-width:900px}.market summary{cursor:pointer;min-height:44px;display:flex;align-items:center}.market form{display:flex;gap:14px;align-items:end;flex-wrap:wrap}label{display:grid;gap:6px;font-size:.95rem}input,select,button,.button{font:inherit;padding:12px;border-radius:8px;min-height:48px}input,select{background:#f8fafb;color:#101820;border:1px solid #687684;max-width:100%}button,.button{background:#f49b32;color:#101820;border:0;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;text-align:center;font-weight:650}.secondary{background:transparent;color:#edf2f6;border:1px solid #8c9cac}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:22px;margin:28px 0}.stone-card{background:#1b2936;border:1px solid #425161;border-radius:14px;overflow:hidden}.stone-card img{width:100%;height:240px;object-fit:contain;background:#15212c;display:block}.card-body{padding:20px}.price-block{border-top:1px solid #526171;border-bottom:1px solid #526171;margin:16px 0;padding:13px 0}.price-label{font-size:.78rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#f4b25a;margin:0}.price{font-size:1.65rem;font-weight:750;line-height:1.2;margin:5px 0 2px}.price-secondary{font-size:.92rem;color:#edf2f6;margin:3px 0 0}.price-note{font-size:.82rem;color:#bac7d2;margin:8px 0 0}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.actions a{flex:1;min-width:130px}.guide{padding:28px 0;max-width:900px}.guide p{max-width:75ch}footer{padding:24px 0;border-top:1px solid #526171;font-size:.9rem}@media(max-width:480px){main{padding:16px}.market form,label{width:100%}.market button{width:100%}.hero{padding-top:18px}}
.market{max-width:none}.market form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;align-items:end;gap:12px}.market label{min-width:0}.market input,.market select{width:100%}.market button{white-space:nowrap}.result-head{margin:22px 0 8px}.result-head p{margin:4px 0}.result-count{font-weight:650;color:#edf2f6}.material-terms{font-size:.88rem;color:#bac7d2}.stone-card img{height:190px}.card-body{padding:16px}.card-body h2{margin:8px 0 0}.price-block{margin:12px 0;padding:11px 0}.price-note{margin-top:6px}.actions{margin-top:12px}.stone-more{border:1px solid #526171;border-radius:10px;margin:12px 0;overflow:hidden}.stone-more summary{cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:12px 16px;font-weight:700;list-style:none}.stone-more summary::-webkit-details-marker{display:none}.stone-more summary::after{content:"+";font-size:1.4rem;line-height:1}.stone-more[open] summary::after{content:"−"}.stone-more .grid{margin:0;padding:16px}@media(max-width:700px){.market form{grid-template-columns:1fr}.market button{width:100%}.grid{gap:14px;margin:16px 0}.stone-card img{height:180px}.stone-more .grid{padding:12px}}
@media(max-width:700px){.hero{padding:12px 0}.hero h1{font-size:1.95rem;margin:8px 0}.hero p{font-size:.95rem;margin:6px 0}.hero .eyebrow{font-size:.77rem}.market{padding:14px}.market h2{font-size:1.15rem;margin:0 0 10px}.market form{gap:8px}.market label{font-size:.86rem;gap:4px}.market input,.market select,.market button{min-height:44px;padding:9px}.result-head{margin:12px 0 6px}.result-head p{margin:3px 0}}
.stone-card .actions .button{font-size:.9rem;padding:10px 8px}.market .stone-search{grid-template-columns:minmax(0,1fr) auto}.market .stone-search.needs-area{grid-template-columns:repeat(3,minmax(0,1fr)) auto}.market .area-change{border-top:1px solid #526171;margin-top:12px;padding-top:6px}.area-change summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;cursor:pointer;list-style:none;font-size:.88rem}.area-change summary:focus-visible,.stone-more summary:focus-visible{outline:3px solid #f49b32;outline-offset:4px}.area-change summary::-webkit-details-marker{display:none}.area-change summary span:last-child{color:#f4b25a;text-decoration:underline;text-underline-offset:3px;font-weight:700;white-space:nowrap}.market .area-form{grid-template-columns:repeat(2,minmax(0,1fr)) auto;margin-top:10px}
@media(max-width:700px){.market .stone-search,.market .stone-search.needs-area,.market .area-form{grid-template-columns:1fr}.area-change summary{font-size:.82rem}}
</style></head><body><main>
<nav aria-label="Breadcrumb"><a href="/exchange">TradeScout Exchange</a> / Stone slabs</nav>
<header class="hero"><p class="eyebrow">TradeScout material sales</p><h1>Find the stone.<br>See the full slab material price.</h1><p>Compare slab photos and estimated full slab material prices, then check availability or request a call about the exact selection. Your inquiry goes to TradeScout.</p></header>
<section class="market" aria-labelledby="market-title"><h2 id="market-title">Find your stone</h2>
<form class="stone-search${areaIsSelected ? "" : " needs-area"}" method="get" action="/exchange/stone">${hiddenTags}<input type="hidden" name="audienceCountry" value="US">
<label>Stone name or material<input type="search" name="q" maxlength="160" value="${e(input.search || "")}" placeholder="Search stone selections"></label>
${searchArea}<button type="submit">Search stones</button></form>${changeArea}</section>
<div class="result-head"><p class="result-count" role="status">${e(status)}</p>${visible.length ? "<p class=\"material-terms\">Material prices only. Delivery, fabrication and installation are quoted separately.</p>" : ""}</div>
<section class="grid" aria-label="Published stone listings">${firstCards}</section>${moreGroups}
<section class="guide"><h2>What the displayed price includes</h2><p>The full slab material estimate uses the published per-square-foot rate and recorded reference dimensions. Where reference sizes vary, we show a range. Where dimensions are missing, TradeScout must confirm the slab total. The per-square-foot figure is the published material rate. Delivery, fabrication and installation are separate unless a written TradeScout quote says otherwise.</p><h2>Before you purchase</h2><p>Use the listing to ask about the exact slab, dimensions, thickness, finish and available quantity. Recorded reference sizes are not a promise that every slab has those measurements. Confirm your selection and delivery charges with TradeScout before purchase.</p><h2>Keep your selection attached</h2><p>Choose “Ask TradeScout about availability” or “Request a call” on the stone you are considering. The inquiry begins on that listing and uses TradeScout’s existing protected contact flow.</p></section>
<footer>Sold by TradeScout. <a href="/exchange/building-materials">Browse Building Materials &amp; Surfaces</a></footer></main></body></html>`;
  return { html, robots };
}
