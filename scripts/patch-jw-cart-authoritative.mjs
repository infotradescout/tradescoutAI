import fs from "node:fs";

function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first < 0 || source.indexOf(oldText, first + 1) >= 0) {
    throw new Error(`${label}: expected exactly one match`);
  }
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}

const pricingPath = "client/src/features/jw-stone/JwStoneMemberPricing.tsx";
let pricing = fs.readFileSync(pricingPath, "utf8");

pricing = replaceOnce(
  pricing,
  `type JwStoneCartItem = Readonly<{\n  id: string;\n  stoneName: string;`,
  `type JwStoneCartItem = Readonly<{\n  id: string;\n  inventoryPublicId: string | null;\n  availableQuantity: number | null;\n  stoneName: string;`,
  "cart authority fields"
);
pricing = replaceOnce(
  pricing,
  `const JW_STONE_CART_STORAGE_PREFIX = "tradescout:jw-stone:member-cart:v1:";`,
  `const JW_STONE_CART_STORAGE_PREFIX = "tradescout:jw-stone:member-cart:v2:";`,
  "cart storage version"
);
pricing = replaceOnce(
  pricing,
  `    item.id.length <= 500 &&\n    typeof item.stoneName === "string" &&`,
  `    item.id.length <= 500 &&\n    (item.inventoryPublicId === null ||\n      (typeof item.inventoryPublicId === "string" && /^stone_[a-f0-9]{32}$/.test(item.inventoryPublicId))) &&\n    (item.availableQuantity === null ||\n      (Number.isInteger(item.availableQuantity) && Number(item.availableQuantity) >= 1 && Number(item.availableQuantity) <= 999)) &&\n    typeof item.stoneName === "string" &&`,
  "cart authority validation"
);
pricing = replaceOnce(
  pricing,
  `            ? { ...entry, quantity: Math.min(999, entry.quantity + 1) }`,
  `            ? { ...entry, quantity: Math.min(entry.availableQuantity ?? 999, 999, entry.quantity + 1) }`,
  "cart add cap"
);
pricing = replaceOnce(
  pricing,
  `            item.id === id ? { ...item, quantity: Math.min(999, quantity) } : item`,
  `            item.id === id\n              ? { ...item, quantity: Math.min(item.availableQuantity ?? 999, 999, quantity) }\n              : item`,
  "cart quantity cap"
);
pricing = replaceOnce(
  pricing,
  `  const [loadedCartViewer, setLoadedCartViewer] = useState<string | null>(null);`,
  `  const [loadedCartViewer, setLoadedCartViewer] = useState<string | null>(null);\n  const [cartReview, setCartReview] = useState<{\n    readyForCheckout?: boolean;\n    subtotalCents?: number | null;\n    message?: string;\n  } | null>(null);\n  const [reviewingCart, setReviewingCart] = useState(false);`,
  "cart review state"
);
pricing = replaceOnce(
  pricing,
  `  const value = useMemo<JwStoneMemberPricingContextValue>(() => {`,
  `  useEffect(() => {\n    setCartReview(null);\n  }, [cart]);\n\n  const reviewCart = useCallback(async () => {\n    if (!cart.length || cart.some((item) => !item.inventoryPublicId)) {\n      setCartReview({\n        readyForCheckout: false,\n        message: "Choose a current-stock slab for every cart item before order review.",\n      });\n      return;\n    }\n    setReviewingCart(true);\n    try {\n      const review = (await apiRequest("POST", "/api/u/jw-stone/member-pricing/cart-review", {\n        lines: cart.map((item) => ({\n          inventoryPublicId: item.inventoryPublicId,\n          quantity: item.quantity,\n        })),\n      })) as { readyForCheckout?: boolean; subtotalCents?: number | null };\n      setCartReview(review);\n    } catch {\n      setCartReview({\n        readyForCheckout: false,\n        message: "Current availability could not be confirmed. No order was placed.",\n      });\n    } finally {\n      setReviewingCart(false);\n    }\n  }, [cart]);\n\n  const value = useMemo<JwStoneMemberPricingContextValue>(() => {`,
  "cart review callback"
);
pricing = replaceOnce(
  pricing,
  `                                <h3 className="font-semibold text-[var(--jw-ink)]">{item.stoneName}</h3>`,
  `                                <h3 className="font-semibold text-[var(--jw-ink)]">{item.stoneName}</h3>\n                                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--jw-accent)]">\n                                  {item.inventoryPublicId ? "Current stock" : "Selection only"}\n                                </p>`,
  "cart authority badge"
);
pricing = replaceOnce(
  pricing,
  `                  <button\n                    type="button"\n                    disabled={cart.length === 0}\n                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center bg-[var(--jw-accent)] px-4 py-3 text-sm font-semibold text-[var(--jw-on-accent)] disabled:cursor-not-allowed disabled:opacity-45"\n                    onClick={() => setCartOpen(false)}\n                  >\n                    Continue shopping\n                  </button>`,
  `                  {cartReview ? (\n                    <div className="mt-3 border border-[var(--jw-border)] bg-white p-3 text-sm">\n                      {cartReview.readyForCheckout && cartReview.subtotalCents != null ? (\n                        <p className="font-semibold text-[var(--jw-ink)]">\n                          Current material subtotal: {formatCents(cartReview.subtotalCents)}\n                        </p>\n                      ) : (\n                        <p className="text-[var(--jw-muted)]">\n                          {cartReview.message || "One or more slabs need attention before checkout."}\n                        </p>\n                      )}\n                    </div>\n                  ) : null}\n                  <button\n                    type="button"\n                    disabled={cart.length === 0 || reviewingCart}\n                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center bg-[var(--jw-accent)] px-4 py-3 text-sm font-semibold text-[var(--jw-on-accent)] disabled:cursor-not-allowed disabled:opacity-45"\n                    onClick={() => void reviewCart()}\n                  >\n                    {reviewingCart ? "Checking current stock…" : "Review availability"}\n                  </button>\n                  <button\n                    type="button"\n                    className="mt-2 inline-flex min-h-11 w-full items-center justify-center border border-[var(--jw-border)] px-4 py-2 text-sm font-semibold text-[var(--jw-ink)]"\n                    onClick={() => setCartOpen(false)}\n                  >\n                    Continue shopping\n                  </button>`,
  "cart review controls"
);
pricing = replaceOnce(
  pricing,
  `  slabDimensions,\n  presentation = "card",\n}: {\n  stoneName: string | null | undefined;\n  slabDimensions?: JwStoneSlabDimensionsInput;\n  presentation?: "card" | "detail" | "inventory";`,
  `  slabDimensions,\n  inventoryPublicId = null,\n  availableQuantity = null,\n  presentation = "card",\n}: {\n  stoneName: string | null | undefined;\n  slabDimensions?: JwStoneSlabDimensionsInput;\n  inventoryPublicId?: string | null;\n  availableQuantity?: number | null;\n  presentation?: "card" | "detail" | "inventory";`,
  "price display authority props"
);
pricing = replaceOnce(
  pricing,
  `              id: cartItemId(price.stoneKey, slabDimensions, slabEstimate),\n              stoneName: price.stoneName,`,
  `              id: inventoryPublicId || cartItemId(price.stoneKey, slabDimensions, slabEstimate),\n              inventoryPublicId,\n              availableQuantity:\n                availableQuantity == null ? null : Math.max(1, Math.floor(availableQuantity)),\n              stoneName: price.stoneName,`,
  "authoritative cart draft"
);
fs.writeFileSync(pricingPath, pricing);

const inventoryPath = "client/src/features/jw-stone/CurrentInventorySection.tsx";
let inventory = fs.readFileSync(inventoryPath, "utf8");
inventory = replaceOnce(
  inventory,
  `                  <JwStoneMemberPriceDisplay\n                    stoneName={item.materialName}\n                    slabDimensions={item.dimensions}\n                    presentation="inventory"\n                  />`,
  `                  <JwStoneMemberPriceDisplay\n                    stoneName={item.materialName}\n                    slabDimensions={item.dimensions}\n                    inventoryPublicId={item.id}\n                    availableQuantity={Math.floor(item.quantity)}\n                    presentation="inventory"\n                  />`,
  "current inventory cart identity"
);
fs.writeFileSync(inventoryPath, inventory);

console.log("JW_CART_AUTHORITY_PATCH_OK");
