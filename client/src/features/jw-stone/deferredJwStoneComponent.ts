import { useEffect, useState, type ComponentType } from "react";

export function createJwStoneComponentLoader<Props extends object>(
  importer: () => Promise<ComponentType<Props>>
) {
  let pending: Promise<ComponentType<Props>> | null = null;
  return () => {
    if (!pending)
      pending = importer().catch((error: unknown) => {
        pending = null;
        throw error;
      });
    return pending;
  };
}

/** Keep loaded component state; ignore late imports after close or account unmount. */
export function useJwStoneDeferredComponent<Props extends object>(
  load: () => Promise<ComponentType<Props>>,
  active = true
) {
  const [Component, setComponent] = useState<ComponentType<Props> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || Component) return;
    let current = true;
    setFailed(false);
    load().then(
      (component) => {
        if (current) setComponent(() => component);
      },
      () => {
        if (current) setFailed(true);
      }
    );
    return () => {
      current = false;
    };
  }, [active, Component, load, attempt]);
  return { Component, failed, retry: () => setAttempt((value) => value + 1) };
}
