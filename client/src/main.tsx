import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { trackShellEvent } from "./lib/analytics";

const BOOT_FALLBACK_ID = "ts-boot-fallback";
const BOOT_MESSAGE_ID = "ts-boot-fallback-message";
const BOOT_DETAIL_ID = "ts-boot-fallback-detail";
const APP_READY_ATTR = "data-app-mounted";
const SERVICE_WORKER_URL = `/sw.js?build=${encodeURIComponent(__APP_BUILD_ID__)}`;

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

async function resetClientCaches(options?: { clearLocalStorage?: boolean }) {
  const clearLocalStorage = options?.clearLocalStorage === true;

  const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T
  ): Promise<T> => {
    let timeout: number | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((resolve) => {
          timeout = window.setTimeout(() => resolve(fallback), timeoutMs);
        }),
      ]);
    } finally {
      if (typeof timeout === "number") {
        window.clearTimeout(timeout);
      }
    }
  };

  try {
    if ("serviceWorker" in navigator) {
      const regs = await withTimeout(navigator.serviceWorker.getRegistrations(), 1500, []);
      await withTimeout(
        Promise.allSettled(regs.map((r) => r.unregister())),
        1500,
        [] as PromiseSettledResult<boolean>[]
      );
    }
  } catch {
    // ignore
  }

  try {
    if ("caches" in window) {
      const keys = await withTimeout(caches.keys(), 1500, []);
      const deletions = keys
        .filter(
          (k) => k.startsWith("tradescout-") || k.startsWith("workbox-") || k.startsWith("vite-")
        )
        .map((k) => caches.delete(k));
      await withTimeout(Promise.allSettled(deletions), 2000, [] as PromiseSettledResult<boolean>[]);
    }
  } catch {
    // ignore
  }

  if (clearLocalStorage) {
    try {
      // Clear local persisted UI state that can cause "old version" look/behavior after deploys.
      // Avoid clearing auth cookies (server-side) and keep this scoped to TradeScout keys.
      if (typeof window !== "undefined" && "localStorage" in window) {
        const prefixes = ["ts:", "scout:", "tradescout-", "tradescout:", "admin:"];
        const exactKeys = new Set([
          "themeId",
          "customColors",
          "ts-active-theme",
          "userLocation",
          "guestMode",
          "cookiePreferences",
          "floatingBugReportPosition",
          "hasSeenKeyboardNavigationHint",
        ]);

        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (exactKeys.has(key) || prefixes.some((p) => key.startsWith(p))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }
    } catch {
      // ignore
    }
  }
}

async function maybeHandleManualReset(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("__reset")) return false;

  showBootFallback(
    "Refreshing TradeScout...",
    "Clearing cached assets. This can take a few seconds."
  );

  await resetClientCaches({ clearLocalStorage: true });

  const url = new URL(window.location.href);
  url.searchParams.delete("__reset");
  url.searchParams.set("__fresh", String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

async function maybeHandleBuildChangeReset(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const currentBuildId =
    typeof __APP_BUILD_ID__ === "string" && __APP_BUILD_ID__.trim() ? __APP_BUILD_ID__.trim() : "";
  if (!currentBuildId) return false;

  const storageKey = "ts:lastBuildId";

  let lastBuildId: string | null = null;
  try {
    lastBuildId = window.localStorage.getItem(storageKey);
  } catch {
    lastBuildId = null;
  }

  // First run: persist build marker and continue boot normally.
  if (!lastBuildId) {
    try {
      window.localStorage.setItem(storageKey, currentBuildId);
    } catch {
      // ignore
    }
    return false;
  }

  if (lastBuildId === currentBuildId) return false;

  // Build changed since last load: record the new marker and proceed.
  // Avoid blocking boot on cache clearing; cache/SW recovery is handled by:
  // - server build mismatch detection
  // - chunk-load recovery handlers below
  // - manual `?__reset` when needed
  //
  // This keeps first-load after deploy fast, especially on mobile browsers.

  try {
    window.localStorage.setItem(storageKey, currentBuildId);
  } catch {
    // ignore
  }

  return false;
}

async function fetchServerBuildId(timeoutMs = 2200): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `/api/scout/health?_=${Date.now()}`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "omit",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as unknown;
    const record =
      payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const buildId = typeof record?.buildId === "string" ? record.buildId.trim() : "";
    return buildId || null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function maybeHandleServerBuildMismatchReset(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const currentBuildId =
    typeof __APP_BUILD_ID__ === "string" && __APP_BUILD_ID__.trim() ? __APP_BUILD_ID__.trim() : "";
  if (!currentBuildId) return false;

  const params = new URLSearchParams(window.location.search);
  if (params.has("__reset")) return false;

  // Prevent a reset loop if something about the network/API is flaky.
  const guardKey = "ts:lastServerBuildMismatchResetAt";
  try {
    const last = Number(window.sessionStorage.getItem(guardKey) || "0");
    if (Number.isFinite(last) && last > 0 && Date.now() - last < 60_000) return false;
  } catch {
    // ignore
  }

  const serverBuildId = await fetchServerBuildId();
  if (!serverBuildId) return false;
  if (serverBuildId === currentBuildId) return false;

  try {
    window.sessionStorage.setItem(guardKey, String(Date.now()));
  } catch {
    // ignore
  }

  showBootFallback(
    "Updating TradeScout...",
    "Your browser loaded an older cached version. Clearing caches now."
  );

  await resetClientCaches({ clearLocalStorage: false });

  // Keep the build marker aligned to the server to avoid flip-flopping between versions.
  try {
    window.localStorage.setItem("ts:lastBuildId", serverBuildId);
  } catch {
    // ignore
  }

  const url = new URL(window.location.href);
  url.searchParams.set("__fresh", String(Date.now()));
  window.location.replace(url.toString());
  return true;
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

async function bootstrap() {
  if (await maybeHandleManualReset()) return;
  if (await maybeHandleBuildChangeReset()) return;
  if (await maybeHandleServerBuildMismatchReset()) return;

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

    const coerceErrorMessage = (err: unknown): string => {
      if (typeof err === "string") return err;
      if (err && typeof err === "object") {
        const record = err as Record<string, unknown>;
        if (typeof record.message === "string") return record.message;
        if (typeof record.reason === "string") return record.reason;
      }
      try {
        return String(err ?? "");
      } catch {
        return "";
      }
    };

    const isLikelyChunkLoadError = (err: unknown) => {
      const msg = coerceErrorMessage(err);
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

      await resetClientCaches();

      // Force a full reload to pull the latest HTML + assets.
      window.location.reload();
    };

    window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
      if (isLikelyChunkLoadError(event.reason)) {
        recoverFromChunkError(event.reason);
      }
    });

    window.addEventListener("error", (event: ErrorEvent) => {
      const candidate = event.error ?? event.message;
      if (isLikelyChunkLoadError(candidate)) {
        recoverFromChunkError(candidate);
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
      navigator.serviceWorker.register(SERVICE_WORKER_URL).catch((err) => {
        console.warn("[PWA] service worker registration failed", err);
      });
    });
  }
}

void bootstrap();
