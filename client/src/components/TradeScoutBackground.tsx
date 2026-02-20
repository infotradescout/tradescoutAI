import React, { type ReactNode } from "react";

type TradeScoutBackgroundProps = {
  children: ReactNode;
};

export default function TradeScoutBackground({ children }: TradeScoutBackgroundProps) {
  return (
    <div className="ts-bg">
      <style>{css}</style>

      {/* One continuous blueprint image from top to bottom */}
      <div className="ts-bg__blueprint" aria-hidden="true" />

      {/* Subtle separation so UI/cards sit clearly above background */}
      <div className="ts-bg__separation" aria-hidden="true" />

      <div className="ts-bg__content">{children}</div>
    </div>
  );
}

const css = `
.ts-bg{
  position: relative;
  min-height: 100%;
  background: #0B0F14;
  overflow: hidden;
  isolation: isolate;
}

.ts-bg__content{
  position: relative;
  z-index: 10;
  min-height: 100%;
}

.ts-bg__blueprint,
.ts-bg__separation{
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ts-bg__blueprint{
  z-index: 1;
  background-image: url("/landing/blueprint-continuous.svg");
  background-repeat: repeat-y;
  background-position: center top;
  background-size: 100% auto;
  filter: blur(1.1px);
  transform: scale(1.01);
  transform-origin: center top;
  opacity: 0.94;
}

.ts-bg__separation{
  z-index: 2;
  background:
    radial-gradient(1200px 520px at 50% -8%, rgba(255,255,255,0.06), transparent 70%),
    linear-gradient(180deg, rgba(8,12,18,0.14), rgba(8,12,18,0.20) 48%, rgba(8,12,18,0.16));
}
`;
