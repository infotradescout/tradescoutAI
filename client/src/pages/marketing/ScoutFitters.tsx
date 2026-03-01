import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Shirt, Upload, ShieldCheck, Loader2, Truck, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type TierKey = "high" | "medium" | "low" | "budget" | "promo";
type PlacementKey = "front_center" | "left_chest";

type TierSpec = {
  key: TierKey;
  series: "contractor" | "value";
  label: string;
  summary: string;
  wholesaleEstimate: number;
  blankUrl: string;
  technique: "EMBROIDERY" | "DTG";
  featured?: boolean;
};

const PROFIT_PER_SHIRT = 18;

const TIERS: Record<TierKey, TierSpec> = {
  high: {
    key: "high",
    series: "contractor",
    label: "Contractor Series — Carhartt K87",
    summary: "Pocket tee + embroidery. Built for job sites.",
    wholesaleEstimate: 24,
    blankUrl: "/scoutfitters/blank-high.svg",
    technique: "EMBROIDERY",
    featured: true,
  },
  medium: {
    key: "medium",
    series: "contractor",
    label: "Contractor Series — Hanes Beefy-T",
    summary: "6.1oz heavyweight + DTG. Durable daily driver.",
    wholesaleEstimate: 13,
    blankUrl: "/scoutfitters/blank-medium.svg",
    technique: "DTG",
    featured: true,
  },
  low: {
    key: "low",
    series: "contractor",
    label: "Contractor Series — Gildan Ultra",
    summary: "6oz heavyweight + DTG. No thin promo tees.",
    wholesaleEstimate: 10,
    blankUrl: "/scoutfitters/blank-low.svg",
    technique: "DTG",
  },
  budget: {
    key: "budget",
    series: "value",
    label: "Value — Budget (Gildan 5000)",
    summary: "Classic tee + DTG. Cheaper, less durable.",
    wholesaleEstimate: 6,
    blankUrl: "/scoutfitters/blank-low.svg",
    technique: "DTG",
  },
  promo: {
    key: "promo",
    series: "value",
    label: "Value — Promo (Softstyle / thin)",
    summary: "Thin promo tee + DTG. Not recommended for workwear.",
    wholesaleEstimate: 4,
    blankUrl: "/scoutfitters/blank-low.svg",
    technique: "DTG",
  },
};

const QUALITY_WARNING =
  "Image quality too low for professional workwear. Please upload a high-res file.";

type Recipient = {
  name: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  state_code: string;
  zip: string;
  country_code: string;
  phone?: string;
};

function parseDataUrlPng(dataUrl: string): string | null {
  const prefix = "data:image/png;base64,";
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(prefix)) return null;
  return dataUrl.slice(prefix.length);
}

async function dataUrlToPngBlob(dataUrl: string): Promise<Blob | null> {
  try {
    if (!parseDataUrlPng(dataUrl)) return null;
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    if (blob.type !== "image/png") return null;
    return blob;
  } catch {
    return null;
  }
}

async function loadImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
    return dims;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function isQualityOk(dims: { width: number; height: number }, placement: PlacementKey): boolean {
  // NO BS RULE:
  // - Always require >= 2000px on the shortest side (per spec).
  // - Also enforce 300 DPI minimum, based on the assumed physical size:
  //   front center ~12" print, left chest ~4" print.
  const shortest = Math.min(dims.width, dims.height);
  if (shortest < 2000) return false;

  const assumedInches = placement === "left_chest" ? 4 : 12;
  const estimatedDpi = shortest / assumedInches;
  return estimatedDpi >= 300;
}

export default function ScoutFitters() {
  const [, navigate] = useLocation();

  const [tier, setTier] = useState<TierKey>("high");
  const [placement, setPlacement] = useState<PlacementKey>("left_chest");
  const [quantity, setQuantity] = useState<number>(1);
  const [showValueOptions, setShowValueOptions] = useState(false);

  const [qualityError, setQualityError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDims, setLogoDims] = useState<{ width: number; height: number } | null>(null);

  const [recipient, setRecipient] = useState<Recipient>({
    name: "",
    email: "",
    address1: "",
    address2: "",
    city: "",
    state_code: "TX",
    zip: "",
    country_code: "US",
    phone: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<any>(null);
  const fabricRef = useRef<any>(null);
  const logoObjectRef = useRef<any>(null);
  const hintObjectRef = useRef<any>(null);

  const tierSpec = TIERS[tier];

  const unitPrice = useMemo(() => tierSpec.wholesaleEstimate + PROFIT_PER_SHIRT, [tierSpec]);

  const subtotal = useMemo(() => {
    const q = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
    return q * unitPrice;
  }, [quantity, unitPrice]);

  const printBox = useMemo(() => {
    // Canvas coordinates for preview placement. These do not dictate Printful positioning;
    // they just make the preview match the requested placement.
    if (placement === "left_chest") {
      return { x: 265, y: 170, w: 110, h: 110 };
    }
    return { x: 145, y: 240, w: 260, h: 260 };
  }, [placement]);

  const setBackground = async (blankUrl: string) => {
    const fabric = fabricRef.current;
    const canvas = fabricCanvasRef.current;
    if (!fabric || !canvas) return;

    const img = await fabric.Image.fromURL(blankUrl, { crossOrigin: "anonymous" });
    img.selectable = false;
    img.evented = false;

    const cw = canvas.getWidth();
    const ch = canvas.getHeight();
    img.scaleToWidth(cw);
    img.scaleToHeight(ch);
    img.left = 0;
    img.top = 0;

    canvas.backgroundImage = img;
    canvas.requestRenderAll();
  };

  const placeLogoObject = () => {
    const canvas = fabricCanvasRef.current;
    const logoObj = logoObjectRef.current;
    if (!canvas || !logoObj) return;

    const pad = 8;
    const maxW = Math.max(32, printBox.w - pad * 2);
    const maxH = Math.max(32, printBox.h - pad * 2);

    // Reset scale, then fit
    logoObj.scaleX = 1;
    logoObj.scaleY = 1;
    if (typeof logoObj.scaleToWidth === "function") {
      logoObj.scaleToWidth(maxW);
      if (logoObj.getScaledHeight() > maxH) {
        logoObj.scaleToHeight(maxH);
      }
    }

    logoObj.left = printBox.x + (printBox.w - logoObj.getScaledWidth()) / 2;
    logoObj.top = printBox.y + (printBox.h - logoObj.getScaledHeight()) / 2;
    logoObj.setCoords();
    canvas.requestRenderAll();
  };

  const removeLogo = () => {
    const canvas = fabricCanvasRef.current;
    const logoObj = logoObjectRef.current;
    if (canvas && logoObj) {
      canvas.remove(logoObj);
      canvas.requestRenderAll();
    }
    logoObjectRef.current = null;
    setLogoFile(null);
    setLogoDims(null);
    setQualityError(null);

    // Restore hint if removed.
    const fabric = fabricRef.current;
    if (canvas && fabric && !hintObjectRef.current) {
      const hint = new fabric.Text("Upload a logo to preview", {
        left: 40,
        top: 22,
        fontSize: 18,
        fill: "rgba(255,255,255,0.70)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial",
        selectable: false,
        evented: false,
      });
      hintObjectRef.current = hint;
      canvas.add(hint);
      canvas.requestRenderAll();
    }
  };

  const addLogoToCanvas = async (file: File) => {
    const fabric = fabricRef.current;
    const canvas = fabricCanvasRef.current;
    if (!fabric || !canvas) return;

    if (hintObjectRef.current) {
      try {
        canvas.remove(hintObjectRef.current);
      } catch {
        // ignore
      }
      hintObjectRef.current = null;
    }

    // Remove existing logo if any
    if (logoObjectRef.current) {
      try {
        canvas.remove(logoObjectRef.current);
      } catch {
        // ignore
      }
      logoObjectRef.current = null;
    }

    const url = URL.createObjectURL(file);
    try {
      const img = await fabric.Image.fromURL(url, { crossOrigin: "anonymous" });
      img.selectable = true;
      img.hasControls = true;
      img.cornerStyle = "circle";
      img.borderColor = "rgba(249,115,22,0.55)";
      img.cornerColor = "rgba(249,115,22,0.75)";
      img.transparentCorners = false;

      canvas.add(img);
      logoObjectRef.current = img;
      placeLogoObject();
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!canvasElRef.current) return;

      // Fabric is client-only; load dynamically.
      const fabric = await import("fabric");
      if (cancelled) return;

      fabricRef.current = fabric;
      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: 520,
        height: 640,
        backgroundColor: "#07090B",
        selection: false,
        preserveObjectStacking: true,
      });

      fabricCanvasRef.current = canvas;
      await setBackground(tierSpec.blankUrl);

      // Initial hint text
      const hint = new fabric.Text("Upload a logo to preview", {
        left: 40,
        top: 22,
        fontSize: 18,
        fill: "rgba(255,255,255,0.70)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial",
        selectable: false,
        evented: false,
      });
      hintObjectRef.current = hint;
      canvas.add(hint);

      return () => {
        try {
          canvas.dispose();
        } catch {
          // ignore
        }
      };
    };

    void init();
    return () => {
      cancelled = true;
      try {
        fabricCanvasRef.current?.dispose?.();
      } catch {
        // ignore
      }
      fabricCanvasRef.current = null;
      fabricRef.current = null;
      hintObjectRef.current = null;
      logoObjectRef.current = null;
    };
  }, []);

  useEffect(() => {
    void setBackground(tierSpec.blankUrl);
  }, [tierSpec.blankUrl]);

  useEffect(() => {
    // Re-position the logo on placement changes.
    placeLogoObject();
  }, [printBox.x, printBox.y, printBox.w, printBox.h]);

  const onLogoSelected = async (file: File | null) => {
    setQualityError(null);
    setSubmitError(null);
    setSubmitResult(null);

    if (!file) return;

    // SVG is allowed (vector), but DPI checks don't apply.
    if (file.type === "image/svg+xml") {
      setLogoFile(file);
      setLogoDims(null);
      await addLogoToCanvas(file);
      return;
    }

    const dims = await loadImageDimensions(file);
    if (!dims) {
      setQualityError(QUALITY_WARNING);
      return;
    }

    setLogoDims(dims);
    const ok = isQualityOk(dims, placement);
    if (!ok) {
      setQualityError(QUALITY_WARNING);
      return;
    }

    setLogoFile(file);
    await addLogoToCanvas(file);
  };

  const exportPrintPng = async (): Promise<string | null> => {
    const fabric = fabricRef.current;
    const logoObj = logoObjectRef.current;
    if (!fabric || !logoObj || !logoFile) return null;

    // Output file is *not* the preview canvas. It’s a high-res, transparent PNG suitable for print.
    // Left chest: require >=2000px shortest-side (no-BS rule) even though 300DPI would be 1200px.
    // Front center: 12"x12" @ 300 DPI => 3600px square.
    const targetPx = placement === "left_chest" ? 2000 : 3600;

    const rect = logoObj.getBoundingRect(true, true);
    const boxCx = printBox.x + printBox.w / 2;
    const boxCy = printBox.y + printBox.h / 2;
    const rectCx = rect.left + rect.width / 2;
    const rectCy = rect.top + rect.height / 2;

    const relCx = (rectCx - boxCx) / Math.max(1, printBox.w);
    const relCy = (rectCy - boxCy) / Math.max(1, printBox.h);
    const relW = rect.width / Math.max(1, printBox.w);

    const exportEl = document.createElement("canvas");
    const outCanvas = new fabric.StaticCanvas(exportEl, {
      width: targetPx,
      height: targetPx,
      backgroundColor: "rgba(0,0,0,0)",
    });

    const url = URL.createObjectURL(logoFile);
    try {
      const img = await fabric.Image.fromURL(url, { crossOrigin: "anonymous" });
      img.selectable = false;
      img.evented = false;

      const desiredW = Math.max(1, relW * targetPx);
      img.scaleX = 1;
      img.scaleY = 1;
      if (typeof img.scaleToWidth === "function") {
        img.scaleToWidth(desiredW);
      } else if (typeof img.width === "number" && img.width > 0) {
        const s = desiredW / img.width;
        img.scaleX = s;
        img.scaleY = s;
      }

      const scaledW =
        typeof img.getScaledWidth === "function"
          ? img.getScaledWidth()
          : (img.width || 0) * (img.scaleX || 1);
      const scaledH =
        typeof img.getScaledHeight === "function"
          ? img.getScaledHeight()
          : (img.height || 0) * (img.scaleY || 1);

      img.left = targetPx / 2 + relCx * targetPx - scaledW / 2;
      img.top = targetPx / 2 + relCy * targetPx - scaledH / 2;

      outCanvas.add(img);
      outCanvas.renderAll();
      return outCanvas.toDataURL({ format: "png", enableRetinaScaling: false });
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
      try {
        outCanvas.dispose();
      } catch {
        // ignore
      }
    }
  };

  const downloadDesign = async () => {
    setSubmitError(null);
    const pngDataUrl = await exportPrintPng();
    if (!pngDataUrl || !parseDataUrlPng(pngDataUrl)) {
      setSubmitError("Unable to export a print-ready PNG. Refresh and try again.");
      return;
    }

    const a = document.createElement("a");
    a.href = pngDataUrl;
    a.download = `scoutfitters-${tier}-${placement}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const submitOrder = async () => {
    setSubmitError(null);
    setSubmitResult(null);

    if (!logoFile) {
      setSubmitError("Upload a logo first.");
      return;
    }
    if (qualityError) {
      setSubmitError(qualityError);
      return;
    }

    const pngDataUrl = await exportPrintPng();
    if (!pngDataUrl) {
      setSubmitError("Unable to export a print-ready PNG. Refresh and try again.");
      return;
    }
    if (!parseDataUrlPng(pngDataUrl)) {
      setSubmitError("Print export was not a PNG. Refresh and try again.");
      return;
    }

    if (!recipient.name || !recipient.email || !recipient.address1 || !recipient.city) {
      setSubmitError("Recipient info is incomplete (name, email, address, city required).");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1) Upload design to /uploads so Printful can fetch it (multipart to avoid JSON size limits)
      const pngBlob = await dataUrlToPngBlob(pngDataUrl);
      if (!pngBlob) throw new Error("Unable to prepare PNG upload. Refresh and try again.");

      const form = new FormData();
      form.append("design", new File([pngBlob], "scoutfitters-design.png", { type: "image/png" }));

      const designRes = await fetch("/api/scoutfitters/design", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const designJson = await designRes.json().catch(() => ({}));
      if (!designRes.ok) {
        throw new Error(designJson?.message || `Design upload failed (${designRes.status})`);
      }

      const designUrl = String(designJson?.url || "");
      if (!designUrl) {
        throw new Error("Design upload did not return a URL.");
      }

      // 2) Create Printful draft order
      const orderRes = await fetch("/api/scoutfitters/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tier,
          placement,
          quantity: Math.max(1, Math.floor(quantity || 1)),
          recipient,
          designUrl,
          confirm: false,
        }),
      });
      const orderJson = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) {
        throw new Error(orderJson?.message || `Order failed (${orderRes.status})`);
      }

      setSubmitResult(orderJson);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Order failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shirt className="h-6 w-6 text-ts-orange" />
            ScoutFitters
          </h1>
          <p className="text-sm text-white/70 mt-1">
            Contractor Series is featured first. Customers can still pick budget blanks if they
            want. Upload a logo, preview placement, and send to fulfillment.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/profile-settings")}>
            Profile settings
          </Button>
          <Button variant="outline" onClick={() => navigate("/reset")}>
            Reset cache
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-ts-orange" />
              Visualizer
            </CardTitle>
            <CardDescription>
              Tier selects the blank + technique. Placement selects front center or left chest
              (4&quot;x4&quot;).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 space-y-3">
                <div>
                  <Label>Contractor Series</Label>
                  <div className="text-[11px] text-white/70 mt-1">
                    Featured workwear tiers (profit stays the same across tiers).
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {(Object.keys(TIERS) as TierKey[])
                    .filter((k) => TIERS[k].series === "contractor")
                    .map((k) => {
                      const t = TIERS[k];
                      const active = tier === k;
                      const unit = t.wholesaleEstimate + PROFIT_PER_SHIRT;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setTier(k)}
                          className="rounded-xl border px-3 py-2 text-left transition-colors"
                          style={{
                            borderColor: active
                              ? "rgba(249,115,22,0.65)"
                              : t.featured
                                ? "rgba(249,115,22,0.35)"
                                : "rgba(255,255,255,0.10)",
                            backgroundColor: active
                              ? "rgba(249,115,22,0.10)"
                              : "rgba(17,20,24,0.55)",
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">{t.label}</div>
                            {t.featured && (
                              <span className="text-[10px] rounded-full px-2 py-0.5 bg-ts-orange/20 text-ts-orange border border-ts-orange/30">
                                Featured
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-white/70 mt-1">{t.summary}</div>
                          <div className="text-[11px] text-white/70 mt-2">
                            Technique: <span className="text-white">{t.technique}</span>
                          </div>
                          <div className="text-[11px] text-white/70 mt-1">
                            Your price: <span className="text-white">${unit.toFixed(2)}</span> •
                            Profit:{" "}
                            <span className="text-white">${PROFIT_PER_SHIRT.toFixed(2)}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div>
                    <Label>Value options</Label>
                    <div className="text-[11px] text-white/70 mt-1">
                      Cheaper blanks for customers who want budget pricing.
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowValueOptions((s) => !s)}
                  >
                    {showValueOptions ? "Hide" : "Show"}
                  </Button>
                </div>

                {showValueOptions && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(Object.keys(TIERS) as TierKey[])
                      .filter((k) => TIERS[k].series === "value")
                      .map((k) => {
                        const t = TIERS[k];
                        const active = tier === k;
                        const unit = t.wholesaleEstimate + PROFIT_PER_SHIRT;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setTier(k)}
                            className="rounded-xl border px-3 py-2 text-left transition-colors"
                            style={{
                              borderColor: active
                                ? "rgba(249,115,22,0.65)"
                                : "rgba(255,255,255,0.10)",
                              backgroundColor: active
                                ? "rgba(249,115,22,0.10)"
                                : "rgba(17,20,24,0.55)",
                            }}
                          >
                            <div className="text-sm font-medium">{t.label}</div>
                            <div className="text-[11px] text-white/70 mt-1">{t.summary}</div>
                            <div className="text-[11px] text-white/70 mt-2">
                              Technique: <span className="text-white">{t.technique}</span>
                            </div>
                            <div className="text-[11px] text-white/70 mt-1">
                              Your price: <span className="text-white">${unit.toFixed(2)}</span> •
                              Profit:{" "}
                              <span className="text-white">${PROFIT_PER_SHIRT.toFixed(2)}</span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="w-full md:w-72 space-y-3">
                <div className="space-y-2">
                  <Label>Placement</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPlacement("front_center")}
                      className="rounded-xl border px-3 py-2 text-sm"
                      style={{
                        borderColor:
                          placement === "front_center"
                            ? "rgba(249,115,22,0.65)"
                            : "rgba(255,255,255,0.10)",
                        backgroundColor:
                          placement === "front_center"
                            ? "rgba(249,115,22,0.10)"
                            : "rgba(17,20,24,0.55)",
                      }}
                    >
                      Front center
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlacement("left_chest")}
                      className="rounded-xl border px-3 py-2 text-sm"
                      style={{
                        borderColor:
                          placement === "left_chest"
                            ? "rgba(249,115,22,0.65)"
                            : "rgba(255,255,255,0.10)",
                        backgroundColor:
                          placement === "left_chest"
                            ? "rgba(249,115,22,0.10)"
                            : "rgba(17,20,24,0.55)",
                      }}
                    >
                      Left chest (4&quot;x4&quot;)
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))}
                  />
                  <div className="text-[11px] text-white/70">
                    Est. subtotal: <span className="text-white">${subtotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Upload logo</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      onChange={(e) => void onLogoSelected(e.target.files?.[0] || null)}
                    />
                    <Button variant="outline" onClick={removeLogo} disabled={!logoFile}>
                      Clear
                    </Button>
                  </div>
                  <div className="text-[11px] text-white/70 flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-ts-orange" />
                    <span>
                      No BS quality gate: &ge;2000px shortest side and ~300 DPI (estimated).
                    </span>
                  </div>
                  {logoDims && (
                    <div className="text-[11px] text-white/70">
                      Logo size:{" "}
                      <span className="text-white">
                        {logoDims.width}×{logoDims.height}px
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {qualityError && (
              <Alert variant="destructive">
                <AlertTitle className="flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Quality alert
                </AlertTitle>
                <AlertDescription>{qualityError}</AlertDescription>
              </Alert>
            )}

            <div className="rounded-xl border p-3 bg-black/20">
              <div className="text-[0.7rem] uppercase tracking-[0.2em] text-white/70 mb-2">
                Preview
              </div>
              <div className="w-full overflow-auto">
                <canvas ref={canvasElRef} className="rounded-lg border border-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-ts-orange" />
              Send to fulfillment
            </CardTitle>
            <CardDescription>
              Creates a Printful draft order (confirm=false). Shipping/payment flow can be layered
              in next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={recipient.name}
                onChange={(e) => setRecipient((r) => ({ ...r, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={recipient.email}
                onChange={(e) => setRecipient((r) => ({ ...r, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={recipient.address1}
                onChange={(e) => setRecipient((r) => ({ ...r, address1: e.target.value }))}
                placeholder="Street address"
              />
              <Input
                value={recipient.address2 || ""}
                onChange={(e) => setRecipient((r) => ({ ...r, address2: e.target.value }))}
                placeholder="Apt, suite, etc (optional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={recipient.city}
                  onChange={(e) => setRecipient((r) => ({ ...r, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={recipient.state_code}
                  onChange={(e) =>
                    setRecipient((r) => ({ ...r, state_code: e.target.value.toUpperCase() }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>ZIP</Label>
                <Input
                  value={recipient.zip}
                  onChange={(e) => setRecipient((r) => ({ ...r, zip: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={recipient.country_code}
                  onChange={(e) =>
                    setRecipient((r) => ({ ...r, country_code: e.target.value.toUpperCase() }))
                  }
                />
              </div>
            </div>

            {submitError && (
              <Alert variant="destructive">
                <AlertTitle>Order failed</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {submitResult && (
              <Alert>
                <AlertTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-ts-orange" />
                  Draft created
                </AlertTitle>
                <AlertDescription className="text-xs whitespace-pre-wrap break-words">
                  {JSON.stringify(submitResult, null, 2)}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={downloadDesign}
                disabled={isSubmitting || !logoFile || !!qualityError}
              >
                Download PNG
              </Button>
              <Button
                type="button"
                onClick={submitOrder}
                disabled={isSubmitting || !logoFile || !!qualityError}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <BadgeCheck className="h-4 w-4 mr-2" /> Create draft order
                  </>
                )}
              </Button>
            </div>

            <div className="text-[11px] text-white/70">
              Tip: If your profile buttons/settings feel stuck, run `Reset cache` (top right) then
              try again.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
