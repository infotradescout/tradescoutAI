import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  Shirt,
  Upload,
  ShieldCheck,
  Truck,
  BadgeCheck,
  Sparkles,
  Loader2,
  Share2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { share } from "@/utils/share";

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

const TIERS: Record<TierKey, TierSpec> = {
  high: {
    key: "high",
    series: "contractor",
    label: "Contractor Series - Carhartt K87",
    summary: "Pocket tee + embroidery. Built for job sites.",
    wholesaleEstimate: 24,
    blankUrl: "/scoutfitters/blank-high.svg",
    technique: "EMBROIDERY",
    featured: true,
  },
  medium: {
    key: "medium",
    series: "contractor",
    label: "Contractor Series - Hanes Beefy-T",
    summary: "6.1oz heavyweight + DTG. Durable daily driver.",
    wholesaleEstimate: 13,
    blankUrl: "/scoutfitters/blank-medium.svg",
    technique: "DTG",
    featured: true,
  },
  low: {
    key: "low",
    series: "contractor",
    label: "Contractor Series - Gildan Ultra",
    summary: "6oz heavyweight + DTG. No thin promo tees.",
    wholesaleEstimate: 10,
    blankUrl: "/scoutfitters/blank-low.svg",
    technique: "DTG",
  },
  budget: {
    key: "budget",
    series: "value",
    label: "Value - Budget (Gildan 5000)",
    summary: "Classic tee + DTG. Cheaper, less durable.",
    wholesaleEstimate: 6,
    blankUrl: "/scoutfitters/blank-low.svg",
    technique: "DTG",
  },
  promo: {
    key: "promo",
    series: "value",
    label: "Value - Promo (Softstyle / thin)",
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

type ScoutFittersConfig = {
  catalog?: Array<{
    key: TierKey;
    technique: "EMBROIDERY" | "DTG";
    configured: boolean;
    retailPrice?: number | null;
  }>;
  fulfillment?: {
    printfulConfigured?: boolean;
    variantsConfigured?: Partial<Record<TierKey, boolean>>;
    configuredTierKeys?: string[];
    allowedTierKeys?: string[];
    fileTypeOverridesConfigured?: boolean;
  };
  quality?: {
    minShortestSidePx?: number;
    minDpi?: number;
  };
};

type SubmitResult = Record<string, unknown> | null;

type FabricBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type FabricObjectLike = {
  selectable?: boolean;
  evented?: boolean;
  left?: number;
  top?: number;
};

type FabricImageLike = FabricObjectLike & {
  scaleX?: number;
  scaleY?: number;
  width?: number;
  height?: number;
  hasControls?: boolean;
  cornerStyle?: string;
  borderColor?: string;
  cornerColor?: string;
  transparentCorners?: boolean;
  scaleToWidth?: (value: number) => void;
  scaleToHeight?: (value: number) => void;
  getScaledWidth: () => number;
  getScaledHeight: () => number;
  setCoords: () => void;
  getBoundingRect: (absolute?: boolean, calculate?: boolean) => FabricBounds;
};

type FabricCanvasLike = {
  backgroundImage?: FabricImageLike;
  add: (...objects: FabricObjectLike[]) => unknown;
  remove: (object: FabricObjectLike) => void;
  requestRenderAll: () => void;
  getWidth: () => number;
  getHeight: () => number;
  dispose: () => void;
};

type FabricStaticCanvasLike = FabricCanvasLike & {
  renderAll: () => void;
  toDataURL: (options: { format: "png"; enableRetinaScaling: boolean }) => string;
};

type FabricModuleLike = {
  Image: {
    fromURL: (url: string, options?: { crossOrigin?: string }) => Promise<FabricImageLike>;
  };
  Text: new (text: string, options: Record<string, unknown>) => FabricObjectLike;
  Canvas: new (element: HTMLCanvasElement, options: Record<string, unknown>) => FabricCanvasLike;
  StaticCanvas: new (
    element: HTMLCanvasElement,
    options: Record<string, unknown>
  ) => FabricStaticCanvasLike;
};

function parseDataUrlPng(dataUrl: string): string | null {
  const prefix = "data:image/png;base64,";
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(prefix)) return null;
  return dataUrl.slice(prefix.length);
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.length > 0) {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read image"));
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
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
  const dataUrl = await fileToDataUrl(file);
  const img = new Image();
  img.decoding = "async";
  try {
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    });
    return dims;
  } finally {
    img.src = "";
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
  const [config, setConfig] = useState<ScoutFittersConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

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
  const [submitResult, setSubmitResult] = useState<SubmitResult>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fabricCanvasRef = useRef<unknown>(null);
  const fabricRef = useRef<unknown>(null);
  const logoObjectRef = useRef<unknown>(null);
  const hintObjectRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      setConfigLoading(true);
      setConfigError(null);
      try {
        const response = await fetch("/api/scoutfitters/config", { credentials: "include" });
        if (!response.ok) {
          throw new Error(`ScoutFitters config failed (${response.status})`);
        }

        const payload = (await response.json()) as ScoutFittersConfig;
        if (!cancelled) {
          setConfig(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setConfigError(
            error instanceof Error ? error.message : "Failed to load ScoutFitters config"
          );
        }
      } finally {
        if (!cancelled) {
          setConfigLoading(false);
        }
      }
    };

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const tierSpec = TIERS[tier];

  const configuredTierKeys = useMemo(() => {
    const fromConfig = (config?.fulfillment?.configuredTierKeys || []).filter(
      (key): key is TierKey => key in TIERS
    );
    return fromConfig.length > 0 ? fromConfig : (Object.keys(TIERS) as TierKey[]);
  }, [config]);

  const contractorTierKeys = useMemo(
    () => configuredTierKeys.filter((key) => TIERS[key].series === "contractor"),
    [configuredTierKeys]
  );

  const valueTierKeys = useMemo(
    () => configuredTierKeys.filter((key) => TIERS[key].series === "value"),
    [configuredTierKeys]
  );

  const printfulConfigured = config?.fulfillment?.printfulConfigured !== false;
  const selectedTierConfigured = configuredTierKeys.includes(tier);
  const retailPriceByTier = useMemo(() => {
    const entries = (config?.catalog || [])
      .filter((item): item is NonNullable<ScoutFittersConfig["catalog"]>[number] =>
        Boolean(item?.key)
      )
      .map(
        (item) =>
          [item.key, typeof item.retailPrice === "number" ? item.retailPrice : null] as const
      );
    return Object.fromEntries(entries) as Partial<Record<TierKey, number | null>>;
  }, [config]);

  const selectableButtonClass =
    "rounded-xl border px-3 py-2 text-left transition-colors border-white/10 bg-tsCard hover:border-ts-orange/30 hover:bg-white/5";
  const activeSelectableButtonClass = "border-ts-orange/40 bg-ts-orange/10";

  useEffect(() => {
    if (!configuredTierKeys.length) return;
    if (configuredTierKeys.includes(tier)) return;
    setTier(configuredTierKeys[0]);
  }, [configuredTierKeys, tier]);

  const unitPrice = useMemo(() => retailPriceByTier[tier] ?? null, [retailPriceByTier, tier]);

  const subtotal = useMemo(() => {
    if (typeof unitPrice !== "number") return null;
    const q = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
    return q * unitPrice;
  }, [quantity, unitPrice]);

  const formatMoney = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? `$${value.toFixed(2)}`
      : "Price available after sync";

  const printBox = useMemo(() => {
    // Canvas coordinates for preview placement. These do not dictate Printful positioning;
    // they just make the preview match the requested placement.
    if (placement === "left_chest") {
      return { x: 265, y: 170, w: 110, h: 110 };
    }
    return { x: 145, y: 240, w: 260, h: 260 };
  }, [placement]);

  const setBackground = async (blankUrl: string) => {
    const fabric = fabricRef.current as FabricModuleLike | null;
    const canvas = fabricCanvasRef.current as FabricCanvasLike | null;
    if (!fabric || !canvas) return;

    const img = await fabric.Image.fromURL(blankUrl, { crossOrigin: "anonymous" });
    img.selectable = false;
    img.evented = false;

    const cw = canvas.getWidth();
    const ch = canvas.getHeight();
    if (typeof img.scaleToWidth === "function") {
      img.scaleToWidth(cw);
    }
    if (typeof img.scaleToHeight === "function") {
      img.scaleToHeight(ch);
    }
    img.left = 0;
    img.top = 0;

    canvas.backgroundImage = img;
    canvas.requestRenderAll();
  };

  const placeLogoObject = () => {
    const canvas = fabricCanvasRef.current as FabricCanvasLike | null;
    const logoObj = logoObjectRef.current as FabricImageLike | null;
    if (!canvas || !logoObj) return;

    const pad = 8;
    const maxW = Math.max(32, printBox.w - pad * 2);
    const maxH = Math.max(32, printBox.h - pad * 2);

    logoObj.scaleX = 1;
    logoObj.scaleY = 1;
    if (typeof logoObj.scaleToWidth === "function") {
      logoObj.scaleToWidth(maxW);
      if (logoObj.getScaledHeight() > maxH && typeof logoObj.scaleToHeight === "function") {
        logoObj.scaleToHeight(maxH);
      }
    }

    logoObj.left = printBox.x + (printBox.w - logoObj.getScaledWidth()) / 2;
    logoObj.top = printBox.y + (printBox.h - logoObj.getScaledHeight()) / 2;
    logoObj.setCoords();
    canvas.requestRenderAll();
  };

  const removeLogo = () => {
    try {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      // ignore
    }

    const canvas = fabricCanvasRef.current as FabricCanvasLike | null;
    const logoObj = logoObjectRef.current as FabricImageLike | null;
    if (canvas && logoObj) {
      canvas.remove(logoObj);
      canvas.requestRenderAll();
    }
    logoObjectRef.current = null;
    setLogoFile(null);
    setLogoDims(null);
    setQualityError(null);

    // Restore hint if removed.
    const fabric = fabricRef.current as FabricModuleLike | null;
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
    const fabric = fabricRef.current as FabricModuleLike | null;
    const canvas = fabricCanvasRef.current as FabricCanvasLike | null;
    if (!fabric || !canvas) return;

    if (hintObjectRef.current) {
      try {
        canvas.remove(hintObjectRef.current as FabricObjectLike);
      } catch {
        // ignore
      }
      hintObjectRef.current = null;
    }

    // Remove existing logo if any
    if (logoObjectRef.current) {
      try {
        canvas.remove(logoObjectRef.current as FabricObjectLike);
      } catch {
        // ignore
      }
      logoObjectRef.current = null;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      const img = await fabric.Image.fromURL(dataUrl);
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
      // no-op
    }
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!canvasElRef.current) return;

      // Fabric is client-only; load dynamically.
      const fabric = (await import("fabric")) as unknown as FabricModuleLike;
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
        (fabricCanvasRef.current as FabricCanvasLike | null)?.dispose();
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
    const fabric = fabricRef.current as FabricModuleLike | null;
    const logoObj = logoObjectRef.current as FabricImageLike | null;
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

    try {
      const dataUrl = await fileToDataUrl(logoFile);
      const img = await fabric.Image.fromURL(dataUrl);
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

    if (!printfulConfigured) {
      setSubmitError("ScoutFitters fulfillment is not configured yet.");
      return;
    }
    if (!selectedTierConfigured) {
      setSubmitError("The selected merch option is not configured for fulfillment yet.");
      return;
    }

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

  const handleSharePage = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await share({
        path: "/marketing/scoutfitters",
        title: "ScoutFitters",
        text: "Upload your logo and create branded workwear.",
        contextLabel: "Share link",
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-2.5 py-3 sm:px-3 sm:py-4 md:px-6 md:py-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shirt className="h-6 w-6 text-ts-orange" />
            ScoutFitters
          </h1>
          <p className="text-sm text-white/70 mt-1">
            Upload a logo, preview placement, and send any configured ScoutFitters merch option to
            fulfillment.
          </p>
          <p className="text-xs text-white/70 mt-2">
            Selected: <span className="text-white">{tierSpec.label}</span> • Unit:{" "}
            <span className="text-white">{formatMoney(unitPrice)}</span> • Subtotal:{" "}
            <span className="text-white">{formatMoney(subtotal)}</span>
          </p>
          <p className="text-xs text-white/70 mt-1">
            Configured catalog: <span className="text-white">{configuredTierKeys.length}</span>{" "}
            option
            {configuredTierKeys.length === 1 ? "" : "s"} ready
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleSharePage()}
            disabled={sharing}
          >
            <Share2 className="h-4 w-4 mr-2" />
            {sharing ? "Sharing..." : "Share"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/settings?tab=profile")}>
            Profile settings
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              try {
                const url = new URL(window.location.href);
                url.searchParams.set("__reset", "1");
                window.location.assign(url.toString());
              } catch {
                window.location.assign(`${window.location.pathname}?__reset=1`);
              }
            }}
          >
            Repair &amp; Reload
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-ts-orange" />
              Visualizer
            </CardTitle>
            <CardDescription>
              Step 1: pick tier, placement, and logo. Placement supports front center or left chest
              (4&quot;x4&quot;).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-ts-orange/20 bg-[linear-gradient(180deg,rgba(249,115,22,0.08),rgba(0,0,0,0))] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[0.7rem] uppercase tracking-[0.2em] text-white/60">
                    Selected item
                  </div>
                  <div className="mt-1 text-base font-semibold text-white">{tierSpec.label}</div>
                  <div className="mt-1 text-sm text-white/70">{tierSpec.summary}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right min-w-[140px]">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/50">
                    Customer price
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {formatMoney(unitPrice)}
                  </div>
                  <div className="text-xs text-white/60">
                    {typeof subtotal === "number"
                      ? `Subtotal ${formatMoney(subtotal)}`
                      : "Price sync required"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/50">
                    Series
                  </div>
                  <div className="mt-1 text-sm text-white capitalize">{tierSpec.series}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/50">
                    Technique
                  </div>
                  <div className="mt-1 text-sm text-white">{tierSpec.technique}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/50">
                    Placement
                  </div>
                  <div className="mt-1 text-sm text-white">
                    {placement === "left_chest" ? "Left chest" : "Front center"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/50">
                    Quantity
                  </div>
                  <div className="mt-1 text-sm text-white">
                    {Math.max(1, Math.floor(quantity || 1))}
                  </div>
                </div>
              </div>
            </div>

            {configError && (
              <Alert variant="destructive">
                <AlertTitle>Catalog status</AlertTitle>
                <AlertDescription>{configError}</AlertDescription>
              </Alert>
            )}

            {configLoading && (
              <Alert>
                <AlertTitle>Catalog status</AlertTitle>
                <AlertDescription>
                  Loading configured merch options and fulfillment status.
                </AlertDescription>
              </Alert>
            )}

            {!configLoading && !configuredTierKeys.length && (
              <Alert variant="destructive">
                <AlertTitle>Catalog status</AlertTitle>
                <AlertDescription>
                  No ScoutFitters merch options are configured for fulfillment yet.
                </AlertDescription>
              </Alert>
            )}

            <div className="rounded-xl border p-3 bg-black/20 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Sparkles className="h-4 w-4 text-ts-orange" />
                Item preview
              </div>
              <div className="text-xs text-white/60">
                Preview the selected blank, placement, and uploaded mark before you send the draft
                order.
              </div>
              <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-2">
                <canvas ref={canvasElRef} className="h-auto w-full max-w-[520px] rounded-lg" />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 space-y-3">
                <div>
                  <Label>Contractor Series</Label>
                  <div className="text-[11px] text-white/70 mt-1">
                    Featured workwear tiers already configured for fulfillment.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {contractorTierKeys.map((k) => {
                    const t = TIERS[k];
                    const active = tier === k;
                    const retailPrice = retailPriceByTier[k] ?? null;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setTier(k)}
                        className={cn(
                          selectableButtonClass,
                          active && activeSelectableButtonClass,
                          !active && t.featured && "border-ts-orange/30"
                        )}
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
                          Price: <span className="text-white">{formatMoney(retailPrice)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {valueTierKeys.length > 0 && (
                  <>
                    <div className="pt-1">
                      <Label>Value options</Label>
                      <div className="text-[11px] text-white/70 mt-1">
                        Lower-cost blanks that are currently configured for fulfillment.
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {valueTierKeys.map((k) => {
                        const t = TIERS[k];
                        const active = tier === k;
                        const retailPrice = retailPriceByTier[k] ?? null;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setTier(k)}
                            className={cn(
                              selectableButtonClass,
                              active && activeSelectableButtonClass
                            )}
                          >
                            <div className="text-sm font-medium">{t.label}</div>
                            <div className="text-[11px] text-white/70 mt-1">{t.summary}</div>
                            <div className="text-[11px] text-white/70 mt-2">
                              Technique: <span className="text-white">{t.technique}</span>
                            </div>
                            <div className="text-[11px] text-white/70 mt-1">
                              Price: <span className="text-white">{formatMoney(retailPrice)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="w-full md:w-72 space-y-3">
                <div className="space-y-2">
                  <Label>Placement</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPlacement("front_center")}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm transition-colors border-white/10 bg-tsCard hover:border-ts-orange/30 hover:bg-white/5",
                        placement === "front_center" && activeSelectableButtonClass
                      )}
                    >
                      Front center
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlacement("left_chest")}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm transition-colors border-white/10 bg-tsCard hover:border-ts-orange/30 hover:bg-white/5",
                        placement === "left_chest" && activeSelectableButtonClass
                      )}
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
                    Est. subtotal: <span className="text-white">{formatMoney(subtotal)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Upload logo</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={(e) => void onLogoSelected(e.target.files?.[0] || null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0"
                    >
                      Choose file
                    </Button>
                    <div className="min-w-0 flex-1 text-xs text-white/70 truncate">
                      {logoFile ? logoFile.name : "No file chosen"}
                    </div>
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
          </CardContent>
        </Card>

        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] lg:sticky lg:top-20 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-ts-orange" />
              Send to fulfillment
            </CardTitle>
            <CardDescription>
              Step 2: enter recipient details and create a draft order for a configured merch
              option.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!printfulConfigured && (
              <Alert variant="destructive">
                <AlertTitle>Fulfillment unavailable</AlertTitle>
                <AlertDescription>
                  Provider credentials are not configured, so draft orders are currently blocked.
                </AlertDescription>
              </Alert>
            )}

            {printfulConfigured && !selectedTierConfigured && (
              <Alert variant="destructive">
                <AlertTitle>Tier unavailable</AlertTitle>
                <AlertDescription>
                  {tierSpec.label} is visible in the catalog but is not configured for fulfillment
                  right now.
                </AlertDescription>
              </Alert>
            )}

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
                disabled={
                  isSubmitting ||
                  !logoFile ||
                  !!qualityError ||
                  configLoading ||
                  !printfulConfigured ||
                  !selectedTierConfigured
                }
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
