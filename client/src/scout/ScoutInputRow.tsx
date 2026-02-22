import React from "react";
import ScoutInput from "./ScoutInput";

interface ScoutInputRowProps {
  isBusy: boolean;
  prefillKey: number;
  heroLocationLabel?: string;
  isUpdatingGeo: boolean;
  onOpenLocationSettings: () => void;
  onUseDeviceLocation: () => void;
  onSend: (value: string) => void;
  onTyping: () => void;
  autoDemoText?: string;
  enableAutoDemo?: boolean;
  autoRouteEnabled: boolean;
  onToggleAutoRoute: (enabled: boolean) => void;
}

export function ScoutInputRow({
  isBusy,
  prefillKey,
  heroLocationLabel,
  isUpdatingGeo,
  onOpenLocationSettings,
  onUseDeviceLocation,
  onSend,
  onTyping,
  autoDemoText,
  enableAutoDemo,
  autoRouteEnabled,
  onToggleAutoRoute,
}: ScoutInputRowProps) {
  const [showOptions, setShowOptions] = React.useState(false);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {heroLocationLabel && (
            <>
              <span
                className="inline-flex items-center rounded-md border px-2 py-1 text-[11px]"
                style={{
                  borderColor: "var(--border-subtle)",
                  backgroundColor:
                    "color-mix(in oklab, var(--surface-intermediate) 86%, transparent)",
                  color: "var(--text-primary)",
                }}
              >
                Area: {heroLocationLabel}
              </span>
              <button
                type="button"
                onClick={onOpenLocationSettings}
                className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] transition-colors"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                Change
              </button>
              <button
                type="button"
                onClick={onUseDeviceLocation}
                disabled={isUpdatingGeo}
                className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] transition-colors disabled:opacity-50 disabled:cursor-default"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                {isUpdatingGeo ? "Updating..." : "Use device"}
              </button>
            </>
          )}
        </div>
        <div className="relative flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] transition-colors"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
            aria-expanded={showOptions}
            aria-label="Scout options"
          >
            Options
          </button>

          {showOptions && (
            <div
              className="absolute right-0 top-[calc(100%+6px)] z-20 w-64 rounded-lg border p-2 shadow-sm"
              style={{
                borderColor: "var(--border-subtle)",
                backgroundColor: "color-mix(in oklab, var(--surface-card) 96%, transparent)",
              }}
            >
              <label
                className="flex items-center gap-2 rounded-md px-2 py-2 text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                <input
                  type="checkbox"
                  checked={autoRouteEnabled}
                  onChange={(e) => onToggleAutoRoute(e.target.checked)}
                  className="h-3.5 w-3.5"
                  style={{ accentColor: "var(--theme-accent-primary)" }}
                />
                <span className="leading-snug">
                  Auto-open high-confidence routes
                  <span className="block text-[10px] opacity-80">
                    When Scout is very sure, it can open the right page automatically.
                  </span>
                </span>
              </label>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowOptions(false)}
                  className="rounded-md px-2 py-1 text-[11px]"
                  style={{ color: "var(--text-primary)" }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <ScoutInput
        key={prefillKey}
        disabled={isBusy}
        placeholder="Describe what you need help with..."
        onSend={onSend}
        onUserTyping={onTyping}
        prefillKey="scout-main"
        initialValue=""
        autoDemoText={autoDemoText}
        enableAutoDemo={enableAutoDemo}
      />
    </div>
  );
}
