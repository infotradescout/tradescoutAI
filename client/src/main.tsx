import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { trackShellEvent } from "./lib/analytics";

const BOOT_FALLBACK_ID = "ts-boot-fallback";
const BOOT_MESSAGE_ID = "ts-boot-fallback-message";
const BOOT_DETAIL_ID = "ts-boot-fallback-detail";
const APP_READY_ATTR = "data-app-mounted";

function enforceCanonicalHost() {
  if (typeof window === "undefined") return;
  const host = window.location.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) return;

  // Canonicalize apex -> www so cookies + routing stay consistent.
  // (This is a client-side safety net in case edge/DNS config doesn't 301 properly.)
  if (host === "thetradescout.com" || host.endsWith(".thetradescout.com")) {
    const canonical = "www.thetradescout.com";
    if (host !== canonical) {
      const target = `https://${canonical}${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.replace(target);
    }
  }
}

function setViewportVars() {
  // Facebook/Messenger in-app browsers and mobile Safari often misreport `100vh` when
  // the URL bar shows/hides. Use visualViewport when available.
  const height = window.visualViewport?.height ?? window.innerHeight;
  const vh = height * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

function applyImageTitleFallback(root: ParentNode = document) {
  const images = root.querySelectorAll("img:not([title])");
  images.forEach((img) => {
    const alt = img.getAttribute("alt");
    if (typeof alt === "string" && alt.trim().length > 0) {
      img.setAttribute("title", alt.trim());
    }
  });
}

function formatErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}

function showBootFallback(message: string, detail?: string) {
  const fallback = document.getElementById(BOOT_FALLBACK_ID);
  if (!fallback) return;
  const messageNode = document.getElementById(BOOT_MESSAGE_ID);
  const detailNode = document.getElementById(BOOT_DETAIL_ID);

  if (messageNode) {
    messageNode.textContent = message;
  }
  if (detailNode) {
    detailNode.textContent = detail || "Reload to recover. If this keeps happening, report it.";
  }

  fallback.removeAttribute("hidden");
  fallback.setAttribute("aria-hidden", "false");
}

function hideBootFallback() {
  const fallback = document.getElementById(BOOT_FALLBACK_ID);
  if (!fallback) return;
  fallback.setAttribute("hidden", "true");
  fallback.setAttribute("aria-hidden", "true");
}

function reportClientRuntimeError(source: "error" | "unhandledrejection", error: unknown) {
  const message = formatErrorMessage(error, "Runtime error");
  const stack = error instanceof Error ? error.stack || null : null;

  console.error(`[runtime:${source}]`, error);
  void trackShellEvent({
    type: "client_runtime_error",
    source,
    message,
    stack,
    path: `${window.location.pathname}${window.location.search}`,
    ts: new Date().toISOString(),
  });
}

window.addEventListener("error", (event) => {
  reportClientRuntimeError("error", event.error || event.message);

  if (document.body.getAttribute(APP_READY_ATTR) !== "true") {
    showBootFallback(
      "TradeScout failed to initialize.",
      formatErrorMessage(event.error || event.message, "A startup error occurred.")
    );
  }
});

window.addEventListener("unhandledrejection", (event) => {
  reportClientRuntimeError("unhandledrejection", event.reason);

  if (document.body.getAttribute(APP_READY_ATTR) !== "true") {
    showBootFallback(
      "TradeScout could not complete startup.",
      formatErrorMessage(event.reason, "A startup promise failed.")
    );
  }
});

enforceCanonicalHost();
setViewportVars();
window.addEventListener("resize", setViewportVars);
window.addEventListener("orientationchange", setViewportVars);
window.visualViewport?.addEventListener("resize", setViewportVars);
applyImageTitleFallback();

const imageTitleObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.tagName.toLowerCase() === "img") {
        applyImageTitleFallback(node.parentNode || document);
        return;
      }
      applyImageTitleFallback(node);
    });
  }
});

imageTitleObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container missing in index.html");
}

const root = ReactDOM.createRoot(container);

// Production hardening: if a deploy happens while a user has an old bundle cached,
// dynamic chunk loads can 404 and the app can crash. Detect that case and force a
// one-time cache/SW reset so the user gets the latest assets.
if (import.meta.env.PROD) {
  const RECOVERY_FLAG = "ts_chunk_recovery_attempted_v1";

  const isLikelyChunkLoadError = (err: unknown) => {
    const msg =
      typeof err === "string"
        ? err
        : (err as any)?.message || (err as any)?.reason || (err as any)?.toString?.() || "";
    return (
      typeof msg === "string" &&
      (msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("Loading chunk") ||
        msg.includes("ChunkLoadError") ||
        msg.includes("/assets/"))
    );
  };

  const recoverFromChunkError = async (err: unknown) => {
    try {
      if (sessionStorage.getItem(RECOVERY_FLAG) === "1") return;
      sessionStorage.setItem(RECOVERY_FLAG, "1");
    } catch {
      // ignore
    }

    console.warn("[Boot] chunk load failure detected; resetting caches", err);

    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // ignore
    }

    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((k) => k.startsWith("tradescout-")).map((k) => caches.delete(k))
        );
      }
    } catch {
      // ignore
    }

    // Force a full reload to pull the latest HTML + assets.
    window.location.reload();
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (isLikelyChunkLoadError((event as any).reason)) {
      recoverFromChunkError((event as any).reason);
    }
  });

  window.addEventListener("error", (event) => {
    const anyEvent = event as any;
    if (isLikelyChunkLoadError(anyEvent?.error ?? anyEvent?.message)) {
      recoverFromChunkError(anyEvent?.error ?? anyEvent?.message);
    }
  });
}

// IMPORTANT:
// Do NOT wrap App in React.StrictMode here.
// StrictMode intentionally double-mounts in dev,
// which was breaking Scout, animations, and OAuth.
try {
  root.render(<App />);
  document.body.setAttribute(APP_READY_ATTR, "true");
  window.requestAnimationFrame(() => {
    hideBootFallback();
  });
} catch (error) {
  reportClientRuntimeError("error", error);
  showBootFallback(
    "TradeScout failed to load.",
    formatErrorMessage(error, "Unexpected startup error.")
  );
}

// PWA installability: register a service worker in production.
// Keep this simple and reliable; any caching logic lives in `client/public/sw.js`.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[PWA] service worker registration failed", err);
    });
  });
}
