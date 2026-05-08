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
  const [showLocationOptions, setShowLocationOptions] = React.useState(false);
  const [showAllPrompts, setShowAllPrompts] = React.useState(false);

  const promptList = Array.isArray(quickStartPrompts) ? quickStartPrompts : [];
  const visiblePrompts = showAllPrompts ? promptList : promptList.slice(0, 1);

  return (
    <div className="scout-input-row space-y-3">
      <div className="grid grid-cols-3 gap-2 px-1">
        {[
          ["1", "Ask local"],
          ["2", "See signals"],
          ["3", "Act safely"],
        ].map(([num, label]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="font-mono text-[10px] text-ts-orange">{num}</p>
            <p className="mt-1 text-[11px] font-semibold text-white/70">{label}</p>
          </div>
        ))}
      </div>
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
                Your area: {heroLocationLabel}
              </span>

              <button
                type="button"
                onClick={() => setShowLocationOptions((v) => !v)}
                className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] transition-colors sm:hidden"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                aria-expanded={showLocationOptions}
              >
                {showLocationOptions ? "Hide area options" : "Area options"}
              </button>

              <div
                className={`w-full flex-wrap items-center gap-1.5 sm:w-auto sm:flex ${
                  showLocationOptions ? "flex" : "hidden"
                }`}
              >
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
                  {isUpdatingGeo ? "Updating..." : "Use current location"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {promptList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {visiblePrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSend(prompt)}
              disabled={isBusy}
              className="scout-quick-prompt inline-flex items-center rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-default"
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

          {promptList.length > 1 && (
            <button
              type="button"
              onClick={() => setShowAllPrompts((v) => !v)}
              disabled={isBusy}
              className="scout-quick-prompt inline-flex items-center rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-default sm:hidden"
              style={{
                borderColor: "var(--border-subtle)",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
              }}
            >
              {showAllPrompts ? "Show fewer prompts" : `More prompts (${promptList.length - 1})`}
            </button>
          )}
        </div>
      )}
      <ScoutInput
        key={prefillKey}
        disabled={isBusy}
        placeholder="Example: What useful stuff is happening near me this week?"
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
