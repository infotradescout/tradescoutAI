// Lists Printful store products and their catalog variant IDs.
// Usage (PowerShell):
//   $env:PRINTFUL_API_KEY="..."; node scripts/printful-list-variants.mjs
//
// You want the `variant_id` values (catalog variants) to configure ScoutFitters tiers.

const apiKey = String(process.env.PRINTFUL_API_KEY || "").trim();
if (!apiKey) {
  console.error("Missing PRINTFUL_API_KEY in env.");
  process.exitCode = 1;
  return;
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
  Accept: "application/json",
};

async function fetchJson(url) {
  const resp = await fetch(url, { headers });
  const text = await resp.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // keep null
  }
  if (!resp.ok) {
    const msg = json?.error?.message || json?.message || `HTTP ${resp.status}`;
    throw new Error(`${msg} :: ${text.slice(0, 400)}`);
  }
  return json;
}

async function main() {
  const base = "https://api.printful.com";
  const limit = 100;
  let offset = 0;
  const storeProducts = [];

  while (true) {
    const page = await fetchJson(`${base}/store/products?limit=${limit}&offset=${offset}`);
    const rows = Array.isArray(page?.result) ? page.result : [];
    storeProducts.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }

  if (!storeProducts.length) {
    console.log("No store products found. Sync products in Printful first.");
    return;
  }

  for (const p of storeProducts) {
    const id = p?.id;
    if (!id) continue;
    const detail = await fetchJson(`${base}/store/products/${id}`);
    const syncProduct = detail?.result?.sync_product || {};
    const name = syncProduct?.name || syncProduct?.external_id || `store_product:${id}`;
    console.log(`\n${name}`);

    const variants = Array.isArray(detail?.result?.sync_variants) ? detail.result.sync_variants : [];
    for (const v of variants) {
      const variantId = v?.variant_id;
      const syncVariantId = v?.id;
      const vName = v?.name || v?.external_id || "";
      const size = v?.size || v?.product?.size || "";
      const color = v?.color || v?.product?.color || "";
      console.log(
        `  - variant_id=${variantId} sync_variant_id=${syncVariantId} size=${size} color=${color} ${vName}`.trimEnd()
      );
    }
  }
}

main().catch((err) => {
  console.error("Failed to list variants:", err?.message || err);
  process.exitCode = 1;
});

