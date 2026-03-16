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
  quickStartPrompts?: string[];
  autoDemoText?: string;
  enableAutoDemo?: boolean;
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
  quickStartPrompts,
  autoDemoText,
  enableAutoDemo,
}: ScoutInputRowProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-2 px-1">
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
                Operating area: {heroLocationLabel}
              </span>
              <button
                type="button"
                onClick={onOpenLocationSettings}
                className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] transition-colors"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                Change area
              </button>
              <button
                type="button"
                onClick={onUseDeviceLocation}
                disabled={isUpdatingGeo}
                className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] transition-colors disabled:opacity-50 disabled:cursor-default"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                {isUpdatingGeo ? "Updating..." : "Use device area"}
              </button>
            </>
          )}
        </div>
      </div>
      {Array.isArray(quickStartPrompts) && quickStartPrompts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {quickStartPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSend(prompt)}
              disabled={isBusy}
              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 disabled:cursor-default"
              style={{
                borderColor: "var(--border-subtle)",
                backgroundColor:
                  "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)",
                color: "var(--text-secondary)",
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
      <ScoutInput
        key={prefillKey}
        disabled={isBusy}
        placeholder="Describe the local outcome, problem, or task you need to move forward..."
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
