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

      {/* Ambient motion layer to keep the background alive without overpowering UI */}
      <div className="ts-bg__ambient" aria-hidden="true" />

      {/* Subtle moving scanline keeps the canvas from feeling static */}
      <div className="ts-bg__scan" aria-hidden="true" />

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
  background: #0b0f14;
  overflow: hidden;
  isolation: isolate;
}

.ts-bg__content{
  position: relative;
  z-index: 10;
  min-height: 100%;
}

.ts-bg__blueprint,
.ts-bg__ambient,
.ts-bg__scan,
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
  background-size: 1280px auto;
  filter: blur(0.35px);
  transform: scale(1.002);
  transform-origin: center top;
  opacity: 0.94;
  animation: tsBlueprintDrift 46s linear infinite;
}

.ts-bg__ambient{
  z-index: 2;
  opacity: 0.14;
  background:
    radial-gradient(920px 420px at 14% 12%, rgba(255, 255, 255, 0.03), transparent 74%),
    radial-gradient(980px 460px at 86% 18%, rgba(255, 255, 255, 0.02), transparent 76%),
    radial-gradient(980px 520px at 50% 78%, rgba(148, 163, 184, 0.03), transparent 80%);
  animation: tsAmbientShift 24s ease-in-out infinite;
}

.ts-bg__scan{
  z-index: 3;
  opacity: 0.09;
  background:
    linear-gradient(
      180deg,
      transparent 0%,
      rgba(255, 255, 255, 0.05) 48%,
      transparent 100%
    );
  background-repeat: no-repeat;
  background-size: 100% 180px;
  animation: tsScan 13s linear infinite;
}

.ts-bg__separation{
  z-index: 4;
  background:
    linear-gradient(180deg, rgba(8,12,18,0.02), rgba(8,12,18,0.04) 48%, rgba(8,12,18,0.03));
}

@keyframes tsBlueprintDrift {
  0% { background-position: center 0; }
  100% { background-position: center -120px; }
}

@keyframes tsAmbientShift {
  0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.12; }
  50% { transform: translate3d(0, -10px, 0); opacity: 0.18; }
}

@keyframes tsScan {
  0% { background-position: center -220px; }
  100% { background-position: center calc(100% + 220px); }
}

@media (max-width: 768px){
  .ts-bg__blueprint{
    background-size: 1010px auto;
    filter: blur(0.28px);
    opacity: 0.92;
  }

  .ts-bg__ambient{
    opacity: 0.1;
  }

  .ts-bg__scan{
    opacity: 0.07;
  }
}
`;
