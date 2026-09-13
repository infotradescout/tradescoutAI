import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { uploadObject } from "@/lib/objectUpload";
import {
  EXCHANGE_BATCH_LIMITS,
  EXCHANGE_BATCH_TEMPLATE,
  exchangeCsvCell,
  parseExchangeCsv,
  photoPath,
  prepareExchangeBatch,
  type BatchCategory,
} from "@shared/exchangeBatchImport";
import { prepareDetailedExchangeBatch } from "@shared/exchangeBatchDetails";
import {
  runRecoverableExchangeBatch,
  sha256ImportBytes,
  type ImportResult,
  type ImportProgress,
} from "@shared/exchangeBatchRecovery";
import {
  getExchangeCategorySlugFromMarketplaceCategoryName,
  getExchangePhotoMinimum,
  SELL_CATEGORY_FIELDS,
  validateExchangeCategoryListing,
} from "@shared/exchangeListingRules";

function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const toSpecColumn = (key: string) =>
  `spec_${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`;
const phaseLabels: Record<ImportProgress["phase"], string> = {
  checking: "Checking saved listings",
  hashing: "Checking photo contents",
  uploading: "Uploading photos",
  submitting: "Submitting listing",
  recovering: "Checking whether the listing was saved",
};

export default function MarketplaceBatchImport({
  onBusyChange,
}: {
  onBusyChange?: (busy: boolean) => void;
}) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const sellerId = String(user?.id || "");
  const activeSeller = useRef(sellerId);
  activeSeller.current = sellerId;
  const mounted = useRef(true);
  const [csv, setCsv] = useState("");
  const [csvName, setCsvName] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ignoredUnused, setIgnoredUnused] = useState(false);
  const [results, setResults] = useState<Record<string, ImportResult>>({});
  const [uploaded, setUploaded] = useState(0);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [templateCategory, setTemplateCategory] = useState("");
  const stop = useRef(false);
  const inFlight = useRef(false);
  const selectionVersion = useRef(0);
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch,
  } = useQuery<BatchCategory[]>({ queryKey: ["/api/marketplace/categories"], retry: false });
  const preview = useMemo(
    () =>
      prepareDetailedExchangeBatch(csv, photos, categories, {
        parseCsv: parseExchangeCsv,
        prepare: prepareExchangeBatch,
        categorySlug: getExchangeCategorySlugFromMarketplaceCategoryName,
        validate: validateExchangeCategoryListing,
      }),
    [csv, photos, categories]
  );
  const issueCount =
    preview.errors.length + preview.rows.reduce((sum, row) => sum + row.errors.length, 0);
  const ready = Boolean(
    csv && preview.rows.length && !issueCount && (!preview.unusedPhotos.length || ignoredUnused)
  );

  useEffect(() => {
    const imageUrls = photos.map((photo) =>
      /\.(jpe?g|png|webp)$/i.test(photo.name) ? URL.createObjectURL(photo) : ""
    );
    setUrls(imageUrls);
    return () =>
      imageUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
  }, [photos]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop.current = true;
    };
  }, []);
  useEffect(() => {
    selectionVersion.current++;
    setReading(false);
    setIgnoredUnused(false);
    setUploaded(0);
    setResults({});
    setError("");
    setCsv("");
    setCsvName("");
    setPhotos([]);
    // A run also checks activeSeller after every awaited request.
  }, [sellerId]);
  useEffect(() => {
    if (!busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [busy]);

  async function selectFiles(files: File[]) {
    if (inFlight.current) return;
    const version = ++selectionVersion.current;
    setError("");
    setReading(true);
    setIgnoredUnused(false);
    setResults({});
    try {
      const sheets = files.filter((file) => /\.csv$/i.test(file.name));
      const selectedPhotos = files.filter((file) => !/\.csv$/i.test(file.name));
      if (sheets.length > 1) throw new Error("Choose only one CSV per batch.");
      if (sheets[0]?.size > EXCHANGE_BATCH_LIMITS.csvBytes)
        throw new Error("CSV must be 1 MB or smaller.");
      if (
        selectedPhotos.length > 800 ||
        selectedPhotos.reduce((sum, file) => sum + file.size, 0) >
          EXCHANGE_BATCH_LIMITS.totalImageBytes
      )
        throw new Error("Select at most 800 photos totaling no more than 500 MB.");
      const text = sheets[0] ? await sheets[0].text() : null;
      if (version !== selectionVersion.current || !mounted.current) return;
      if (text !== null) {
        setCsv(text);
        setCsvName(sheets[0].name);
      }
      if (selectedPhotos.length) setPhotos(selectedPhotos);
    } catch (cause) {
      if (version === selectionVersion.current && mounted.current) {
        setCsv("");
        setCsvName("");
        setPhotos([]);
        setError(cause instanceof Error ? cause.message : "The selected files could not be read.");
      }
    } finally {
      if (version === selectionVersion.current && mounted.current) setReading(false);
    }
  }

  async function submit() {
    if (!ready || inFlight.current || !sellerId || !isAuthenticated) return;
    inFlight.current = true;
    stop.current = false;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    setUploaded(0);
    setResults({});
    const currentRun = () => mounted.current && activeSeller.current === sellerId;
    try {
      const run = async () =>
        runRecoverableExchangeBatch({
          rows: preview.rows,
          sellerId,
          shouldStop: () => stop.current || !currentRun(),
          loadOwnListings: () =>
            apiRequest("GET", `/api/marketplace/my-listings?_batchCheck=${Date.now()}`),
          hashPhoto: async (index) => sha256ImportBytes(await photos[index].arrayBuffer()),
          uploadPhoto: async (index) => {
            const { publicUrl } = await uploadObject(photos[index]);
            if (currentRun()) setUploaded((count) => count + 1);
            return publicUrl;
          },
          createListing: (payload) =>
            apiRequest("POST", "/api/marketplace/listings", { ...payload, sellerId }),
          onResult: (result) => {
            if (currentRun()) setResults((current) => ({ ...current, [result.key]: result }));
          },
          onProgress: (value) => {
            if (currentRun()) setProgress(value);
          },
        });
      // Web Locks prevent redundant uploads across this browser's tabs when available.
      // Database uniqueness, not this optional optimization, protects listing creation.
      if (navigator.locks) {
        await navigator.locks.request(
          `tradescout-exchange-import:${sellerId}`,
          { ifAvailable: true },
          async (lock) => {
            if (!lock)
              throw new Error("Another TradeScout tab is already importing for this account.");
            await run();
          }
        );
      } else {
        await run();
      }
    } catch (cause) {
      if (currentRun())
        setError(
          cause instanceof Error
            ? cause.message
            : "Import stopped. Check the results before continuing."
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setBusy(false);
        setProgress(null);
        onBusyChange?.(false);
      }
      void queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-listings"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/marketplace/listings"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/exchange/items"] });
    }
  }

  function template() {
    const category = categories.find((item) => item.id === templateCategory);
    const slug = getExchangeCategorySlugFromMarketplaceCategoryName(category?.name);
    const fields =
      slug && slug in SELL_CATEGORY_FIELDS
        ? SELL_CATEGORY_FIELDS[slug as keyof typeof SELL_CATEGORY_FIELDS]
        : [];
    const extra = fields.map((field) => toSpecColumn(field.key));
    if (slug === "local-food" && !extra.includes("spec_cottage_food_attestation"))
      extra.push("spec_cottage_food_attestation");
    downloadCsv(
      "tradescout-exchange-template.csv",
      EXCHANGE_BATCH_TEMPLATE.trimEnd() + (extra.length ? "," + extra.join(",") : "") + "\r\n"
    );
  }

  function exportReport() {
    const rows: unknown[][] = [
      ["csv_line", "listing_id", "status", "listing_id_created", "details"],
    ];
    for (const issue of preview.errors) rows.push(["", "", "csv_error", "", issue]);
    for (const row of preview.rows) {
      const result = results[row.key];
      rows.push([
        row.line,
        row.key,
        result?.status || (row.errors.length ? "needs_fix" : "not_submitted"),
        result?.listingId || "",
        [...row.errors, result?.message || ""].filter(Boolean).join(" | "),
      ]);
    }
    for (const name of preview.unusedPhotos) rows.push(["", "", "unmatched_photo", "", name]);
    downloadCsv(
      "tradescout-exchange-import-results.csv",
      rows.map((row) => row.map(exchangeCsvCell).join(",")).join("\r\n")
    );
  }

  if (!isAuthenticated || !sellerId)
    return (
      <div className="p-6">
        <p>Sign in to batch upload Exchange listings.</p>
        <Button asChild className="mt-3">
          <Link href="/pre-scout-setup?mode=signin">Sign in</Link>
        </Button>
      </div>
    );
  const confirmed = Object.values(results).filter(
    (result) => result.status === "submitted" || result.status === "recovered"
  ).length;
  const skipped = Object.values(results).filter((result) => result.status === "skipped").length;
  return (
    <section
      className="mx-auto max-w-5xl space-y-5 p-4 text-white"
      aria-labelledby="batch-import-title"
    >
      <header>
        <h1 id="batch-import-title" className="text-2xl font-semibold">
          Batch upload Exchange listings
        </h1>
        <p className="mt-2 text-white/70">
          Choose one CSV and all your labeled photos. Review the matches, then submit every listing
          together.
        </p>
      </header>
      <div className="rounded-xl border border-white/15 bg-white/5 p-4 space-y-3">
        <p>
          One CSV row = one listing. Name photos <code>ITEM001_01.jpg</code>,{" "}
          <code>ITEM001_02.jpg</code>, and so on. Put <code>ITEM001</code> in the row’s{" "}
          <code>listing_id</code>. The lowest photo number becomes the main image.
        </p>
        <p className="text-sm text-white/70">
          Already named your photos differently? Put exact filenames in the optional images column,
          separated by |, in the order you want.
        </p>
        <p className="text-sm text-white/70">
          Up to 100 listings, 8 photos per listing, 10 MB per photo and 500 MB total. JPG, PNG and
          WebP. Some categories require more than one photo.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Template category
            <select
              aria-label="Template category"
              value={templateCategory}
              onChange={(event) => setTemplateCategory(event.target.value)}
              className="mt-1 block rounded border border-white/20 bg-black p-2"
            >
              <option value="">Basic template</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="outline" onClick={template}>
            Download CSV template
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!categories.length}
            onClick={() =>
              downloadCsv(
                "tradescout-exchange-categories.csv",
                [
                  ["category_id", "category_name", "minimum_photos"],
                  ...categories.map((category) => [
                    category.id,
                    category.name,
                    getExchangePhotoMinimum(
                      getExchangeCategorySlugFromMarketplaceCategoryName(category.name)
                    ),
                  ]),
                ]
                  .map((row) => row.map(exchangeCsvCell).join(","))
                  .join("\r\n")
              )
            }
          >
            Download category list
          </Button>
        </div>
        <details className="text-sm text-white/70">
          <summary className="cursor-pointer">CSV fields and category details</summary>
          <p className="mt-2">
            Required: listing_id, title, description, price, category, condition, city, state,
            zip_code, county. Category accepts a current name or ID. Optional: images, price_type,
            location_visibility, will_ship, shipping_cost, brand, model. Use numeric prices,
            two-letter states and text-formatted ZIP codes. Location visibility defaults to
            meetup_only. Shipping defaults to false; provide shipping_cost when true.
          </p>
          <p className="mt-2">
            Category templates include detail columns such as spec_delivery_option, spec_powers_on,
            spec_provenance and spec_dimensions. You can also use a specifications column containing
            a flat JSON object. Enter your own factual details; required confirmations are never
            filled in automatically.
          </p>
        </details>
      </div>
      <fieldset
        disabled={busy || reading}
        className="space-y-3 rounded-xl border border-white/15 p-4"
      >
        <legend className="px-2 font-medium">Choose your files</legend>
        <label className="block">
          CSV and photos
          <input
            aria-label="Choose CSV and photos"
            type="file"
            multiple
            accept=".csv,.jpg,.jpeg,.png,.webp"
            className="mt-2 block w-full text-sm"
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files || []);
              event.currentTarget.value = "";
              if (files.length) void selectFiles(files);
            }}
          />
        </label>
        <label className="block text-sm">
          Or choose a folder
          <input
            aria-label="Choose import folder"
            type="file"
            multiple
            {...({ webkitdirectory: "" } as { webkitdirectory: string })}
            className="mt-2 block w-full text-sm"
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files || []);
              event.currentTarget.value = "";
              if (files.length) void selectFiles(files);
            }}
          />
        </label>
        <p className="text-sm text-white/60">
          You can select the CSV first, then all photos. A new photo selection replaces the previous
          selection. After an interruption, select the same files again; saved listings will be
          checked before anything is submitted.
        </p>
        <p role="status">
          {reading
            ? "Reading files…"
            : `${csvName || "No CSV selected"} · ${photos.length} files selected`}
        </p>
      </fieldset>
      {categoriesLoading && <p role="status">Loading Exchange categories…</p>}
      {categoriesError && (
        <div role="alert">
          Categories could not be loaded.{" "}
          <Button variant="outline" disabled={busy} onClick={() => void refetch()}>
            Retry categories
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-400/50 p-3 text-red-200">
          {error}
        </p>
      )}
      {csv && preview.errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-400/50 p-3">
          {preview.errors.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </div>
      )}
      {preview.unusedPhotos.length > 0 && (
        <div className="rounded-lg border border-amber-400/50 p-3">
          <details>
            <summary>{preview.unusedPhotos.length} files do not match a listing</summary>
            <div className="max-h-40 overflow-auto text-sm">
              {preview.unusedPhotos.map((name, index) => (
                <p key={index}>{name}</p>
              ))}
            </div>
          </details>
          <label className="mt-2 flex items-start gap-2">
            <input
              type="checkbox"
              disabled={busy}
              checked={ignoredUnused}
              onChange={(event) => setIgnoredUnused(event.target.checked)}
            />{" "}
            Leave these unmatched files out of this import.
          </label>
        </div>
      )}
      {preview.rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">
              Review {preview.rows.length} listings · {issueCount} issues
            </h2>
            <Button variant="outline" onClick={exportReport}>
              Download results / errors
            </Button>
          </div>
          <div className="space-y-3">
            {preview.rows.map((row) => (
              <article
                key={`${row.line}:${row.key}`}
                className="rounded-xl border border-white/15 p-4"
              >
                <h3 className="font-medium">
                  {row.key || "Missing listing ID"} — {row.title || "Missing title"}
                </h3>
                <p className="text-sm text-white/60">
                  CSV line {row.line} · ${String(row.payload.price || "0")} ·{" "}
                  {String(row.payload.city || "")}, {String(row.payload.state || "")} ·{" "}
                  {row.photoIndexes.length} photos
                </p>
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {row.photoIndexes.map((index, position) => (
                    <figure key={`${index}:${position}`} className="w-24 shrink-0">
                      {urls[index] && (
                        <img
                          src={urls[index]}
                          alt={`${row.title}, photo ${position + 1}`}
                          className="h-20 w-24 rounded object-cover"
                          loading="lazy"
                        />
                      )}
                      <figcaption className="mt-1 break-all text-xs text-white/60">
                        {position === 0 ? "Main: " : ""}
                        {photoPath(photos[index])}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                {row.errors.map((message, index) => (
                  <p key={index} className="mt-1 text-sm text-red-200">
                    {message}
                  </p>
                ))}
                {results[row.key]?.key === row.key && (
                  <p role="status" className="mt-2 text-sm">
                    {results[row.key].message}
                    {results[row.key].listingId ? ` Listing ID: ${results[row.key].listingId}` : ""}
                  </p>
                )}
              </article>
            ))}
          </div>
          <div aria-live="polite" className="rounded-xl border border-white/15 p-4 space-y-3">
            {progress && (
              <p role="status">
                {phaseLabels[progress.phase]}
                {progress.key ? `: ${progress.key}` : ""}…
              </p>
            )}
            <p>
              {confirmed} confirmed this run · {skipped} already imported · {uploaded} photos
              uploaded this run
            </p>
            <p className="text-sm text-white/60">
              Normal account, review and visibility rules apply. Existing listings are never
              overwritten. Changed details or photos using the same ID are flagged. Keep this tab
              open while importing. A stopped import keeps completed listings; there is no
              background upload.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!ready || busy || reading || categoriesLoading || categoriesError}
                onClick={() => void submit()}
              >
                {busy
                  ? "Importing…"
                  : Object.keys(results).length
                    ? "Check saved listings and resume"
                    : `Submit ${preview.rows.length} listings`}
              </Button>
              {busy && (
                <Button
                  variant="outline"
                  onClick={() => {
                    stop.current = true;
                    setError(
                      "Pausing after the current request. Completed listings will stay saved."
                    );
                  }}
                >
                  Pause import
                </Button>
              )}
              {busy ? (
                <Button variant="outline" disabled>
                  Back to Exchange
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href="/exchange">Back to Exchange</Link>
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
