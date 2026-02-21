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
        <div className="flex items-center gap-2">
          <label
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            <input
              type="checkbox"
              checked={autoRouteEnabled}
              onChange={(e) => onToggleAutoRoute(e.target.checked)}
              className="h-3.5 w-3.5"
              style={{ accentColor: "var(--theme-accent-primary)" }}
            />
            Auto-open high-confidence routes
          </label>
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
