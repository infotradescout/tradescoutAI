import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FEATURE_HOLD_TO_EXPLAIN } from "@shared/governanceFlags";
import { ensureDescriptor, getActionDescriptor, noteSuppressedExecution } from "@/lib/actionDescriptors";

const HOLD_DELAY_MS = 600;

type OverlayState = {
  actionId: string;
  whatItDoes: string;
  then: string;
  x: number;
  y: number;
};

export function HoldToExplainProvider() {
  const [overlay, setOverlay] = useState<OverlayState | null>(null);

  useEffect(() => {
    if (!FEATURE_HOLD_TO_EXPLAIN) return;

    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let activeActionId: string | null = null;
    let suppressClick = false;

    const clearHoldTimer = () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    const hideOverlay = () => setOverlay(null);

    const findActionId = (target: EventTarget | null): string | null => {
      if (!(target instanceof HTMLElement)) return null;
      const el = target.closest("[data-action-id]") as HTMLElement | null;
      if (!el) return null;
      return el.getAttribute("data-action-id");
    };

    const showDescriptor = (actionId: string, event: PointerEvent | MouseEvent) => {
      try {
        ensureDescriptor(actionId);
      } catch (err) {
        console.error(err);
        return;
      }

      const descriptor = actionId ? getActionDescriptor(actionId) : undefined;
      if (!descriptor) return;

      suppressClick = true;
      noteSuppressedExecution(actionId);

      const x = (event as PointerEvent).clientX ?? 0;
      const y = (event as PointerEvent).clientY ?? 0;

      setOverlay({
        actionId,
        whatItDoes: descriptor.whatItDoes,
        then: descriptor.then,
        x,
        y,
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      const actionId = findActionId(event.target);
      if (!actionId) return;
      activeActionId = actionId;
      clearHoldTimer();
      holdTimer = setTimeout(() => {
        showDescriptor(actionId, event);
      }, HOLD_DELAY_MS);
    };

    const onPointerUp = () => {
      clearHoldTimer();
      activeActionId = null;
      hideOverlay();
    };

    const onPointerCancel = () => {
      clearHoldTimer();
      activeActionId = null;
      hideOverlay();
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClick) return;
      event.stopPropagation();
      event.preventDefault();
      suppressClick = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?" && !(event.key === "/" && event.shiftKey)) return;
      const actionId = findActionId(document.activeElement);
      if (!actionId) return;
      event.preventDefault();
      activeActionId = actionId;
      showDescriptor(actionId, event as unknown as PointerEvent);
    };

    const onKeyUp = () => {
      activeActionId = null;
      hideOverlay();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
    };
  }, []);

  if (!FEATURE_HOLD_TO_EXPLAIN || !overlay) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[9999] pointer-events-none"
      style={{ left: overlay.x + 12, top: overlay.y + 12 }}
    >
      <div className="rounded-lg bg-tsCard text-white shadow-lg border border-white/10 px-4 py-3 max-w-xs">
        <p className="text-sm font-semibold">{overlay.whatItDoes}</p>
        <p className="text-xs text-white/70 mt-1">Then: {overlay.then}</p>
        <p className="sr-only">Hold shows what an action does. Release to close.</p>
      </div>
    </div>,
    document.body,
  );
}
