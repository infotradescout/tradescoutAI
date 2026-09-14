import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PackageCheck, Sparkles, Trash2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { JW_STONE_NAMED_CATALOG } from "@/features/jw-stone/catalog";
import {
  isStoneInventoryConfirmationFresh,
  type PublicStoneInventoryResponse,
  type SellerStoneInventoryItem,
  type StoneInventoryManageCapabilities,
} from "@shared/stoneInventory";

type Props = {
  open: boolean;
  profileSlug: string;
  onClose: () => void;
};

type SellerStoneInventoryResponse = Omit<PublicStoneInventoryResponse, "items"> & {
  items: readonly SellerStoneInventoryItem[];
  capabilities: StoneInventoryManageCapabilities;
};

type NewArrivalManageResponse = Readonly<{
  profileSlug: string;
  generatedAt: string;
  itemIds: readonly string[];
}>;

const materialOptions = JW_STONE_NAMED_CATALOG.map((stone) => ({
  slug: stone.shareSlug!,
  name: stone.displayName!,
  category: stone.materialLabel || "Material unconfirmed",
  categorySlug: stone.materialId || "unconfirmed",
  images: stone.images,
})).sort((left, right) => left.name.localeCompare(right.name));

function assetKindLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function JwStoneCurrentInventoryManager({ open, profileSlug, onClose }: Props) {
  const { toast } = useToast();
  const notify = (notification: Parameters<typeof toast>[0]) =>
    toast({
      ...notification,
      className:
        notification.variant === "destructive"
          ? "border-red-400 bg-stone-950 text-white"
          : "border-stone-600 bg-stone-950 text-white",
    });
  const [items, setItems] = useState<readonly SellerStoneInventoryItem[]>([]);
  const [newArrivalIds, setNewArrivalIds] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [capabilities, setCapabilities] = useState<StoneInventoryManageCapabilities>({
    write: false,
    publish: false,
  });
  const [editing, setEditing] = useState<SellerStoneInventoryItem | null>(null);
  const [dimensionUnit, setDimensionUnit] = useState<"in" | "mm" | "">("in");
  const requestEpoch = useRef(0);
  const busy = useRef(false);
  const editorRef = useRef<HTMLFieldSetElement>(null);
  const [selectedSlug, setSelectedSlug] = useState(materialOptions[0]?.slug || "");
  const [assetKind, setAssetKind] = useState("bundle");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("slabs");
  const [length, setLength] = useState("");
  const [height, setHeight] = useState("");
  const [thickness, setThickness] = useState("");
  const [finishes, setFinishes] = useState<Array<{ finish: string; quantity: string }>>([]);
  const [locationRef, setLocationRef] = useState("");
  const [recheckDays, setRecheckDays] = useState("30");

  const selected = useMemo(
    () => materialOptions.find((stone) => stone.slug === selectedSlug) || materialOptions[0],
    [selectedSlug]
  );

  const load = useCallback(async () => {
    if (!open) return;
    const epoch = ++requestEpoch.current;
    setLoading(true);
    setLoadError("");
    setCapabilities({ write: false, publish: false });
    try {
      const [inventoryResponse, newArrivalResponse] = await Promise.all([
        apiRequest(
          "GET",
          `/api/u/${encodeURIComponent(profileSlug)}/stone-inventory/manage`
        ) as Promise<SellerStoneInventoryResponse>,
        apiRequest(
          "GET",
          `/api/u/${encodeURIComponent(profileSlug)}/stone-inventory/new-arrivals/manage`
        ) as Promise<NewArrivalManageResponse>,
      ]);
      if (epoch !== requestEpoch.current) return;
      if (
        inventoryResponse.profileSlug !== profileSlug ||
        newArrivalResponse.profileSlug !== profileSlug
      ) {
        throw new Error("Inventory response does not belong to this profile");
      }
      setItems(inventoryResponse.items || []);
      setNewArrivalIds(newArrivalResponse.itemIds || []);
      setCapabilities({
        write: inventoryResponse.capabilities?.write === true,
        publish: inventoryResponse.capabilities?.publish === true,
      });
    } catch (error) {
      if (epoch !== requestEpoch.current) return;
      setItems([]);
      setNewArrivalIds([]);
      setLoadError(
        formatUserFacingErrorMessage(error, "Could not load current stock. Please try again.")
      );
    } finally {
      if (epoch === requestEpoch.current) setLoading(false);
    }
  }, [open, profileSlug]);

  useEffect(() => {
    void load();
    return () => {
      requestEpoch.current += 1;
    };
  }, [load]);

  const clearEditor = () => {
    setEditing(null);
    setQuantity("");
    setAssetKind("bundle");
    setUnit("slabs");
    setLength("");
    setHeight("");
    setThickness("");
    setDimensionUnit("in");
    setFinishes([]);
    setLocationRef("");
  };

  const editStock = (item: SellerStoneInventoryItem) => {
    if (!capabilities.write || busy.current) return;
    setEditing(item);
    setQuantity(String(item.quantity));
    setAssetKind(item.assetKind);
    setUnit(item.unit);
    setLength(item.dimensions?.length == null ? "" : String(item.dimensions.length));
    setHeight(item.dimensions?.height == null ? "" : String(item.dimensions.height));
    setThickness(item.dimensions?.thickness == null ? "" : String(item.dimensions.thickness));
    setDimensionUnit(item.dimensions?.unit || "");
    setFinishes(
      item.finishQuantities.map((entry) => ({
        finish: entry.finish,
        quantity: String(entry.slabCount),
      }))
    );
    setLocationRef(item.locationLabel || "");
    editorRef.current?.focus();
    editorRef.current?.scrollIntoView?.({ block: "nearest" });
  };

  if (!open) return null;

  const confirmStock = async () => {
    if ((!editing && !selected) || !capabilities.write || busy.current) return;

    const quantityNumber = Number(quantity);
    const days = Number(recheckDays);
    const finishQuantities = finishes.map((entry) => ({
      finish: entry.finish.trim(),
      slabCount: Number(entry.quantity),
    }));
    const optionalDimensions = [length, height, thickness].filter((value) => value.trim());
    if (
      !Number.isFinite(quantityNumber) ||
      quantityNumber <= 0 ||
      !unit.trim() ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 90 ||
      optionalDimensions.some((value) => !Number.isFinite(Number(value)) || Number(value) <= 0) ||
      finishQuantities.some(
        (entry) => !entry.finish || !Number.isFinite(entry.slabCount) || entry.slabCount <= 0
      ) ||
      finishQuantities.reduce((total, entry) => total + entry.slabCount, 0) > quantityNumber
    ) {
      notify({
        title: "Check the physical stock details",
        description:
          "Enter a positive quantity and measurements, complete each recorded finish, and choose a recheck window of 1–90 days. Finish quantities cannot exceed total stock.",
        variant: "destructive",
      });
      return;
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    busy.current = true;
    setSaving(true);
    try {
      await apiRequest(
        "POST",
        `/api/u/${encodeURIComponent(profileSlug)}/stone-inventory/current`,
        {
          ...(editing ? { publicId: editing.id } : {}),
          materialSlug: editing?.materialSlug ?? selected.slug,
          materialName: editing?.materialName ?? selected.name,
          materialFamily: editing ? editing.materialFamily || "unconfirmed" : selected.categorySlug,
          materialClass:
            editing?.materialClass ??
            (selected.categorySlug === "quartz" ? "engineered_stone" : "natural_stone"),
          assetKind,
          quantity: quantityNumber,
          unit: unit.trim() || "pieces",
          dimensions: {
            length: length ? Number(length) : null,
            height: height ? Number(height) : null,
            thickness: thickness ? Number(thickness) : null,
            unit: dimensionUnit || null,
          },
          finishQuantities,
          locationLabel: locationRef.trim() || null,
          imageUrls: editing ? [...editing.imageUrls] : selected.images.slice(0, 12),
          lastConfirmedAt: now.toISOString(),
          confirmationExpiresAt: expiresAt.toISOString(),
        }
      );
      notify({
        title: editing ? "Existing stock re-confirmed" : "Confirmed stock saved",
        description:
          "It remains private until you publish it as sale-ready. New Arrivals is a separate choice.",
      });
      clearEditor();
      await load();
    } catch (error) {
      notify({
        title: "Could not confirm stock",
        description: formatUserFacingErrorMessage(error, "Check the item details and try again."),
        variant: "destructive",
      });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const setNewArrival = async (item: SellerStoneInventoryItem, showAsNewArrival: boolean) => {
    if (!capabilities.publish || busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await apiRequest(
        "PATCH",
        `/api/u/${encodeURIComponent(profileSlug)}/stone-inventory/current/${encodeURIComponent(item.id)}/new-arrival`,
        { showAsNewArrival }
      );
      notify({
        title: showAsNewArrival ? "Added to New Arrivals" : "Removed from New Arrivals",
      });
      await load();
    } catch (error) {
      notify({
        title: "Could not change New Arrivals",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const setSaleReady = async (item: SellerStoneInventoryItem, saleReady: boolean) => {
    if (!capabilities.publish || busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      if (!saleReady && newArrivalIds.includes(item.id)) {
        await apiRequest(
          "PATCH",
          `/api/u/${encodeURIComponent(profileSlug)}/stone-inventory/current/${encodeURIComponent(item.id)}/new-arrival`,
          { showAsNewArrival: false }
        );
      }
      await apiRequest(
        "PATCH",
        `/api/u/${encodeURIComponent(profileSlug)}/stone-inventory/current/${encodeURIComponent(item.id)}/publication`,
        { saleReady }
      );
      notify({
        title: saleReady ? "Lot published as sale-ready" : "Lot returned to private inventory",
      });
      await load();
    } catch (error) {
      notify({
        title: "Could not change publication",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const retire = async (item: SellerStoneInventoryItem) => {
    if (!capabilities.write || busy.current) return;
    if (!window.confirm(`Retire ${item.materialName} (${item.passportCode}) from inventory?`)) {
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      await apiRequest(
        "DELETE",
        `/api/u/${encodeURIComponent(profileSlug)}/stone-inventory/current/${encodeURIComponent(item.id)}`
      );
      notify({ title: "Stock retired" });
      if (editing?.id === item.id) clearEditor();
      await load();
    } catch (error) {
      notify({
        title: "Could not remove stock",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      busy.current = false;
      setSaving(false);
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
            Confirm physical stock first. Publish sale-ready stock separately, then choose only real
            New Arrivals for the public profile.
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

      {loadError ? (
        <div role="alert" className="mt-4 text-sm text-red-100">
          <p>{loadError}</p>
          <button type="button" onClick={() => void load()} className="min-h-11 underline">
            Retry inventory
          </button>
        </div>
      ) : null}
      {!loading && !loadError && !capabilities.write ? (
        <p className="mt-4 text-sm text-white/75">
          Physical stock is read-only for this account.{" "}
          {capabilities.publish
            ? "You can manage publication separately."
            : "Edit and publication require their own inventory permissions."}
        </p>
      ) : null}
      {capabilities.write ? (
        <>
          <fieldset
            ref={editorRef}
            tabIndex={-1}
            disabled={saving}
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <legend className="mb-3 text-sm font-semibold">
              {editing
                ? `Edit and re-confirm ${editing.passportCode}`
                : "Confirm a new physical lot"}
            </legend>
            <label className="text-xs font-semibold text-white/80 sm:col-span-2">
              Material
              <select
                value={editing?.materialSlug ?? selectedSlug}
                disabled={Boolean(editing)}
                onChange={(event) => {
                  setSelectedSlug(event.target.value);
                  setFinishes([]);
                }}
                className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-stone-950 px-3 text-sm text-white"
              >
                {editing ? (
                  <option value={editing.materialSlug}>{editing.materialName}</option>
                ) : (
                  materialOptions.map((stone) => (
                    <option key={stone.slug} value={stone.slug}>
                      {stone.name} — {stone.category}
                    </option>
                  ))
                )}
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
            <label className="text-xs font-semibold text-white/80">
              Measurement unit
              <select
                value={dimensionUnit}
                onChange={(event) => setDimensionUnit(event.target.value as "in" | "mm" | "")}
                className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-stone-950 px-3 text-sm text-white"
              >
                <option value="">Unrecorded</option>
                <option value="in">Inches</option>
                <option value="mm">Millimeters</option>
              </select>
            </label>
            <Field label="Length" value={length} onChange={setLength} inputMode="decimal" />
            <Field label="Height" value={height} onChange={setHeight} inputMode="decimal" />
            <Field
              label="Thickness"
              value={thickness}
              onChange={setThickness}
              inputMode="decimal"
            />
            <div className="space-y-2 sm:col-span-2 lg:col-span-4">
              <p className="text-xs font-semibold text-white/80">Recorded finishes</p>
              {finishes.map((entry, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Field
                    label={`Finish ${index + 1}`}
                    value={entry.finish}
                    onChange={(value) =>
                      setFinishes((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, finish: value } : row
                        )
                      )
                    }
                  />
                  <Field
                    label={`Finish ${index + 1} quantity`}
                    value={entry.quantity}
                    inputMode="decimal"
                    onChange={(value) =>
                      setFinishes((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, quantity: value } : row
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    className="min-h-11 text-xs text-red-100 underline"
                    aria-label={`Remove finish ${index + 1}`}
                    onClick={() =>
                      setFinishes((current) => current.filter((_, rowIndex) => rowIndex !== index))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={finishes.length >= 12}
                onClick={() => setFinishes((current) => [...current, { finish: "", quantity: "" }])}
                className="min-h-11 text-xs text-amber-100 underline"
              >
                Add recorded finish
              </button>
            </div>
            <Field label="Location" value={locationRef} onChange={setLocationRef} />
            <Field
              label="Recheck in days"
              value={recheckDays}
              onChange={setRecheckDays}
              inputMode="numeric"
            />
          </fieldset>

          <p className="mt-3 text-xs text-white/65">
            Leave unrecorded dimensions blank. Saving confirms the physical stock checked today.
            Publication and New Arrivals remain separate choices.
          </p>

          <button
            type="button"
            onClick={() => void confirmStock()}
            disabled={saving || (!editing && !selected)}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black disabled:opacity-50"
          >
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            {saving
              ? "Saving…"
              : editing
                ? "Save and re-confirm this lot"
                : "Confirm current stock"}
          </button>
          {editing ? (
            <button
              type="button"
              disabled={saving}
              onClick={clearEditor}
              className="ml-3 min-h-11 text-sm underline"
            >
              Cancel edit
            </button>
          ) : null}
        </>
      ) : null}

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">
          Confirmed inventory
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-white/60">Loading…</p>
        ) : loadError ? null : items.length ? (
          <ul className="mt-3 space-y-2">
            {items.map((item) => {
              const isNewArrival = newArrivalIds.includes(item.id);
              const fresh = isStoneInventoryConfirmationFresh(item);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{item.materialName}</p>
                    <p className="mt-1 text-xs text-white/60">
                      {item.passportCode} · {item.quantity} {item.unit} ·{" "}
                      {item.isSaleReady ? "Sale-ready" : "Private draft"}
                      {isNewArrival ? " · New Arrival" : ""}
                    </p>
                    <p className="mt-1 text-xs text-white/70">
                      {fresh ? "Confirmation current" : "Re-confirmation required"} · Last checked{" "}
                      {new Date(item.lastConfirmedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {capabilities.write ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => editStock(item)}
                        className="min-h-11 rounded-lg border border-white/25 px-3 text-xs font-semibold text-white"
                      >
                        Edit / re-confirm
                      </button>
                    ) : null}
                    {capabilities.publish ? (
                      <>
                        <button
                          type="button"
                          disabled={saving || (!item.isSaleReady && !fresh)}
                          onClick={() => void setSaleReady(item, !item.isSaleReady)}
                          className="inline-flex min-h-10 items-center rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 text-xs font-semibold text-amber-100"
                        >
                          {item.isSaleReady ? "Return to private" : "Publish sale-ready"}
                        </button>
                        <button
                          type="button"
                          disabled={saving || (!isNewArrival && (!item.isSaleReady || !fresh))}
                          onClick={() => void setNewArrival(item, !isNewArrival)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Sparkles className="h-4 w-4" aria-hidden="true" />
                          {item.isSaleReady
                            ? isNewArrival
                              ? "Remove from New Arrivals"
                              : "Show in New Arrivals"
                            : "Publish sale-ready first"}
                        </button>
                      </>
                    ) : null}
                    {capabilities.write ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void retire(item)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-300/25 bg-red-500/10 px-3 text-xs font-semibold text-red-100"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Retire
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
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
