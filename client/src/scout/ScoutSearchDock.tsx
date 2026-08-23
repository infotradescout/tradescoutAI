import React from "react";
import { ScoutInputRow } from "./ScoutInputRow";

type ScoutSearchDockProps = {
  isMobile: boolean;
  placement?: "inline" | "fixed";
  isBusy: boolean;
  prefillKey: number;
  forcedPrefill?: string;
  hasMessages: boolean;
  quickStartPrompts: readonly string[];
  autoDemoText?: string;
  enableAutoDemo?: boolean;
  onSend: (value: string) => void;
  onTyping: () => void;
};

export function ScoutSearchDock({
  isMobile,
  placement = "fixed",
  isBusy,
  prefillKey,
  forcedPrefill,
  hasMessages,
  quickStartPrompts,
  autoDemoText,
  enableAutoDemo,
  onSend,
  onTyping,
}: ScoutSearchDockProps) {
  const dockRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (placement !== "fixed") return;

    const dock = dockRef.current;
    const activeWorkspace = dock?.closest<HTMLElement>(".scout-shell--active-task");
    if (!dock || !activeWorkspace) return;

    const reserveProperty = "--scout-search-dock-h";
    const publishRenderedHeight = () => {
      const renderedHeight = Math.ceil(dock.getBoundingClientRect().height);
      if (renderedHeight <= 0) return;

      const nextReserve = `${renderedHeight}px`;
      if (activeWorkspace.style.getPropertyValue(reserveProperty) !== nextReserve) {
        activeWorkspace.style.setProperty(reserveProperty, nextReserve);
      }
    };

    publishRenderedHeight();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publishRenderedHeight);
    resizeObserver?.observe(dock);

    return () => {
      resizeObserver?.disconnect();
      activeWorkspace.style.removeProperty(reserveProperty);
    };
  }, [placement]);

  return (
    <div
      ref={dockRef}
      className={placement === "inline" ? "scout-search-dock-inline" : "scout-search-dock-fixed"}
      data-testid="scout-primary-outcome-input"
    >
      <div
        className={
          isMobile
            ? "mx-auto w-full max-w-[32rem] px-2.5"
            : "mx-auto w-full max-w-4xl px-2.5 md:px-4"
        }
      >
        <ScoutInputRow
          isBusy={isBusy}
          prefillKey={prefillKey}
          forcedPrefill={forcedPrefill}
          onSend={onSend}
          onTyping={onTyping}
          quickStartPrompts={
            !hasMessages ? (isMobile ? quickStartPrompts.slice(0, 2) : [...quickStartPrompts]) : []
          }
          autoDemoText={autoDemoText}
          enableAutoDemo={enableAutoDemo}
        />
      </div>
    </div>
  );
}

export default ScoutSearchDock;
