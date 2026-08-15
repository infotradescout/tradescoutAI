import { useCallback, useEffect, useRef, useState } from "react";

function railItems(rail: HTMLDivElement): HTMLElement[] {
  return Array.from(rail.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset.momentumItem === "true"
  );
}

function setRailPosition(rail: HTMLDivElement, left: number, behavior: ScrollBehavior) {
  if (typeof rail.scrollTo === "function") {
    rail.scrollTo({ left, behavior });
    return;
  }
  rail.scrollLeft = left;
}

/**
 * Tracks the item nearest the center of a native horizontal overflow rail.
 * The rail intentionally has no CSS scroll snap: touch and trackpad gestures
 * retain browser-native momentum after release.
 */
export function useMomentumRail({ itemCount, resetKey }: { itemCount: number; resetKey: string }) {
  const railRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateActiveIndex = useCallback((nextIndex: number) => {
    if (activeIndexRef.current === nextIndex) return;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  }, []);

  const syncActiveIndex = useCallback(() => {
    const rail = railRef.current;
    if (!rail || itemCount < 2) return;

    const items = railItems(rail);
    if (!items.length) return;

    const viewportCenter = rail.scrollLeft + rail.clientWidth / 2;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    items.forEach((item, index) => {
      const itemCenter = item.offsetLeft + item.offsetWidth / 2;
      const distance = Math.abs(itemCenter - viewportCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    updateActiveIndex(nearestIndex);
  }, [itemCount, updateActiveIndex]);

  const scrollToIndex = useCallback(
    (requestedIndex: number, behavior: ScrollBehavior = "smooth") => {
      if (!itemCount) return;
      const nextIndex = Math.max(0, Math.min(requestedIndex, itemCount - 1));
      updateActiveIndex(nextIndex);

      const rail = railRef.current;
      const item = rail ? railItems(rail)[nextIndex] : null;
      if (!rail || !item) return;

      const centeredLeft = item.offsetLeft - Math.max(0, (rail.clientWidth - item.offsetWidth) / 2);
      setRailPosition(rail, Math.max(0, centeredLeft), behavior);
    },
    [itemCount, updateActiveIndex]
  );

  useEffect(() => {
    activeIndexRef.current = 0;
    setActiveIndex(0);
    const rail = railRef.current;
    if (rail) setRailPosition(rail, 0, "auto");
  }, [itemCount, resetKey]);

  return {
    activeIndex,
    railRef,
    onScroll: syncActiveIndex,
    scrollToIndex,
  };
}
