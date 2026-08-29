export type ClearableClientCache = {
  clear(): void;
};

export type BrowserLifecycleTarget = {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

function currentBrowserLifecycleTarget(): BrowserLifecycleTarget | null {
  return typeof window === "undefined" ? null : window;
}

/**
 * Register browser-owned cache cleanup without making module imports depend on
 * a DOM. Server rendering and Node-based contract tests receive a no-op.
 */
export function registerQueryCacheLowMemoryLifecycle(
  cache: ClearableClientCache,
  target: BrowserLifecycleTarget | null = currentBrowserLifecycleTarget()
): () => void {
  if (!target) return () => undefined;

  const clearCache = () => {
    cache.clear();
  };
  target.addEventListener("lowMemory", clearCache);

  return () => {
    target.removeEventListener("lowMemory", clearCache);
  };
}
