import { useCallback, useEffect, useMemo, useState } from "react";
import { PackageCheck, Trash2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";
import type {
  PublicStoneInventoryResponse,
  SellerStoneInventoryItem,
} from "@shared/stoneInventory";

type Props = {
  open: boolean;
  profileSlug: string;
  onClose: () => void;
};

type SellerStoneInventoryResponse = Omit<PublicStoneInventoryResponse, "items"> & {
  items: readonly SellerStoneInventoryItem[];
};

const materialOptions = JW_STONE_INVENTORY_CATEGORIES.flatMap((category) =>
  category.stones.map((stone) => ({
    slug: stone.slug,
    name: stone.displayName || stone.name,
    category: category.category,
    categorySlug: category.categorySlug,
    images: stone.images,
    finishes: stone.finishes || [],
  }))
)
  .filter((stone) => Boolean(stone.name))
  .sort((left, right) => left.name.localeCompare(right.name));

function assetKindLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function JwStoneCurrentInventoryManager({ open, profileSlug, onClose }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<readonly SellerStoneInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(materialOptions[0]?.slug || "");
  const [assetKind, setAssetKind] = useState("bundle");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("slabs");
  const [length, setLength] = useState("");
  const [height, setHeight] = useState("");
  const [thickness, setThickness] = useState("");
  const [finish, setFinish] = useState("");
  const [finishQuantity, setFinishQuantity] = useState("");
  const [locationRef, setLocationRef] = useState("JW Stone — Pensacola");
  const [recheckDays, setRecheckDays] = useState("30");

  const selected = useMemo(
    () => materialOptions.find((stone) => stone.slug === selectedSlug) || materialOptions[0],
    [selectedSlug]
  );

  useEffect(() => {
    if (!selected) return;
    if (!finish && selected.finishes.length === 1) setFinish(selected.finishes[0]);
  }, [finish, selected]);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const response = (await apiRequest(
        "GET",
        `/api/u/${encodeURIComponent(profileSlug)}/stone-inventory/manage`
      )) as SellerStoneInventoryResponse;
      setItems(response.items || []);
    } catch (error) {
      toast({
        title: "Could not load current stock",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [open, profileSlug, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!open) return null;

  const confirmStock = async () => {
    if (!selected) return;

    const quantityNumber = Number(quantity);
    const knownFinishQuantity = Number(finishQuantity);
    const days = Math.max(1, Math.min(90, Math.floor(Number(recheckDays) || 30)));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    setSaving(true);
    try {
      await apiRequest(
        "POST",
        `/api/u/${encodeURIComponent(profileSlug)}/stone-inventory/current`,
        {
          materialSlug: selected.slug,
          materialName: selected.name,
          materialFamily: selected.categorySlug,
          materialClass: selected.categorySlug === "quartz" ? "engineered_stone" : "natural_stone",
          assetKind,
          quantity: quantityNumber,
          unit: unit.trim() || "pieces",
          dimensions: {
            length: length ? Number(length) : null,
            height: height ? Number(height) : null,
            thickness: thickness ? Number(thickness) : null,
            unit: "in",
          },
          finishQuantities:
            finish.trim() && Number.isFinite(knownFinishQuantity) && knownFinishQuantity > 0
              ? [{ finish: finish.trim(), slabCount: knownFinishQuantity }]
              : [],
          locationLabel: locationRef.trim() || null,
          imageUrls: selected.images.slice(0, 12),
          lastConfirmedAt: now.toISOString(),
          confirmationExpiresAt: expiresAt.toISOString(),
        }
      );
      toast({
        title: "Confirmed stock saved",
        description: "It remains private until you explicitly publish it as sale-ready.",
      });
      setQuantity("1");
      setFinishQuantity("");
      await load();
    } catch (error) {
      toast({
        title: "Could not confirm stock",
        description: formatUserFacingErrorMessage(error, "Check the item details and try again."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const setSaleReady = async (item: SellerStoneInventoryItem, saleReady: boolean) => {
    try {
      await apiRequest(
        "PATCH",
        `/api/u/${encodeURIComponent(profileSlug)}/stone-inventory/current/${encodeURIComponent(item.id)}/publication`,
        { saleReady }
      );
      toast({
        title: saleReady ? "Lot published as sale-ready" : "Lot returned to private inventory",
      });
      await load();
    } catch (error) {
      toast({
        title: "Could not change publication",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const retire = async (item: SellerStoneInventoryItem) => {
    if (!window.confirm(`Retire ${item.materialName} (${item.passportCode}) from inventory?`)) {
      return;
    }
    try {
      await apiRequest(
        "DELETE",
        `/api/u/${encodeURIComponent(profileSlug)}/stone-inventory/current/${encodeURIComponent(item.id)}`
      );
      toast({ title: "Stock retired" });
      await load();
    } catch (error) {
      toast({
        title: "Could not remove stock",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className="max-h-[75vh] overflow-y-auto rounded-xl border border-white/10 bg-black/45 p-3 sm:p-4"
      data-testid="jw-current-inventory-manager"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">Current Inventory</p>
          <p className="mt-1 text-xs text-white/65">
            Save only physical stock you have confirmed. Publishing it as sale-ready is a separate
            step.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close current inventory manager"
          onClick={onClose}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-white/80 sm:col-span-2">
          Material
          <select
            value={selectedSlug}
            onChange={(event) => {
              setSelectedSlug(event.target.value);
              setFinish("");
            }}
            className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-stone-950 px-3 text-sm text-white"
          >
            {materialOptions.map((stone) => (
              <option key={stone.slug} value={stone.slug}>
                {stone.name} — {stone.category}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-white/80">
          Physical type
          <select
            value={assetKind}
            onChange={(event) => setAssetKind(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-stone-950 px-3 text-sm text-white"
          >
            {["slab", "bundle", "block", "container", "a_frame", "piece"].map((value) => (
              <option key={value} value={value}>
                {assetKindLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <Field label="Quantity" value={quantity} onChange={setQuantity} inputMode="decimal" />
        <Field label="Unit" value={unit} onChange={setUnit} placeholder="slabs" />
        <Field label="Length (in)" value={length} onChange={setLength} inputMode="decimal" />
        <Field label="Height (in)" value={height} onChange={setHeight} inputMode="decimal" />
        <Field
          label="Thickness (in)"
          value={thickness}
          onChange={setThickness}
          inputMode="decimal"
        />
        <Field label="Finish" value={finish} onChange={setFinish} placeholder="Polished" />
        <Field
          label="Known finish quantity"
          value={finishQuantity}
          onChange={setFinishQuantity}
          inputMode="decimal"
        />
        <Field label="Location" value={locationRef} onChange={setLocationRef} />
        <Field
          label="Recheck in days"
          value={recheckDays}
          onChange={setRecheckDays}
          inputMode="numeric"
        />
      </div>

      <button
        type="button"
        onClick={() => void confirmStock()}
        disabled={saving || !selected}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black disabled:opacity-50"
      >
        <PackageCheck className="h-4 w-4" aria-hidden="true" />
        {saving ? "Saving…" : "Confirm current stock"}
      </button>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">
          Confirmed inventory
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-white/60">Loading…</p>
        ) : items.length ? (
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{item.materialName}</p>
                  <p className="mt-1 text-xs text-white/60">
                    {item.passportCode} · {item.quantity} {item.unit} ·{" "}
                    {item.isSaleReady ? "Sale-ready" : "Private draft"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void setSaleReady(item, !item.isSaleReady)}
                    className="inline-flex min-h-10 items-center rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 text-xs font-semibold text-amber-100"
                  >
                    {item.isSaleReady ? "Return to private" : "Publish sale-ready"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void retire(item)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-300/25 bg-red-500/10 px-3 text-xs font-semibold text-red-100"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Retire
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-white/60">No physical stock has been confirmed yet.</p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <label className="text-xs font-semibold text-white/80">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-stone-950 px-3 text-sm text-white placeholder:text-white/35"
      />
    </label>
  );
}
