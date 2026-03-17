import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { jsPDF } from "jspdf";
import { useAuth } from "@/hooks/useAuth";
import { SEOHelmet } from "@/components/SEOHelmet";

type Point = { x: number; y: number };
type CalibrationMode = "aruco_auto" | "aruco_manual" | "known_reference";

type KnownReferencePreset = {
  id: string;
  label: string;
  inches: number;
  description: string;
  confidenceTier: "B" | "C";
};

type ArucoModule = {
  AR?: {
    Detector: new () => {
      detect: (
        imageData: ImageData
      ) => Array<{ id: number; corners: Array<{ x: number; y: number }> }>;
    };
  };
  default?: {
    AR?: {
      Detector: new () => {
        detect: (
          imageData: ImageData
        ) => Array<{ id: number; corners: Array<{ x: number; y: number }> }>;
      };
    };
  };
};

const ARUCO_TARGET_ID = 42;
const ARUCO_SIZE_IN = 2;
const TAPE_GUIDE_DEFAULT_IN = 36;

const KNOWN_REFERENCE_PRESETS: KnownReferencePreset[] = [
  {
    id: "outlet_screws_us",
    label: "US outlet cover screw spacing",
    inches: 3.281,
    description: "Center-to-center spacing of outlet screws (US standard).",
    confidenceTier: "B",
  },
  {
    id: "credit_card_long",
    label: "Credit card long edge",
    inches: 3.37,
    description: "ISO/IEC 7810 ID-1 long side.",
    confidenceTier: "B",
  },
  {
    id: "us_letter_short",
    label: "US Letter short side",
    inches: 8.5,
    description: "Standard US Letter paper width.",
    confidenceTier: "B",
  },
  {
    id: "us_letter_long",
    label: "US Letter long side",
    inches: 11,
    description: "Standard US Letter paper height.",
    confidenceTier: "B",
  },
  {
    id: "tape_marks_36",
    label: "Placed tape marks (36 in apart)",
    inches: TAPE_GUIDE_DEFAULT_IN,
    description: "User-placed marks at a known level distance.",
    confidenceTier: "C",
  },
];

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getPathAndQuery(location: string): URLSearchParams {
  const query = String(location || "").split("?")[1] || "";
  return new URLSearchParams(query);
}

function getCanvasPoint(canvas: HTMLCanvasElement, event: MouseEvent<HTMLCanvasElement>): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function getPresetById(id: string): KnownReferencePreset | null {
  return KNOWN_REFERENCE_PRESETS.find((p) => p.id === id) || null;
}

export default function ZeroBaseFeeCameraPage() {
  const { isAuthenticated, user } = useAuth();
  const [location] = useLocation();
  const params = useMemo(() => getPathAndQuery(location), [location]);
  const sessionId = params.get("session_id") || "";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const snapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const arucoDetectorRef = useRef<{
    detect: (imageData: ImageData) => Array<{ id: number; corners: Point[] }>;
  } | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [stampIso, setStampIso] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [busy, setBusy] = useState(false);

  const [calibrationMode, setCalibrationMode] = useState<CalibrationMode>("aruco_auto");
  const [knownReferenceId, setKnownReferenceId] = useState<string>("outlet_screws_us");
  const [customKnownInches, setCustomKnownInches] = useState(String(TAPE_GUIDE_DEFAULT_IN));
  const [referenceLock, setReferenceLock] = useState<"none" | "horizontal" | "vertical">("none");
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [arucoDetectedId, setArucoDetectedId] = useState<number | null>(null);

  const [pixelsPerInch, setPixelsPerInch] = useState<number | null>(null);
  const [measuredPixels, setMeasuredPixels] = useState<number | null>(null);
  const [measuredInches, setMeasuredInches] = useState<number | null>(null);
  const [calibrationMessage, setCalibrationMessage] = useState("");
  const [isDetectingAruco, setIsDetectingAruco] = useState(false);
  const userRoles = Array.isArray((user as any)?.roles)
    ? (user as any).roles.map((r: unknown) =>
        String(r || "")
          .trim()
          .toLowerCase()
      )
    : [];
  const primaryRole = String((user as any)?.role || "")
    .trim()
    .toLowerCase();
  const activeRole = String((user as any)?.activeRole || "")
    .trim()
    .toLowerCase();
  const isPrivilegedTester =
    Boolean((user as any)?.isAdmin) ||
    [primaryRole, activeRole, ...userRoles].some((r) =>
      [
        "super_admin",
        "admin",
        "ops_admin",
        "support_agent",
        "staff",
        "moderator",
        "owner",
        "head_admin",
      ].includes(r)
    );
  const hasCameraAccess = Boolean(accessToken) || isPrivilegedTester;

  useEffect(() => {
    if (!isAuthenticated) return;
    const run = async () => {
      try {
        if (sessionId) {
          const verifyRes = await fetch(
            `/api/zero-base-fee/verify-checkout?sessionId=${encodeURIComponent(sessionId)}`,
            { credentials: "include" }
          );
          const verifyBody = await verifyRes.json().catch(() => ({}));
          if (verifyRes.ok && verifyBody?.accessToken) {
            setAccessToken(String(verifyBody.accessToken));
            setPaymentError("");
            return;
          }
        }

        const recoveryPaths = [
          "/api/zero-base-fee/verify-access",
          "/api/zero-base-fee/verify-accesses",
        ];
        let recoveryBody: any = null;
        let recovered = false;
        let checkedButUnpaid = false;
        for (const recoveryPath of recoveryPaths) {
          const recoveryRes = await fetch(recoveryPath, { credentials: "include" });
          const parsedBody = await recoveryRes.json().catch(() => ({}));
          if (recoveryRes.ok && parsedBody?.accessToken) {
            recoveryBody = parsedBody;
            recovered = true;
            break;
          }
          if (recoveryRes.ok && parsedBody && parsedBody.paid === false) {
            checkedButUnpaid = true;
            break;
          }
        }
        if (!recovered || !recoveryBody?.accessToken) {
          if (sessionId) {
            setPaymentError(
              "Payment verification failed. If you just paid, refresh once. Otherwise start checkout again."
            );
          } else if (checkedButUnpaid) {
            setPaymentError("");
          } else if (isPrivilegedTester) {
            setPaymentError("");
          }
          return;
        }
        setAccessToken(String(recoveryBody.accessToken));
        setPaymentError("");
      } catch {
        if (sessionId) {
          setPaymentError("Could not verify payment.");
        }
      }
    };
    void run();
  }, [sessionId, isAuthenticated, isPrivilegedTester]);

  useEffect(() => {
    if (!capturedDataUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = displayCanvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = capturedDataUrl;
  }, [capturedDataUrl]);

  useEffect(() => {
    if (!capturedDataUrl) return;
    if (calibrationMode !== "aruco_auto") return;
    void detectArucoAutomatically();
  }, [capturedDataUrl, calibrationMode]);

  useEffect(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !capturedDataUrl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      ctx.strokeStyle = "#ff8a00";
      ctx.fillStyle = "#ff8a00";
      ctx.lineWidth = 3;

      for (const p of calibrationPoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      if (calibrationPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(calibrationPoints[0].x, calibrationPoints[0].y);
        for (let i = 1; i < calibrationPoints.length; i += 1) {
          ctx.lineTo(calibrationPoints[i].x, calibrationPoints[i].y);
        }
        if (
          (calibrationMode === "aruco_auto" || calibrationMode === "aruco_manual") &&
          calibrationPoints.length === 4
        ) {
          ctx.closePath();
        }
        ctx.stroke();
      }

      ctx.strokeStyle = "#00d9ff";
      ctx.fillStyle = "#00d9ff";
      for (const p of measurePoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (measurePoints.length === 2) {
        ctx.beginPath();
        ctx.moveTo(measurePoints[0].x, measurePoints[0].y);
        ctx.lineTo(measurePoints[1].x, measurePoints[1].y);
        ctx.stroke();
      }
    };
    img.src = capturedDataUrl;
  }, [capturedDataUrl, calibrationMode, calibrationPoints, measurePoints]);

  const resetMeasurements = () => {
    setCalibrationPoints([]);
    setMeasurePoints([]);
    setPixelsPerInch(null);
    setMeasuredPixels(null);
    setMeasuredInches(null);
    setArucoDetectedId(null);
    setCalibrationMessage("");
  };

  const startCamera = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      setCameraReady(true);
    } catch {
      setPaymentError("Camera permission is required.");
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    const canvas = snapCanvasRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);

    const now = new Date();
    const iso = now.toISOString();
    setStampIso(iso);

    let geoText = "GPS unavailable";
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 0,
        })
      );
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setGps({ lat, lng });
      geoText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch {
      setGps(null);
    }

    const stamp = `TradeScout | ${iso} | ${geoText}`;
    ctx.fillStyle = "rgba(0,0,0,0.66)";
    ctx.fillRect(0, height - 38, width, 38);
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px sans-serif";
    ctx.fillText(stamp, 16, height - 14);

    setCapturedDataUrl(canvas.toDataURL("image/jpeg", 0.95));
    resetMeasurements();
  };

  const ensureArucoDetector = async () => {
    if (arucoDetectorRef.current) return arucoDetectorRef.current;
    const mod = (await import("js-aruco")) as ArucoModule;
    const ARNS = mod.AR || mod.default?.AR;
    if (!ARNS?.Detector) {
      throw new Error("Aruco detector module not available.");
    }
    const detector = new ARNS.Detector();
    arucoDetectorRef.current = detector;
    return detector;
  };

  const detectArucoAutomatically = async () => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !capturedDataUrl) return;
    setIsDetectingAruco(true);
    setCalibrationMessage("Detecting marker...");
    try {
      const detector = await ensureArucoDetector();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const markers = detector.detect(imageData);
      if (!Array.isArray(markers) || markers.length === 0) {
        setCalibrationMessage(
          "No ArUco markers detected. Use manual marker corners or known reference."
        );
        return;
      }

      const target = markers.find((m) => Number(m?.id) === ARUCO_TARGET_ID) || markers[0];
      const corners = Array.isArray(target?.corners) ? target.corners.slice(0, 4) : [];
      if (corners.length !== 4) {
        setCalibrationMessage("Marker detected but corner extraction failed.");
        return;
      }

      setArucoDetectedId(Number(target.id));
      setCalibrationPoints(corners.map((p) => ({ x: Number(p.x), y: Number(p.y) })));
      setCalibrationMode("aruco_auto");
      setCalibrationMessage(
        Number(target.id) === ARUCO_TARGET_ID
          ? `Detected marker ID ${target.id}.`
          : `Detected marker ID ${target.id} (not ${ARUCO_TARGET_ID}, still usable).`
      );
    } catch {
      setCalibrationMessage("Automatic ArUco detection failed. Use manual mode.");
    } finally {
      setIsDetectingAruco(false);
    }
  };

  const onCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!capturedDataUrl) return;
    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    const rawPoint = getCanvasPoint(canvas, event);
    const needed = calibrationMode === "aruco_auto" || calibrationMode === "aruco_manual" ? 4 : 2;
    if (calibrationPoints.length < needed) {
      const p =
        calibrationMode === "known_reference" &&
        calibrationPoints.length === 1 &&
        referenceLock !== "none"
          ? {
              x: referenceLock === "vertical" ? calibrationPoints[0].x : rawPoint.x,
              y: referenceLock === "horizontal" ? calibrationPoints[0].y : rawPoint.y,
            }
          : rawPoint;
      setCalibrationPoints((prev) => [...prev, p].slice(0, needed));
      return;
    }
    setMeasurePoints((prev) => [...prev, rawPoint].slice(0, 2));
  };

  const solveScale = () => {
    let ppi: number | null = null;

    if (
      (calibrationMode === "aruco_auto" || calibrationMode === "aruco_manual") &&
      calibrationPoints.length === 4
    ) {
      const [a, b, c, d] = calibrationPoints;
      const sidePx = (dist(a, b) + dist(b, c) + dist(c, d) + dist(d, a)) / 4;
      ppi = sidePx / ARUCO_SIZE_IN;
    } else if (calibrationMode === "known_reference" && calibrationPoints.length === 2) {
      const preset = getPresetById(knownReferenceId);
      const overrideKnown = Number(customKnownInches);
      const hasOverride = Number.isFinite(overrideKnown) && overrideKnown > 0;
      const knownInches = hasOverride ? overrideKnown : (preset?.inches ?? Number.NaN);
      if (Number.isFinite(knownInches) && knownInches > 0) {
        ppi = dist(calibrationPoints[0], calibrationPoints[1]) / knownInches;
      }
    }

    setPixelsPerInch(ppi);
    if (ppi && measurePoints.length === 2) {
      const px = dist(measurePoints[0], measurePoints[1]);
      setMeasuredPixels(px);
      setMeasuredInches(px / ppi);
    } else {
      setMeasuredPixels(null);
      setMeasuredInches(null);
    }
  };

  const getConfidenceTier = (): "A" | "B" | "C" => {
    if (calibrationMode === "aruco_auto" || calibrationMode === "aruco_manual") return "A";
    const preset = getPresetById(knownReferenceId);
    return preset?.confidenceTier || "C";
  };

  const createCheckout = async () => {
    if (!isAuthenticated) {
      setPaymentError("Sign in first to unlock capture.");
      return;
    }
    setBusy(true);
    setPaymentError("");
    try {
      const origin = window.location.origin;
      const res = await fetch("/api/zero-base-fee/checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          successUrl: `${origin}/zero-base-fee/camera?paid=1&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/zero-base-fee/camera?canceled=1`,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.url) {
        setPaymentError(body?.error || "Could not create checkout session.");
        return;
      }
      window.location.assign(String(body.url));
    } catch {
      setPaymentError("Could not create checkout session.");
    } finally {
      setBusy(false);
    }
  };

  const saveReport = async () => {
    if (!accessToken && !isPrivilegedTester) return;
    if (!accessToken && isPrivilegedTester) return;
    try {
      const preset = getPresetById(knownReferenceId);
      await fetch("/api/zero-base-fee/report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          referenceMode: calibrationMode,
          referencePresetId: knownReferenceId,
          referencePresetLabel: preset?.label || null,
          referenceLock,
          referenceDeclaredInches: Number(customKnownInches),
          confidenceTier: getConfidenceTier(),
          arucoDetectedId,
          pixelsPerInch,
          measuredPixels,
          measuredInches,
          gps,
          stampIso,
        }),
      });
    } catch {
      // fail-soft
    }
  };

  const downloadPdf = async () => {
    if (!capturedDataUrl) return;
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    const confidenceTier = getConfidenceTier();
    const preset = getPresetById(knownReferenceId);

    pdf.setFontSize(14);
    pdf.text("TradeScout Zero-Base-Fee Measurement Report", 40, 44);
    pdf.setFontSize(10);
    pdf.text(`User: ${String((user as any)?.email || "Unknown")}`, 40, 62);
    pdf.text(`Captured: ${stampIso || "Unknown"}`, 40, 76);
    pdf.text(
      `Reference: ${
        calibrationMode === "aruco_auto"
          ? `ArUco auto-detected${arucoDetectedId !== null ? ` (ID ${arucoDetectedId})` : ""}`
          : calibrationMode === "aruco_manual"
            ? "ArUco marker manual corners"
            : `${preset?.label || "Known/User reference"}${
                Number.isFinite(Number(customKnownInches)) && Number(customKnownInches) > 0
                  ? ` (${Number(customKnownInches).toFixed(3)} in)`
                  : ""
              }`
      }`,
      40,
      90
    );
    pdf.text(`Confidence tier: ${confidenceTier}`, 40, 104);
    pdf.text(`Pixels/in: ${pixelsPerInch ? pixelsPerInch.toFixed(3) : "N/A"}`, 40, 118);
    pdf.text(`Measured: ${measuredInches ? measuredInches.toFixed(3) : "N/A"} inches`, 40, 132);
    if (gps) pdf.text(`GPS: ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`, 40, 146);

    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = capturedDataUrl;
    });

    const maxW = 520;
    const maxH = 500;
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    pdf.addImage(capturedDataUrl, "JPEG", 40, 170, w, h);
    pdf.save(`tradescout-zero-base-fee-${Date.now()}.pdf`);
    await saveReport();
  };

  const calibrationRequiredCount =
    calibrationMode === "aruco_auto" || calibrationMode === "aruco_manual" ? 4 : 2;
  const canComputeScale =
    calibrationMode === "aruco_auto" || calibrationMode === "aruco_manual"
      ? calibrationPoints.length === 4
      : calibrationPoints.length === 2;
  const canExportReport =
    Boolean(capturedDataUrl) &&
    Number.isFinite(Number(measuredInches)) &&
    Number(measuredInches) > 0;

  const knownPreset = getPresetById(knownReferenceId);

  return (
    <main className="mx-auto max-w-6xl p-4 text-white">
      <SEOHelmet
        title="Zero-Base-Fee Measurement Camera | TradeScout"
        description="Paid measurement capture with timestamp/GPS stamping, ArUco auto-detection, and known-reference fallback."
      />

      <h1 className="text-2xl font-semibold">Zero-Base-Fee Measurement</h1>
      <p className="mt-2 text-white/80">
        Primary calibration is ArUco marker detection. If marker detection fails, use known
        real-world references or user-defined reference points (for example: two green tape marks
        exactly 36 inches apart).
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={`/api/zero-base-fee/marker.pdf?id=${ARUCO_TARGET_ID}&sizeIn=${ARUCO_SIZE_IN}`}
          className="rounded bg-white/10 px-4 py-2 hover:bg-white/20"
        >
          Download ArUco Marker PDF (ID {ARUCO_TARGET_ID}, {ARUCO_SIZE_IN}")
        </a>
        {!hasCameraAccess ? (
          <button
            onClick={() => void createCheckout()}
            disabled={busy}
            className="rounded bg-orange-500 px-4 py-2 font-medium text-black disabled:opacity-60"
          >
            {busy ? "Starting checkout..." : "Pay $10 to Unlock Camera"}
          </button>
        ) : (
          <span className="rounded bg-emerald-600/30 px-4 py-2 text-emerald-200">
            {isPrivilegedTester
              ? "Admin/staff testing access enabled. Camera unlocked."
              : "Payment verified. Camera unlocked."}
          </span>
        )}
      </div>
      {paymentError ? <p className="mt-2 text-red-300">{paymentError}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded border border-white/20 p-3">
          <h2 className="mb-2 font-semibold">Camera</h2>
          <div className="relative overflow-hidden rounded border border-white/20">
            <video ref={videoRef} className="w-full bg-black" playsInline muted />
            {!cameraReady ? null : (
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded border-2 border-orange-400/80" />
            )}
          </div>
          <canvas ref={snapCanvasRef} className="hidden" />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void startCamera()}
              disabled={!hasCameraAccess}
              className="rounded bg-white/10 px-3 py-2 disabled:opacity-40"
            >
              Start Camera
            </button>
            <button
              onClick={() => void capture()}
              disabled={!cameraReady || !hasCameraAccess}
              className="rounded bg-white/10 px-3 py-2 disabled:opacity-40"
            >
              Capture + Stamp
            </button>
          </div>
        </section>

        <section className="rounded border border-white/20 p-3">
          <h2 className="mb-2 font-semibold">Calibration + Measure</h2>

          <label className="mb-2 block text-sm text-white/80">Calibration mode</label>
          <select
            value={calibrationMode}
            onChange={(e) => {
              setCalibrationMode(e.target.value as CalibrationMode);
              resetMeasurements();
            }}
            className="w-full rounded bg-black/40 p-2"
          >
            <option value="aruco_auto">ArUco marker (auto-detect)</option>
            <option value="aruco_manual">ArUco marker (manual corners)</option>
            <option value="known_reference">Known/User reference points</option>
          </select>

          {calibrationMode === "known_reference" ? (
            <div className="mt-3 space-y-2">
              <label className="block text-sm text-white/80">Reference preset</label>
              <select
                value={knownReferenceId}
                onChange={(e) => {
                  setKnownReferenceId(e.target.value);
                  resetMeasurements();
                }}
                className="w-full rounded bg-black/40 p-2"
              >
                {KNOWN_REFERENCE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} ({preset.inches}" nominal)
                  </option>
                ))}
                <option value="custom_user">Custom user-entered known distance</option>
              </select>

              <p className="text-xs text-white/70">
                {knownPreset?.description ||
                  "Use your own known spacing (for example, two tape marks you place exactly 36 inches apart)."}
              </p>

              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label className="text-sm text-white/80">
                    Known distance override (optional inches)
                  </label>
                  <input
                    value={customKnownInches}
                    onChange={(e) => setCustomKnownInches(e.target.value)}
                    className="mt-1 w-full rounded bg-black/40 p-2"
                    placeholder={String(knownPreset?.inches || TAPE_GUIDE_DEFAULT_IN)}
                  />
                </div>
                <div>
                  <label className="text-sm text-white/80">Reference lock</label>
                  <select
                    value={referenceLock}
                    onChange={(e) =>
                      setReferenceLock(e.target.value as "none" | "horizontal" | "vertical")
                    }
                    className="mt-1 w-full rounded bg-black/40 p-2"
                  >
                    <option value="none">No lock</option>
                    <option value="horizontal">Keep points level (horizontal)</option>
                    <option value="vertical">Keep points plumb (vertical)</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-white/60">
                Tip: for tape-mark workflows, set a known distance (for example 36), choose
                horizontal lock, then click left mark and right mark.
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void detectArucoAutomatically()}
              disabled={calibrationMode !== "aruco_auto" || !capturedDataUrl}
              className="rounded bg-white/10 px-3 py-2 disabled:opacity-40"
            >
              {isDetectingAruco ? "Detecting..." : "Auto-detect ArUco"}
            </button>
            <button
              onClick={solveScale}
              disabled={!canComputeScale}
              className="rounded bg-white/10 px-3 py-2 disabled:opacity-40"
            >
              Compute Measurement
            </button>
            <button
              onClick={downloadPdf}
              disabled={!canExportReport}
              className="rounded bg-orange-500 px-3 py-2 text-black disabled:opacity-40"
            >
              Download PDF Report
            </button>
          </div>

          {calibrationMessage ? (
            <p className="mt-2 text-xs text-white/80">{calibrationMessage}</p>
          ) : null}

          <p className="mt-2 text-xs text-white/70">
            Click image points: first calibration ({calibrationRequiredCount}), then measurement
            (2).
          </p>

          <div className="mt-3 space-y-1 text-sm text-white/80">
            <p>Step 1: {accessToken ? "Paid access confirmed" : "Awaiting payment unlock"}</p>
            <p>
              Step 2:{" "}
              {capturedDataUrl
                ? "Capture completed"
                : "Capture an image with marker or known reference visible"}
            </p>
            <p>
              Step 3:{" "}
              {canComputeScale
                ? "Calibration points ready"
                : `Add ${calibrationRequiredCount - calibrationPoints.length} more calibration point(s)`}
            </p>
            <p>
              Step 4:{" "}
              {measurePoints.length === 2
                ? "Measurement points ready"
                : "Add 2 measurement points after calibration"}
            </p>
            <p>Pixels per inch: {pixelsPerInch ? pixelsPerInch.toFixed(3) : "N/A"}</p>
            <p>Measured pixels: {measuredPixels ? measuredPixels.toFixed(2) : "N/A"}</p>
            <p>Measured inches: {measuredInches ? measuredInches.toFixed(3) : "N/A"}</p>
            <p>Confidence tier: {getConfidenceTier()}</p>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded border border-white/20 p-3">
        <h2 className="mb-2 font-semibold">Captured Image Workspace</h2>
        <canvas
          ref={displayCanvasRef}
          onClick={onCanvasClick}
          className="max-h-[72vh] w-full cursor-crosshair rounded border border-white/20 bg-black/30"
        />
      </section>
    </main>
  );
}
