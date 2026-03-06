import React, { Component, ErrorInfo, ReactNode } from "react";
import { trackShellEvent } from "@/lib/analytics";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

function isLikelyChunkLoadError(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error ? String((error as any).message) : "";
  const stack =
    error && typeof error === "object" && "stack" in error ? String((error as any).stack) : "";
  const haystack = `${message}\n${stack}`.toLowerCase();

  // Vite / native ESM
  if (haystack.includes("failed to fetch dynamically imported module")) return true;
  if (haystack.includes("importing a module script failed")) return true;
  if (haystack.includes("error loading dynamically imported module")) return true;

  // Webpack-like errors (defensive; some environments still emit these strings)
  if (haystack.includes("chunkloaderror")) return true;
  if (haystack.includes("loading chunk")) return true;

  // Generic 404/asset fetch cases that often follow stale bundle caches
  if (haystack.includes("/assets/") && haystack.includes("404")) return true;

  return false;
}

async function clearBrowserAssetCaches() {
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
        keys
          .filter(
            (k) =>
              k === "tradescout-static-v1" ||
              k.startsWith("tradescout-") ||
              k.startsWith("workbox-") ||
              k.startsWith("vite-")
          )
          .map((k) => caches.delete(k))
      );
    }
  } catch {
    // ignore
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Always log errors for debugging
    console.error("Error boundary caught an error:", error, errorInfo);
    console.error("Component stack:", errorInfo.componentStack);
    void trackShellEvent({
      type: "client_runtime_error",
      source: "error",
      message: error.message || "React render error",
      stack: [error.stack, errorInfo.componentStack].filter(Boolean).join("\n"),
      path:
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "server",
      ts: new Date().toISOString(),
    });

    // Special handling for common array mapping errors
    if (error.message.includes("map is not a function")) {
      console.error("Array mapping error detected - likely data structure issue");
      console.error("Check for undefined/null arrays or incorrect API response format");
    }

    // Recovery: stale bundle / chunk mismatch. This often happens after deployments if a legacy SW
    // or an aggressive cache served an old JS bundle that points at non-existent hashed chunks.
    if (isLikelyChunkLoadError(error)) {
      try {
        const key = "ts_chunk_recovery_attempted";
        const attempted =
          typeof window !== "undefined" ? sessionStorage.getItem(key) === "1" : false;
        if (!attempted && typeof window !== "undefined") {
          sessionStorage.setItem(key, "1");
          void (async () => {
            await clearBrowserAssetCaches();
            // Bust any intermediary caches. Server already sends no-store for HTML,
            // but this helps when an old SW was controlling navigation.
            const url = new URL(window.location.href);
            url.searchParams.set("__fresh", String(Date.now()));
            window.location.replace(url.toString());
          })();
        }
      } catch {
        // ignore
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const showDebugDetails = import.meta.env.DEV;
      // Return fallback UI with error details
      return (
        this.props.fallback || (
          <div className="bg-tsBg text-white p-8 flex items-center justify-center py-24">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
              <p className="mb-4">The application encountered an error.</p>
              {showDebugDetails && this.state.error && (
                <details className="text-left bg-tsCard border border-white/10 p-4 rounded-xl">
                  <summary className="cursor-pointer">Error details</summary>
                  <pre className="mt-2 text-sm overflow-auto">{this.state.error.toString()}</pre>
                </details>
              )}
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-ts-orange text-white rounded-xl hover:bg-ts-orange-dark shadow-lg shadow-ts-orange/25"
              >
                Reload Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
