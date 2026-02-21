import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { trackShellEvent } from "./lib/analytics";

const BOOT_FALLBACK_ID = "ts-boot-fallback";
const BOOT_MESSAGE_ID = "ts-boot-fallback-message";
const BOOT_DETAIL_ID = "ts-boot-fallback-detail";
const APP_READY_ATTR = "data-app-mounted";

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
