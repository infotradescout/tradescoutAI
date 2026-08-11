import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { trackShellEvent } from "./lib/analytics";
import { I18nProvider } from "@/lib/i18n";

const BOOT_FALLBACK_ID = "ts-boot-fallback";
const BOOT_MESSAGE_ID = "ts-boot-fallback-message";
const BOOT_DETAIL_ID = "ts-boot-fallback-detail";
const APP_READY_ATTR = "data-app-mounted";
const SERVICE_WORKER_URL = "/sw.js";

function enforceCanonicalHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) return false;

  // Canonicalize apex -> www so cookies + routing stay consistent.
  // (This is a client-side safety net in case edge/DNS config doesn't 301 properly.)
  if (host === "thetradescout.com" || host.endsWith(".thetradescout.com")) {
    const canonical = "www.thetradescout.com";
    if (host !== canonical) {
      const target = `https://${canonical}${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.replace(target);
      return true;
    }
  }
  return false;
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

function formatUserFacingBootDetail(error: unknown, fallback: string): string {
  // In production we intentionally avoid showing raw exception text to users.
  // Errors are still logged via `trackShellEvent` and `console.error`.
  if (import.meta.env.DEV) return formatErrorMessage(error, fallback);
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

  // Best-effort build marker for diagnostics only.
  // Do NOT block startup or trigger cache resets based on this value.
  try {
    window.localStorage.setItem(storageKey, currentBuildId);
  } catch {
    // ignore
  }

  return false;
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
      formatUserFacingBootDetail(event.error || event.message, "A startup error occurred.")
    );
  }
});

window.addEventListener("unhandledrejection", (event) => {
  reportClientRuntimeError("unhandledrejection", event.reason);

  if (document.body.getAttribute(APP_READY_ATTR) !== "true") {
    showBootFallback(
      "TradeScout could not complete startup.",
      formatUserFacingBootDetail(event.reason, "A startup promise failed.")
    );
  }
});

async function bootstrap() {
  if (enforceCanonicalHost()) return;
  if (await maybeHandleManualReset()) return;
  if (await maybeHandleBuildChangeReset()) return;

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
  // safe recovery path so the user gets the latest assets.
  if (import.meta.env.PROD) {
    const RECOVERY_FLAG = "ts_chunk_recovery_attempted_v1"; // legacy compat alias
    const RECOVERY_SOFT_FLAG = "ts_chunk_recovery_soft_v2";
    const RECOVERY_HARD_FLAG = "ts_chunk_recovery_hard_v2";
    void RECOVERY_FLAG; // referenced for contract compatibility
    let chunkRecoveryInFlight = false;

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
      if (chunkRecoveryInFlight) return;
      chunkRecoveryInFlight = true;

      let softAttempted = false;
      let hardAttempted = false;
      try {
        softAttempted = sessionStorage.getItem(RECOVERY_SOFT_FLAG) === "1";
        hardAttempted = sessionStorage.getItem(RECOVERY_HARD_FLAG) === "1";
      } catch {
        // ignore
      }

      // Last resort reached: we've already attempted soft+hard recovery this session.
      if (softAttempted && hardAttempted) {
        showBootFallback(
          "TradeScout could not load the latest version.",
          "Tap Reload. If this keeps happening, open /reset or add ?__reset=1 to the URL."
        );
        return;
      }

      console.warn("[Boot] chunk load failure detected", err);

      showBootFallback(
        "Refreshing TradeScout...",
        "A recent update changed the app bundle. Reloading the latest version now."
      );

      try {
        // Soft recovery preserves localStorage; hard recovery clears it
        await resetClientCaches({ clearLocalStorage: false });
        if (!softAttempted) {
          await resetClientCaches({ clearLocalStorage: false });
        } else {
          await resetClientCaches({ clearLocalStorage: true });
        }
      } catch {
        // ignore
      }

      try {
        const url = new URL(window.location.href);
        if (!softAttempted) {
          try {
            sessionStorage.setItem(RECOVERY_SOFT_FLAG, "1");
          } catch {
            // ignore
          }
          url.searchParams.set("__fresh", String(Date.now()));
        } else {
          try {
            sessionStorage.setItem(RECOVERY_HARD_FLAG, "1");
          } catch {
            // ignore
          }
          url.searchParams.set("__reset", "1");
        }
        window.location.replace(url.toString());
        return;
      } catch {
        // fall through to manual fallback
      }

      // Ask the browser to check for an updated service worker in the background.
      // If reload fails, at least ask the browser to check for an updated service worker.
      try {
        if ("serviceWorker" in navigator) {
          void navigator.serviceWorker
            .getRegistration()
            .then((reg) => reg?.update())
            .catch(() => {});
        }
      } catch {
        // ignore
      }

      showBootFallback(
        "TradeScout needs a refresh to load the latest version.",
        "Tap Reload. If this keeps happening, open /reset or add ?__reset=1 to the URL."
      );
    };

    // Vite emits this cancellable event before a failed dynamic import is
    // rethrown. Handle it directly so React never receives a deleted chunk
    // error from a previous deployment and multiple missing chunks cannot
    // start competing recovery navigations.
    window.addEventListener("vite:preloadError", (event: Event) => {
      const preloadEvent = event as Event & { payload?: unknown };
      event.preventDefault();
      void recoverFromChunkError(preloadEvent.payload);
    });

    window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
      if (isLikelyChunkLoadError(event.reason)) {
        void recoverFromChunkError(event.reason);
      }
    });

    window.addEventListener("error", (event: ErrorEvent) => {
      const candidate = event.error ?? event.message;
      if (isLikelyChunkLoadError(candidate)) {
        void recoverFromChunkError(candidate);
      }
    });
  }

  // IMPORTANT:
  // Do NOT wrap App in React.StrictMode here.
  // StrictMode intentionally double-mounts in dev,
  // which was breaking Scout, animations, and OAuth.
  try {
    root.render(
      <I18nProvider>
        <App />
      </I18nProvider>
    );
    document.body.setAttribute(APP_READY_ATTR, "true");
    window.requestAnimationFrame(() => {
      hideBootFallback();
    });
  } catch (error) {
    reportClientRuntimeError("error", error);
    showBootFallback(
      "TradeScout failed to load.",
      formatUserFacingBootDetail(error, "Unexpected startup error.")
    );
  }

  // PWA installability: register a service worker in production.
  // Keep this simple and reliable; any caching logic lives in `client/public/sw.js`.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register(SERVICE_WORKER_URL, { updateViaCache: "none" })
        .then((reg) => {
          const markShouldReload = () => {
            try {
              sessionStorage.setItem("ts:sw:update-pending", "1");
            } catch {
              // ignore
            }
          };

          const askWaitingWorkerToActivate = () => {
            if (!reg.waiting) return;
            markShouldReload();
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          };

          // If an updated worker is already waiting, activate it now.
          askWaitingWorkerToActivate();

          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                askWaitingWorkerToActivate();
              }
            });
          });

          navigator.serviceWorker.addEventListener("controllerchange", () => {
            try {
              if (sessionStorage.getItem("ts:sw:update-pending") !== "1") return;
              sessionStorage.removeItem("ts:sw:update-pending");
            } catch {
              // ignore
            }

            const url = new URL(window.location.href);
            url.searchParams.set("__fresh", String(Date.now()));
            window.location.replace(url.toString());
          });

          // Prompt an update check after boot so users pick up newly deployed SW quickly.
          void reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn("[PWA] service worker registration failed", err);
        });
    });
  }
}

void bootstrap();
